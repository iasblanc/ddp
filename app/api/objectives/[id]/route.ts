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

    // ── 1. Buscar slots já ocupados do utilizador ────────────────────────────
    const { data: existingBlocks } = await supabase
      .from("blocks")
      .select("scheduled_at")
      .eq("user_id", user.id)
      .in("status", ["scheduled", "active"])
      .order("scheduled_at", { ascending: false });

    const lastBlock = existingBlocks?.[0] || null;

    // Construir Set de slots ocupados para evitar colisões
    const occupiedSlots = new Set<string>();
    for (const b of existingBlocks || []) {
      const d = new Date(b.scheduled_at);
      const dayKey = d.toISOString().slice(0, 10);
      const h = String(d.getHours()).padStart(2, "0");
      const m = String(d.getMinutes()).padStart(2, "0");
      occupiedSlots.add(`${dayKey}_${h}:${m}`);
    }

    // ── 2. Gerar conteúdo das tarefas com Claude ─────────────────────────────
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

    // ── 3. Scheduler: slots sequenciais sem colisão ──────────────────────────
    const blocks = scheduleBlocks({
      taskDefs,
      userId: user.id,
      objectiveId: params.id,
      dreamId: objective.dream_id,
      bestTime,
      dailyTime,
      blocksPerWeek: Number(blocksPerWeek),
      lastOccupiedSlot: lastBlock?.scheduled_at ? new Date(lastBlock.scheduled_at) : null,
      occupiedSlots,
    });

    // ── 4. Persistir ─────────────────────────────────────────────────────────
    const { data: saved, error: insertError } = await supabase.from("blocks").insert(blocks).select();
    if (insertError) {
      console.error("Insert error:", insertError.message);
      return Response.json({ error: "insert_failed" }, { status: 500 });
    }
    await supabase.rpc("refresh_objective_progress", { p_objective_id: params.id });

    // ── 5. Sincronizar com Google Calendar ───────────────────────────────────
    syncToCalendar(supabase, user.id, saved).catch(console.error);

    return Response.json({ blocks: saved, count: saved?.length || 0 });

  } catch (error: any) {
    console.error("Generate blocks error:", error?.message, error?.status);
    return Response.json({ error: error?.message || "Internal server error" }, { status: 500 });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// SCHEDULER — múltiplos blocos por dia dentro da janela de tempo do utilizador
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Analisa "1 hora por dia", "2 horas", "30 minutos", etc.
 * Retorna número de blocos de 30min que cabem nesse tempo.
 */
function parseDailyBlocks(dailyTime: string): number {
  if (!dailyTime) return 1;
  const t = dailyTime.toLowerCase();

  // Detectar horas
  const hoursMatch = t.match(/(\d+(?:[.,]\d+)?)\s*h/);
  if (hoursMatch) {
    const hours = parseFloat(hoursMatch[1].replace(",", "."));
    return Math.max(1, Math.floor(hours * 2)); // 2 blocos por hora
  }

  // Detectar minutos
  const minsMatch = t.match(/(\d+)\s*min/);
  if (minsMatch) {
    const mins = parseInt(minsMatch[1]);
    return Math.max(1, Math.floor(mins / 30));
  }

  // Textos comuns
  if (t.includes("30 minutos") || t.includes("meia hora")) return 1;
  if (t.includes("1 hora") || t.includes("uma hora")) return 2;
  if (t.includes("2 horas") || t.includes("duas horas")) return 4;
  if (t.includes("3 horas") || t.includes("três horas")) return 6;
  if (t.includes("4 horas") || t.includes("quatro horas")) return 8;

  return 1;
}

/**
 * Mapeia horário preferido → hora de início da janela
 */
function parseStartHour(bestTime: string): number {
  const t = (bestTime || "").toLowerCase().trim();
  const timeMap: Record<string, number> = {
    "manhã": 7, "manha": 7, "cedo": 6, "morning": 7,
    "meio-dia": 12, "almoço": 12, "almoco": 12,
    "tarde": 14, "afternoon": 14,
    "noite": 19, "evening": 19, "night": 20,
    "antes do trabalho": 6,
    "depois do trabalho": 18,
  };
  for (const [key, hour] of Object.entries(timeMap)) {
    if (t.includes(key)) return hour;
  }
  // Tentar extrair hora numérica "às 9h", "9:00", "09"
  const numMatch = t.match(/(\d{1,2})(?:h|:)/);
  if (numMatch) return parseInt(numMatch[1]);
  return 9;
}

function scheduleBlocks({
  taskDefs, userId, objectiveId, dreamId, bestTime, dailyTime, blocksPerWeek, lastOccupiedSlot, occupiedSlots,
}: {
  taskDefs: any[], userId: string, objectiveId: string, dreamId: string,
  bestTime: string, dailyTime: string, blocksPerWeek: number,
  lastOccupiedSlot: Date | null,
  occupiedSlots: Set<string>, // "YYYY-MM-DD_HH:MM" já ocupados
}) {
  const blocksPerDay = parseDailyBlocks(dailyTime);
  const startHour = parseStartHour(bestTime);

  // Dias de trabalho por semana
  const workDaysByFreq: Record<number, number[]> = {
    1: [1], 2: [1, 4], 3: [1, 3, 5],
    4: [1, 2, 4, 5], 5: [1, 2, 3, 4, 5],
    6: [1, 2, 3, 4, 5, 6], 7: [0, 1, 2, 3, 4, 5, 6],
  };
  const freq = Math.min(7, Math.max(1, blocksPerWeek));
  const workDays = workDaysByFreq[freq] ?? [1, 3, 5];

  function isWorkDay(d: Date) { return workDays.includes(d.getDay()); }

  function advanceToWorkDay(d: Date): Date {
    const r = new Date(d);
    let i = 0;
    while (!isWorkDay(r) && i++ < 14) r.setDate(r.getDate() + 1);
    return r;
  }

  // Cursor inicial: amanhã ou dia seguinte ao último bloco
  let cursorDay = new Date();
  cursorDay.setHours(0, 0, 0, 0);
  if (lastOccupiedSlot) {
    const lastDate = new Date(lastOccupiedSlot);
    lastDate.setHours(0, 0, 0, 0);
    cursorDay = new Date(lastDate);
    // Verificar se ainda há capacidade hoje ou avançar para amanhã
    const todayKey = lastDate.toISOString().slice(0, 10);
    const slotsToday = [...occupiedSlots].filter(s => s.startsWith(todayKey)).length;
    if (slotsToday >= blocksPerDay) {
      cursorDay.setDate(cursorDay.getDate() + 1);
    }
  } else {
    cursorDay.setDate(cursorDay.getDate() + 1);
  }
  cursorDay = advanceToWorkDay(cursorDay);

  // Slot pointer dentro do dia
  let cursorDayKey = cursorDay.toISOString().slice(0, 10);
  let slotsUsedToday = [...occupiedSlots].filter(s => s.startsWith(cursorDayKey)).length;

  const scheduled: any[] = [];

  for (let i = 0; i < taskDefs.length; i++) {
    const def = taskDefs[i];

    // Avançar para o próximo slot disponível dentro do dia
    if (slotsUsedToday >= blocksPerDay) {
      // Dia cheio → próximo dia de trabalho
      cursorDay.setDate(cursorDay.getDate() + 1);
      cursorDay = advanceToWorkDay(cursorDay);
      cursorDayKey = cursorDay.toISOString().slice(0, 10);
      slotsUsedToday = [...occupiedSlots].filter(s => s.startsWith(cursorDayKey)).length;
    }

    // Hora do slot: startHour + (slotsUsedToday * 0.5 horas)
    const blockHour = startHour + Math.floor(slotsUsedToday * 0.5);
    const blockMin = (slotsUsedToday % 2 === 0) ? 0 : 30;

    const slotDate = new Date(cursorDay);
    slotDate.setHours(blockHour, blockMin, 0, 0);

    const slotKey = `${cursorDayKey}_${String(blockHour).padStart(2,"0")}:${String(blockMin).padStart(2,"0")}`;
    occupiedSlots.add(slotKey);
    slotsUsedToday++;

    scheduled.push({
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

  return scheduled;
}

// ─────────────────────────────────────────────────────────────────────────────
// SYNC GOOGLE CALENDAR — criar eventos para os blocos gerados
// ─────────────────────────────────────────────────────────────────────────────
async function syncToCalendar(supabase: any, userId: string, blocks: any[]) {
  if (!blocks?.length) return;

  const { data: integration } = await supabase
    .from("calendar_integrations")
    .select("access_token, refresh_token")
    .eq("user_id", userId)
    .eq("is_active", true)
    .single();

  if (!integration?.access_token) return;

  for (const block of blocks) {
    try {
      const start = new Date(block.scheduled_at);
      const end = new Date(start.getTime() + 30 * 60 * 1000);

      const event = {
        summary: `🎯 ${block.title}`,
        description: [
          block.description || "",
          block.resource_url ? `\nRecurso: ${block.resource_url}` : "",
          "\n\n[Dont Dream. Plan.]",
        ].join(""),
        start: { dateTime: start.toISOString(), timeZone: "America/Sao_Paulo" },
        end: { dateTime: end.toISOString(), timeZone: "America/Sao_Paulo" },
        extendedProperties: {
          private: { ddp_block_id: block.id },
        },
        colorId: block.session_type === "test" ? "11" : // tomato
                 block.session_type === "review" ? "9" : // grape
                 block.session_type === "practice" ? "5" : // banana
                 "1", // lavender (learn)
      };

      const res = await fetch(
        "https://www.googleapis.com/calendar/v3/calendars/primary/events",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${integration.access_token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(event),
        }
      );

      if (res.ok) {
        const created = await res.json();
        await supabase.from("blocks").update({ calendar_event_id: created.id })
          .eq("id", block.id);
      }
    } catch (err) {
      console.error("Calendar sync error for block", block.id, err);
    }
  }
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
    await supabase.from("objectives").update({ status: "archived" })
      .eq("id", params.id).eq("user_id", user.id);
    return Response.json({ archived: true });
  } catch {
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
