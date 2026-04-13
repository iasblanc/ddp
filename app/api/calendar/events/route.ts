// @ts-nocheck
export const dynamic = "force-dynamic";
import { createClient } from "@/lib/supabase/server";
import { refreshAccessToken, listCalendarEvents, detectConflicts } from "@/lib/calendar/google";

export async function GET(request: Request) {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const dreamId = searchParams.get("dreamId");
    const days = parseInt(searchParams.get("days") || "7");

    const { data: integration } = await supabase
      .from("calendar_integrations")
      .select("*")
      .eq("user_id", user.id)
      .eq("provider", "google")
      .eq("is_active", true)
      .single();

    if (!integration) return Response.json({ connected: false, conflicts: 0 });

    // Refrescar token
    let accessToken = integration.access_token;
    if (integration.refresh_token && integration.token_expires_at && new Date(integration.token_expires_at) < new Date()) {
      accessToken = await refreshAccessToken(integration.refresh_token);
      if (accessToken) {
        await supabase.from("calendar_integrations").update({
          access_token: accessToken,
          token_expires_at: new Date(Date.now() + 3600 * 1000).toISOString(),
        }).eq("id", integration.id);
      }
    }

    const timeMin = new Date().toISOString();
    const timeMax = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
    const events = await listCalendarEvents(accessToken, timeMin, timeMax);

    // Detectar conflitos com blocos DDP agendados
    let conflicts = 0;
    if (dreamId) {
      const { data: blocks } = await supabase
        .from("blocks")
        .select("scheduled_at, duration_minutes")
        .eq("dream_id", dreamId)
        .eq("user_id", user.id)
        .eq("status", "scheduled")
        .gte("scheduled_at", timeMin)
        .lte("scheduled_at", timeMax);

      if (blocks?.length) {
        conflicts = detectConflicts(blocks, events);
      }
    }

    return Response.json({ connected: true, events: events.length, conflicts });
  } catch (error) {
    console.error("Calendar events error:", error);
    return Response.json({ connected: false, error: "fetch_failed" });
  }
}
