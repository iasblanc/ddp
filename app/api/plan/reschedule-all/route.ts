// @ts-nocheck
export const dynamic = "force-dynamic";
export const maxDuration = 60;
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const { dreamId, bestTime = "manhã", dailyTime = "1 hora", blocksPerWeek = 3 } = await request.json();
    if (!dreamId) return Response.json({ error: "dreamId required" }, { status: 400 });

    // Buscar objectivos ordenados
    const { data: objectives } = await supabase
      .from("objectives").select("id, order_index")
      .eq("dream_id", dreamId).eq("user_id", user.id)
      .order("order_index", { ascending: true });

    if (!objectives?.length) return Response.json({ rescheduled: 0 });

    // Buscar blocos pendentes por objectivo
    const objBlocks: Record<string, string[]> = {};
    for (const obj of objectives) {
      const { data: blocks } = await supabase
        .from("blocks").select("id")
        .eq("objective_id", obj.id).eq("user_id", user.id)
        .in("status", ["scheduled","active"])
        .order("phase_number", { ascending: true });
      objBlocks[obj.id] = (blocks || []).map((b: any) => b.id);
    }

    // Blocos gerais (sem objectivo)
    const { data: genBlocks } = await supabase
      .from("blocks").select("id")
      .eq("dream_id", dreamId).eq("user_id", user.id)
      .is("objective_id", null).in("status", ["scheduled","active"]);

    // ── Round-robin intercalado ───────────────────────────────────────────
    const interleaved: string[] = [];
    const maxLen = Math.max(...objectives.map(o => objBlocks[o.id]?.length || 0));
    for (let round = 0; round < maxLen; round++) {
      for (const obj of objectives) {
        if (round < (objBlocks[obj.id]?.length || 0)) {
          interleaved.push(objBlocks[obj.id][round]);
        }
      }
    }
    for (const b of (genBlocks || [])) interleaved.push(b.id);

    if (!interleaved.length) return Response.json({ rescheduled: 0 });

    // ── Scheduler com UTC offset ──────────────────────────────────────────
    const TZ = 3;
    const bpd      = parseDailyBlocks(dailyTime);
    const startH   = parseStartHour(bestTime) + TZ;
    const workDays = parseWorkDays(blocksPerWeek);

    const nowLocal = new Date(Date.now() - TZ * 3600000);
    nowLocal.setHours(0, 0, 0, 0);
    let cursor = new Date(nowLocal);
    cursor.setDate(cursor.getDate() + 1);
    cursor = nextWorkDay(cursor, workDays);

    const occ = new Map<string, number>();
    const updates: Array<{ id: string; scheduled_at: string }> = [];

    for (const id of interleaved) {
      let dk   = cursor.toISOString().slice(0, 10);
      let used = occ.get(dk) || 0;
      if (used >= bpd) {
        cursor.setDate(cursor.getDate() + 1);
        cursor = nextWorkDay(cursor, workDays);
        dk = cursor.toISOString().slice(0, 10);
        used = occ.get(dk) || 0;
      }
      const mins = startH * 60 + used * 30;
      const local = new Date(cursor);
      local.setHours(Math.floor(mins / 60), mins % 60, 0, 0);
      const utc = new Date(local.getTime() + TZ * 3600000);
      updates.push({ id, scheduled_at: utc.toISOString() });
      occ.set(dk, used + 1);
    }

    let rescheduled = 0;
    for (const upd of updates) {
      const { error } = await supabase.from("blocks")
        .update({ scheduled_at: upd.scheduled_at })
        .eq("id", upd.id).eq("user_id", user.id);
      if (!error) rescheduled++;
    }

    syncCalendar(supabase, user.id, updates).catch(console.error);
    return Response.json({ rescheduled, total: interleaved.length });
  } catch (e: any) {
    console.error("reschedule-all:", e?.message);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}

function parseDailyBlocks(t: string): number {
  const s = t.toLowerCase();
  const h = s.match(/(\d+(?:[.,]\d+)?)\s*h/);
  if (h) return Math.min(4, Math.max(1, Math.floor(parseFloat(h[1].replace(",",".")) * 2)));
  const m = s.match(/(\d+)\s*min/);
  if (m) return Math.min(4, Math.max(1, Math.floor(parseInt(m[1]) / 30)));
  if (s.includes("1 hora") || s.includes("uma hora")) return 2;
  if (s.includes("2 horas")) return 4;
  return 2;
}
function parseStartHour(t: string): number {
  const s = (t||"").toLowerCase();
  if (s.includes("manhã")||s.includes("manha")) return 7;
  if (s.includes("tarde")) return 14;
  if (s.includes("noite")) return 19;
  const m = s.match(/(\d{1,2})(?:h|:)/);
  return m ? parseInt(m[1]) : 9;
}
function parseWorkDays(n: number): number[] {
  return ({1:[1],2:[1,4],3:[1,3,5],4:[1,2,4,5],5:[1,2,3,4,5]} as any)[Math.min(5,Math.max(1,n))] ?? [1,3,5];
}
function nextWorkDay(d: Date, wd: number[]): Date {
  const r = new Date(d); let i = 0;
  while (!wd.includes(r.getDay()) && i++<14) r.setDate(r.getDate()+1);
  return r;
}
async function syncCalendar(supabase: any, userId: string, updates: any[]) {
  const { data: intg } = await supabase.from("calendar_integrations").select("access_token")
    .eq("user_id", userId).eq("is_active", true).single();
  if (!intg?.access_token) return;
  for (const upd of updates) {
    const { data: b } = await supabase.from("blocks").select("calendar_event_id,duration_minutes").eq("id", upd.id).single();
    if (!b?.calendar_event_id) continue;
    const s = new Date(upd.scheduled_at);
    const e = new Date(s.getTime() + (b.duration_minutes||30)*60000);
    await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events/${b.calendar_event_id}`,{
      method:"PATCH",
      headers:{Authorization:`Bearer ${intg.access_token}`,"Content-Type":"application/json"},
      body:JSON.stringify({start:{dateTime:s.toISOString(),timeZone:"America/Sao_Paulo"},end:{dateTime:e.toISOString(),timeZone:"America/Sao_Paulo"}}),
    }).catch(console.error);
  }
}
