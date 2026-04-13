// @ts-nocheck
export const dynamic = "force-dynamic";
import { createClient } from "@/lib/supabase/server";

// Webhook Google Calendar — notificado quando evento muda
export async function POST(request: Request) {
  try {
    // Google envia headers de verificação
    const channelId = request.headers.get("x-goog-channel-id");
    const resourceState = request.headers.get("x-goog-resource-state");

    if (resourceState === "sync") {
      return new Response("OK", { status: 200 });
    }

    if (!channelId) return new Response("Missing channel ID", { status: 400 });

    // Buscar a integração associada a este canal
    const supabase = createClient();
    const { data: integration } = await supabase
      .from("calendar_integrations")
      .select("user_id, access_token, refresh_token")
      .eq("webhook_channel_id", channelId)
      .single();

    if (!integration) return new Response("Unknown channel", { status: 404 });

    // Buscar eventos actualizados recentemente
    const accessToken = integration.access_token;
    const since = new Date(Date.now() - 5 * 60 * 1000).toISOString(); // últimos 5min

    const res = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events?updatedMin=${encodeURIComponent(since)}&singleEvents=true`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    if (!res.ok) return new Response("Calendar fetch failed", { status: 502 });
    const data = await res.json();
    const events = data.items || [];

    // Para cada evento com ddp_block_id: sincronizar estado
    for (const event of events) {
      const blockId = event.extendedProperties?.private?.ddp_block_id;
      if (!blockId) continue;

      const googleStatus = event.status; // confirmed | cancelled | tentative
      const newBlockStatus = googleStatus === "cancelled" ? "skipped" : null;

      if (newBlockStatus) {
        await supabase.from("blocks")
          .update({ status: newBlockStatus, updated_at: new Date().toISOString() })
          .eq("id", blockId)
          .eq("user_id", integration.user_id);
      }

      // Se evento tem nova hora: actualizar scheduled_at
      if (event.start?.dateTime && googleStatus !== "cancelled") {
        await supabase.from("blocks")
          .update({ scheduled_at: event.start.dateTime, updated_at: new Date().toISOString() })
          .eq("id", blockId)
          .eq("user_id", integration.user_id);
      }
    }

    return new Response("OK", { status: 200 });
  } catch (error: any) {
    console.error("Calendar webhook error:", error?.message);
    return new Response("Error", { status: 500 });
  }
}

// GET — registar canal de webhook no Google Calendar
export async function GET(request: Request) {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const { data: integration } = await supabase
      .from("calendar_integrations")
      .select("access_token, webhook_channel_id")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .single();

    if (!integration?.access_token) return Response.json({ error: "no_calendar" }, { status: 400 });

    // Já tem canal activo?
    if (integration.webhook_channel_id) {
      return Response.json({ active: true, channelId: integration.webhook_channel_id });
    }

    // Criar canal de notificação
    const channelId = crypto.randomUUID();
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://ddp-phi.vercel.app";

    const res = await fetch(
      "https://www.googleapis.com/calendar/v3/calendars/primary/events/watch",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${integration.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id: channelId,
          type: "web_hook",
          address: `${appUrl}/api/calendar/webhook`,
          expiration: Date.now() + 7 * 24 * 60 * 60 * 1000, // 7 dias
        }),
      }
    );

    if (!res.ok) {
      const err = await res.json();
      return Response.json({ error: "webhook_registration_failed", detail: err }, { status: 502 });
    }

    // Guardar channelId
    await supabase.from("calendar_integrations")
      .update({ webhook_channel_id: channelId })
      .eq("user_id", user.id);

    return Response.json({ registered: true, channelId });
  } catch (error: any) {
    console.error("Webhook register error:", error?.message);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
