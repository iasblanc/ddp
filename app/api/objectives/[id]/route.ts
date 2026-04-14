// @ts-nocheck
export const dynamic = "force-dynamic";
export const maxDuration = 60;
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) return Response.json({ error: "north_unavailable" }, { status: 503 });

    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const { data: objective } = await supabase
      .from("objectives")
      .select("*, dreams(title)")
      .eq("id", params.id).eq("user_id", user.id).single();
    if (!objective) return Response.json({ error: "Not found" }, { status: 404 });

    const {
      dailyTime = "1 hora", bestTime = "manhã",
      deadline = "3 meses", currentLevel = "iniciante",
      constraints = "nenhuma", weeks = 6, blocksPerWeek = 3,
    } = await request.json();

    const totalBlocks = Math.min(12, Math.max(6, Number(weeks) * Number(blocksPerWeek)));

    // ── Gerar conteúdo das tarefas ────────────────────────────────────────────
    const prompt = `You are North. Return ONLY a JSON array — no text before or after, no markdown.

Generate ${totalBlocks} tactical 30-minute sessions for:
OBJECTIVE: "${objective.title}"
DREAM: "${objective.dreams?.title}"
USER: level=${currentLevel}, daily time=${dailyTime}, deadline=${deadline}

Each item:
{"title":"Specific task in Portuguese max 10 words","description":"What exactly to do 1 sentence Portuguese","resource_url":"https://real-url-or-null","resource_name":"Resource name or null","session_type":"learn","order":0}

session_type: learn, practice, review, or test. Vary them. Progress from basic to advanced.
Include real resource URLs. Language: Portuguese (pt-BR).
START WITH [ END WITH ]`;

    const response = await new Anthropic({ apiKey }).messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 2500,
      messages: [{ role: "user", content: prompt }],
    });

    const rawText = response.content[0].type === "text" ? response.content[0].text : "";
    let taskDefs: any[] = [];
    const start = rawText.indexOf("[");
    const end = rawText.lastIndexOf("]");
    if (start !== -1 && end > start) {
      try { taskDefs = JSON.parse(rawText.slice(start, end + 1)); }
      catch { return Response.json({ error: "parse_failed", count: 0 }, { status: 200 }); }
    } else {
      return Response.json({ error: "parse_failed", count: 0 }, { status: 200 });
    }

    // ── Buscar slots já ocupados ───────────────────────────────────────────────
    const { data: existingBlocks } = await supabase
      .from("blocks")
      .select("scheduled_at")
      .eq("user_id", user.id)
      .in("status", ["scheduled", "active"])
      .order("scheduled_at", { ascending: false });

    const lastBlock = existingBlocks?.[0] || null;

    // Construir mapa: "YYYY-MM-DD" → count de blocos nesse dia
    const dayOccupancy = new Map<string, number>();
    for (const b of existingBlocks || []) {
      const dayKey = new Date(b.scheduled_at).toISOString().slice(0, 10);
      dayOccupancy.set(dayKey, (dayOccupancy.get(dayKey) || 0) + 1);
    }

    // ── Scheduler ─────────────────────────────────────────────────────────────
    const blocks = scheduleBlocks({
      taskDefs, userId: user.id,
      objectiveId: params.id, dreamId: objective.dream_id,
      bestTime, dailyTime, blocksPerWeek: Number(blocksPerWeek),
      lastOccupiedSlot: lastBlock?.scheduled_at ? new Date(lastBlock.scheduled_at) : null,
      dayOccupancy,
    });

    const { data: saved, error: insertError } = await supabase.from("blocks").insert(blocks).select();
    if (insertError) {
      console.error("Insert error:", insertError.message);
      return Response.json({ error: "insert_failed" }, { status: 500 });
    }
    await supabase.rpc("refresh_objective_progress", { p_objective_id: params.id });
    syncToCalendar(supabase, user.id, saved).catch(console.error);
    return Response.json({ blocks: saved, count: saved?.length || 0 });

  } catch (error: any) {
    console.error("Generate blocks error:", error?.message);
    return Response.json({ error: error?.message || "Internal server error" }, { status: 500 });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// UTILITÁRIOS
// ─────────────────────────────────────────────────────────────────────────────

function parseDailyBlocks(dailyTime: string): number {
  if (!dailyTime) return 2;
  const t = dailyTime.toLowerCase();

  // Extrair horas (suporta "1h", "1 hora", "1.5h", "one hour")
  const hoursMatch = t.match(/(\d+(?:[.,]\d+)?)\s*h/);
  if (hoursMatch) {
    const hours = parseFloat(hoursMatch[1].replace(",", "."));
    // Cap: máximo 4 blocos/dia (2h) — protege o utilizador de dias impossíveis
    return Math.min(4, Math.max(1, Math.floor(hours * 2)));
  }
  const minsMatch = t.match(/(\d+)\s*min/);
  if (minsMatch) return Math.min(4, Math.max(1, Math.floor(parseInt(minsMatch[1]) / 30)));

  if (t.includes("30 min") || t.includes("meia hora")) return 1;
  if (t.includes("1 hora") || t.includes("uma hora") || t.includes("1h")) return 2;
  if (t.includes("2 horas") || t.includes("duas horas")) return 4;
  if (t.includes("3 horas") || t.includes("três horas")) return 4; // cap
  return 2; // default razoável
}

function parseStartHour(bestTime: string): number {
  const t = (bestTime || "").toLowerCase().trim();
  if (t.includes("manhã") || t.includes("manha") || t.includes("cedo") || t.includes("morning")) return 7;
  if (t.includes("meio-dia") || t.includes("almoço") || t.includes("almoco")) return 12;
  if (t.includes("tarde") || t.includes("afternoon")) return 14;
  if (t.includes("noite") || t.includes("evening") || t.includes("night")) return 19;
  const numMatch = t.match(/(\d{1,2})(?:h|:|\s*hora)/);
  if (numMatch) return Math.min(22, Math.max(5, parseInt(numMatch[1])));
  return 9;
}

function parseWorkDays(blocksPerWeek: number): number[] {
  const map: Record<number, number[]> = {
    1: [1], 2: [1, 4], 3: [1, 3, 5],
    4: [1, 2, 4, 5], 5: [1, 2, 3, 4, 5],
    6: [1, 2, 3, 4, 5, 6], 7: [0, 1, 2, 3, 4, 5, 6],
  };
  return map[Math.min(7, Math.max(1, blocksPerWeek))] ?? [1, 3, 5];
}

function advanceToWorkDay(d: Date, workDays: number[]): Date {
  const r = new Date(d);
  let i = 0;
  while (!workDays.includes(r.getDay()) && i++ < 14) r.setDate(r.getDate() + 1);
  return r;
}

// ─────────────────────────────────────────────────────────────────────────────
// SCHEDULER
// Regras:
//   1. Máximo blocksPerDay por dia (cap 4)
//   2. Não mistura objectivos no mesmo dia — um novo objectivo só começa
//      num dia onde ainda não há blocos de outros objectivos
//   3. Slots dentro do dia: startHour, startHour+0:30, startHour+1:00, ...
// ─────────────────────────────────────────────────────────────────────────────
// Offset UTC→São Paulo: São Paulo = UTC-3
// Se o utilizador quer "manhã 7h" local, guardamos 10h UTC
const SAO_PAULO_OFFSET_HOURS = 3;

function scheduleBlocks({
  taskDefs, userId, objectiveId, dreamId,
  bestTime, dailyTime, blocksPerWeek,
  lastOccupiedSlot, dayOccupancy,
}: {
  taskDefs: any[], userId: string, objectiveId: string, dreamId: string,
  bestTime: string, dailyTime: string, blocksPerWeek: number,
  lastOccupiedSlot: Date | null,
  dayOccupancy: Map<string, number>,
}) {
  const blocksPerDay = parseDailyBlocks(dailyTime);
  // startHour em horário local São Paulo — guardar em UTC (+3)
  const startHourLocal = parseStartHour(bestTime);
  const startHourUTC   = startHourLocal + SAO_PAULO_OFFSET_HOURS;
  const workDays       = parseWorkDays(blocksPerWeek);

  // Hoje em São Paulo (UTC-3)
  const nowUTC = new Date();
  const nowLocal = new Date(nowUTC.getTime() - SAO_PAULO_OFFSET_HOURS * 3600000);
  nowLocal.setHours(0, 0, 0, 0);

  let cursorDay = new Date(nowLocal);

  if (lastOccupiedSlot) {
    // Usar o lastOccupiedSlot só se for no futuro
    const lastLocal = new Date(new Date(lastOccupiedSlot).getTime() - SAO_PAULO_OFFSET_HOURS * 3600000);
    lastLocal.setHours(0, 0, 0, 0);
    if (lastLocal > nowLocal) {
      // Último bloco é futuro — pode aproveitar o dia se ainda tem capacidade
      const lastDayKey = lastLocal.toISOString().slice(0, 10);
      const usedInLastDay = dayOccupancy.get(lastDayKey) || 0;
      if (usedInLastDay >= blocksPerDay) {
        cursorDay = new Date(lastLocal);
        cursorDay.setDate(cursorDay.getDate() + 1);
      } else {
        cursorDay = new Date(lastLocal);
      }
    } else {
      // Último bloco é passado — começar amanhã
      cursorDay.setDate(cursorDay.getDate() + 1);
    }
  } else {
    cursorDay.setDate(cursorDay.getDate() + 1);
  }

  cursorDay = advanceToWorkDay(cursorDay, workDays);

  const result: any[] = [];

  for (let i = 0; i < taskDefs.length; i++) {
    const def = taskDefs[i];
    const dayKey = cursorDay.toISOString().slice(0, 10);
    const usedToday = dayOccupancy.get(dayKey) || 0;

    // Dia cheio? Avançar
    if (usedToday >= blocksPerDay) {
      cursorDay.setDate(cursorDay.getDate() + 1);
      cursorDay = advanceToWorkDay(cursorDay, workDays);
    }

    // Recalcular após possível avanço
    const finalDayKey = cursorDay.toISOString().slice(0, 10);
    const finalUsedToday = dayOccupancy.get(finalDayKey) || 0;

    // Calcular hora do slot em UTC (local + offset)
    const slotIndex = finalUsedToday;
    const totalMinutesUTC = startHourUTC * 60 + slotIndex * 30;
    const slotHourUTC = Math.floor(totalMinutesUTC / 60);
    const slotMinUTC  = totalMinutesUTC % 60;

    // cursorDay está em horário local — converter para UTC para guardar
    const slotDateLocal = new Date(cursorDay);
    slotDateLocal.setHours(slotHourUTC, slotMinUTC, 0, 0);
    // Corrigir: adicionar o offset para que o ISO string seja UTC correcto
    const slotDate = new Date(slotDateLocal.getTime() + SAO_PAULO_OFFSET_HOURS * 3600000);

    // Registar este slot como ocupado para os próximos blocos desta chamada
    dayOccupancy.set(finalDayKey, finalUsedToday + 1);

    result.push({
      objective_id: objectiveId,
      dream_id: dreamId,
      user_id: userId,
      title: def.title,
      description: def.description || null,
      resource_url: def.resource_url || null,
      resource_name: def.resource_name || null,
      session_type: def.session_type || "practice",
      duration_minutes: 30,
      scheduled_at: slotDate.toISOString(),
      status: "scheduled",
      is_critical: i === 0,
      phase_number: Math.floor(i / blocksPerDay) + 1,
      week_number: Math.floor(i / (blocksPerDay * 5)) + 1,
    });
  }

  return result;
}

// ─────────────────────────────────────────────────────────────────────────────
// SYNC GOOGLE CALENDAR
// ─────────────────────────────────────────────────────────────────────────────
async function syncToCalendar(supabase: any, userId: string, blocks: any[]) {
  if (!blocks?.length) return;
  const { data: integration } = await supabase
    .from("calendar_integrations")
    .select("access_token")
    .eq("user_id", userId).eq("is_active", true).single();
  if (!integration?.access_token) return;

  for (const block of blocks) {
    try {
      const start = new Date(block.scheduled_at);
      const end = new Date(start.getTime() + 30 * 60 * 1000);
      const res = await fetch(
        "https://www.googleapis.com/calendar/v3/calendars/primary/events",
        {
          method: "POST",
          headers: { Authorization: `Bearer ${integration.access_token}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            summary: `🎯 ${block.title}`,
            description: [block.description || "", block.resource_url ? `\nRecurso: ${block.resource_url}` : "", "\n\n[Dont Dream. Plan.]"].join(""),
            start: { dateTime: start.toISOString(), timeZone: "America/Sao_Paulo" },
            end:   { dateTime: end.toISOString(),   timeZone: "America/Sao_Paulo" },
            extendedProperties: { private: { ddp_block_id: block.id } },
            colorId: block.session_type === "test" ? "11" : block.session_type === "review" ? "9" : block.session_type === "practice" ? "5" : "1",
          }),
        }
      );
      if (res.ok) {
        const created = await res.json();
        await supabase.from("blocks").update({ calendar_event_id: created.id }).eq("id", block.id);
      }
    } catch (err) {
      console.error("Calendar sync error:", err);
    }
  }
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
    await supabase.from("objectives").update({ status: "archived" }).eq("id", params.id).eq("user_id", user.id);
    return Response.json({ archived: true });
  } catch {
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
