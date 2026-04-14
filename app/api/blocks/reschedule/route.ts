// @ts-nocheck
export const dynamic = "force-dynamic";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const { dreamId, bestTime = "manhã", dailyTime = "1 hora", blocksPerWeek = 3 } = await request.json();

    const { data: blocks } = await supabase
      .from("blocks")
      .select("id, title, objective_id, phase_number")
      .eq("dream_id", dreamId)
      .eq("user_id", user.id)
      .in("status", ["scheduled", "active"])
      .order("objective_id", { ascending: true })
      .order("phase_number",  { ascending: true });

    if (!blocks?.length) return Response.json({ rescheduled: 0 });

    // ── Utilitários ───────────────────────────────────────────────────────────
    function parseDailyBlocks(t: string): number {
      const s = t.toLowerCase();
      const hMatch = s.match(/(\d+(?:[.,]\d+)?)\s*h/);
      if (hMatch) return Math.min(4, Math.max(1, Math.floor(parseFloat(hMatch[1].replace(",",".")) * 2)));
      const mMatch = s.match(/(\d+)\s*min/);
      if (mMatch) return Math.min(4, Math.max(1, Math.floor(parseInt(mMatch[1]) / 30)));
      if (s.includes("1 hora") || s.includes("uma hora")) return 2;
      if (s.includes("2 horas") || s.includes("duas horas")) return 4;
      return 2;
    }
    function parseStartHour(t: string): number {
      const s = (t||"").toLowerCase();
      if (s.includes("manhã") || s.includes("manha")) return 7;
      if (s.includes("tarde")) return 14;
      if (s.includes("noite")) return 19;
      const m = s.match(/(\d{1,2})(?:h|:)/);
      return m ? parseInt(m[1]) : 9;
    }
    const workDaysByFreq: Record<number, number[]> = {
      1:[1], 2:[1,4], 3:[1,3,5], 4:[1,2,4,5], 5:[1,2,3,4,5]
    };
    const workDays = workDaysByFreq[Math.min(5, Math.max(1, Number(blocksPerWeek)))] ?? [1,3,5];
    function advanceToWorkDay(d: Date): Date {
      const r = new Date(d); let i = 0;
      while (!workDays.includes(r.getDay()) && i++<14) r.setDate(r.getDate()+1);
      return r;
    }

    const bpd       = parseDailyBlocks(dailyTime);
    const startHour = parseStartHour(bestTime);

    const TZ_OFFSET = 3; // São Paulo = UTC-3
    const startHourUTC = startHour + TZ_OFFSET;

    // Começar amanhã em horário local São Paulo
    const nowLocal = new Date(Date.now() - TZ_OFFSET * 3600000);
    nowLocal.setHours(0,0,0,0);
    let cursor = new Date(nowLocal);
    cursor.setDate(cursor.getDate() + 1);
    cursor = advanceToWorkDay(cursor);

    const dayOccupancy = new Map<string, number>();
    const updates: Array<{ id: string; scheduled_at: string }> = [];

    for (const block of blocks) {
      let dayKey = cursor.toISOString().slice(0,10);
      let used = dayOccupancy.get(dayKey) || 0;

      if (used >= bpd) {
        cursor.setDate(cursor.getDate() + 1);
        cursor = advanceToWorkDay(cursor);
        dayKey = cursor.toISOString().slice(0,10);
        used = dayOccupancy.get(dayKey) || 0;
      }

      const totalMin = startHourUTC * 60 + used * 30;
      const slotLocal = new Date(cursor);
      slotLocal.setHours(Math.floor(totalMin/60), totalMin%60, 0, 0);
      // Converter para UTC correcto
      const slot = new Date(slotLocal.getTime() + TZ_OFFSET * 3600000);

      updates.push({ id: block.id, scheduled_at: slot.toISOString() });
      dayOccupancy.set(dayKey, used + 1);
    }

    let rescheduled = 0;
    for (const upd of updates) {
      const { error } = await supabase.from("blocks")
        .update({ scheduled_at: upd.scheduled_at })
        .eq("id", upd.id).eq("user_id", user.id);
      if (!error) rescheduled++;
    }

    syncRescheduled(supabase, user.id, updates).catch(console.error);
    return Response.json({ rescheduled, total: blocks.length });
  } catch (error: any) {
    console.error("Reschedule error:", error?.message);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}

async function syncRescheduled(supabase: any, userId: string, updates: any[]) {
  const { data: integration } = await supabase
    .from("calendar_integrations").select("access_token")
    .eq("user_id", userId).eq("is_active", true).single();
  if (!integration?.access_token) return;

  for (const upd of updates) {
    const { data: block } = await supabase.from("blocks")
      .select("calendar_event_id, duration_minutes").eq("id", upd.id).single();
    if (!block?.calendar_event_id) continue;
    const start = new Date(upd.scheduled_at);
    const end   = new Date(start.getTime() + (block.duration_minutes||30) * 60000);
    await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events/${block.calendar_event_id}`,
      {
        method: "PATCH",
        headers: { Authorization: `Bearer ${integration.access_token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          start: { dateTime: start.toISOString(), timeZone: "America/Sao_Paulo" },
          end:   { dateTime: end.toISOString(),   timeZone: "America/Sao_Paulo" },
        }),
      }
    ).catch(console.error);
  }
}
