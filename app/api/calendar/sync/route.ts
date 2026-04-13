// @ts-nocheck
export const dynamic = "force-dynamic";
import { createClient } from "@/lib/supabase/server";
import { refreshAccessToken, createCalendarEvent, updateCalendarEvent, deleteCalendarEvent, buildBlockEvent } from "@/lib/calendar/google";

export async function POST(request: Request) {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json();
    const { blockId, action } = body; // action: create | update | delete

    // Buscar integração Calendar
    const { data: integration } = await supabase
      .from("calendar_integrations")
      .select("*")
      .eq("user_id", user.id)
      .eq("provider", "google")
      .eq("is_active", true)
      .single();

    if (!integration) return Response.json({ error: "no_calendar_integration" }, { status: 400 });

    // Refrescar token se necessário
    let accessToken = integration.access_token;
    if (integration.token_expires_at && new Date(integration.token_expires_at) < new Date()) {
      if (integration.refresh_token) {
        accessToken = await refreshAccessToken(integration.refresh_token);
        if (accessToken) {
          await supabase.from("calendar_integrations").update({
            access_token: accessToken,
            token_expires_at: new Date(Date.now() + 3600 * 1000).toISOString(),
          }).eq("id", integration.id);
        }
      }
    }

    if (!accessToken) return Response.json({ error: "token_refresh_failed" }, { status: 400 });

    // Buscar bloco
    const { data: block } = await supabase
      .from("blocks")
      .select("*, dreams(title)")
      .eq("id", blockId)
      .eq("user_id", user.id)
      .single();

    if (!block) return Response.json({ error: "Block not found" }, { status: 404 });

    const calendarId = "primary";

    if (action === "create" || action === "update") {
      const event = buildBlockEvent({
        id: block.id,
        title: block.title,
        dream_title: block.dreams?.title || "Dont Dream. Plan.",
        scheduled_at: block.scheduled_at,
        duration_minutes: block.duration_minutes || 30,
      });

      if (block.calendar_event_id && action === "update") {
        await updateCalendarEvent(accessToken, block.calendar_event_id, event, calendarId);
      } else {
        const eventId = await createCalendarEvent(accessToken, event, calendarId);
        if (eventId) {
          await supabase.from("blocks").update({ calendar_event_id: eventId }).eq("id", blockId);
        }
      }
    }

    if (action === "delete" && block.calendar_event_id) {
      await deleteCalendarEvent(accessToken, block.calendar_event_id, calendarId);
      await supabase.from("blocks").update({ calendar_event_id: null }).eq("id", blockId);
    }

    return Response.json({ success: true });
  } catch (error) {
    console.error("Calendar sync error:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}

// GET — verificar estado da integração
export async function GET(request: Request) {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const { data: integration } = await supabase
      .from("calendar_integrations")
      .select("id, provider, is_active, created_at")
      .eq("user_id", user.id)
      .eq("provider", "google")
      .single();

    return Response.json({ connected: !!integration?.is_active, integration: integration || null });
  } catch {
    return Response.json({ connected: false });
  }
}
