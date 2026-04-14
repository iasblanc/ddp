// @ts-nocheck
export const dynamic = "force-dynamic";
import { createClient } from "@/lib/supabase/server";

// POST /api/blocks/reschedule — redistribuir todos os blocos do usuário sem sobreposição
export async function POST(request: Request) {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const { dreamId, bestTime = "manhã", blocksPerWeek = 3 } = await request.json();

    // Buscar todos os blocos agendados (não concluídos) deste sonho, ordenados por phase/week e order
    const { data: blocks } = await supabase
      .from("blocks")
      .select("id, title, objective_id, phase_number, week_number, scheduled_at")
      .eq("dream_id", dreamId)
      .eq("user_id", user.id)
      .in("status", ["scheduled", "active"])
      .order("objective_id", { ascending: true })
      .order("phase_number", { ascending: true });

    if (!blocks?.length) return Response.json({ rescheduled: 0 });

    const timeMap: Record<string, number> = {
      "manhã": 9, "manha": 9, morning: 9,
      "meio-dia": 12, afternoon: 14, tarde: 15,
      noite: 20, evening: 19, night: 20,
    };
    const hour = timeMap[bestTime?.toLowerCase().trim()] ?? 9;

    const workDaysByFreq: Record<number, number[]> = {
      1: [1], 2: [1, 4], 3: [1, 3, 5],
      4: [1, 2, 4, 5], 5: [1, 2, 3, 4, 5],
    };
    const freq = Math.min(5, Math.max(1, Number(blocksPerWeek)));
    const workDays = workDaysByFreq[freq] ?? [1, 3, 5];

    // Começar amanhã
    let cursor = new Date();
    cursor.setHours(0, 0, 0, 0);
    cursor.setDate(cursor.getDate() + 1);

    function advanceToWorkDay(d: Date): Date {
      const r = new Date(d);
      let i = 0;
      while (!workDays.includes(r.getDay()) && i++ < 14) r.setDate(r.getDate() + 1);
      return r;
    }
    cursor = advanceToWorkDay(cursor);

    // Redistribuir blocos sequencialmente — 1 por slot
    const updates: Array<{ id: string; scheduled_at: string }> = [];
    for (const block of blocks) {
      const slot = new Date(cursor);
      slot.setHours(hour, 0, 0, 0);
      updates.push({ id: block.id, scheduled_at: slot.toISOString() });
      cursor.setDate(cursor.getDate() + 1);
      cursor = advanceToWorkDay(cursor);
    }

    // Actualizar em batch
    let rescheduled = 0;
    for (const upd of updates) {
      const { error } = await supabase.from("blocks")
        .update({ scheduled_at: upd.scheduled_at })
        .eq("id", upd.id).eq("user_id", user.id);
      if (!error) rescheduled++;
    }

    // Sincronizar com Calendar
    syncRescheduled(supabase, user.id, updates).catch(console.error);

    return Response.json({ rescheduled, total: blocks.length });
  } catch (error: any) {
    console.error("Reschedule error:", error?.message);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}

async function syncRescheduled(supabase: any, userId: string, updates: any[]) {
  const { data: integration } = await supabase
    .from("calendar_integrations")
    .select("access_token")
    .eq("user_id", userId).eq("is_active", true).single();
  if (!integration?.access_token) return;

  for (const upd of updates) {
    const { data: block } = await supabase.from("blocks")
      .select("calendar_event_id, title, description, duration_minutes")
      .eq("id", upd.id).single();
    if (!block?.calendar_event_id) continue;

    const start = new Date(upd.scheduled_at);
    const end = new Date(start.getTime() + (block.duration_minutes || 30) * 60000);
    await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events/${block.calendar_event_id}`,
      {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${integration.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          start: { dateTime: start.toISOString(), timeZone: "America/Sao_Paulo" },
          end: { dateTime: end.toISOString(), timeZone: "America/Sao_Paulo" },
        }),
      }
    ).catch(console.error);
  }
}
