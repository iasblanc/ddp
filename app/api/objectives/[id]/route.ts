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

    // ── 1. Buscar último slot ocupado do usuário ─────────────────────────────
    const { data: lastBlock } = await supabase
      .from("blocks")
      .select("scheduled_at")
      .eq("user_id", user.id)
      .order("scheduled_at", { ascending: false })
      .limit(1)
      .single();

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
      blocksPerWeek: Number(blocksPerWeek),
      lastOccupiedSlot: lastBlock?.scheduled_at ? new Date(lastBlock.scheduled_at) : null,
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
// SCHEDULER — distribui blocos em slots únicos sem sobreposição
// ─────────────────────────────────────────────────────────────────────────────
function scheduleBlocks({
  taskDefs, userId, objectiveId, dreamId, bestTime, blocksPerWeek, lastOccupiedSlot,
}: {
  taskDefs: any[], userId: string, objectiveId: string, dreamId: string,
  bestTime: string, blocksPerWeek: number, lastOccupiedSlot: Date | null,
}) {
  // Mapear horário preferido → hora do dia
  const timeMap: Record<string, number> = {
    "manhã": 9, "manha": 9, morning: 9,
    "meio-dia": 12, afternoon: 14, tarde: 15,
    noite: 20, evening: 19, night: 20,
  };
  const hour = timeMap[bestTime?.toLowerCase().trim()] ?? 9;

  // Dias de trabalho baseados em blocksPerWeek
  // Spread uniforme na semana (0=Dom, 1=Seg, ..., 6=Sáb)
  const workDaysByFreq: Record<number, number[]> = {
    1: [1],           // só segunda
    2: [1, 4],        // seg + qui
    3: [1, 3, 5],     // seg + qua + sex
    4: [1, 2, 4, 5],  // seg + ter + qui + sex
    5: [1, 2, 3, 4, 5], // seg a sex
    6: [1, 2, 3, 4, 5, 6],
    7: [0, 1, 2, 3, 4, 5, 6],
  };
  const freq = Math.min(7, Math.max(1, blocksPerWeek));
  const workDays = workDaysByFreq[freq] ?? [1, 3, 5];

  // Ponto de partida: dia seguinte ao último bloco do usuário (ou amanhã)
  let cursor = new Date();
  cursor.setHours(0, 0, 0, 0);

  if (lastOccupiedSlot) {
    const lastDate = new Date(lastOccupiedSlot);
    lastDate.setHours(0, 0, 0, 0);
    // Começar no dia seguinte ao último bloco
    cursor = new Date(lastDate);
    cursor.setDate(cursor.getDate() + 1);
  } else {
    // Amanhã
    cursor.setDate(cursor.getDate() + 1);
  }

  // Avançar cursor até ao próximo dia de trabalho
  function advanceToNextWorkDay(d: Date): Date {
    const result = new Date(d);
    let attempts = 0;
    while (!workDays.includes(result.getDay()) && attempts < 14) {
      result.setDate(result.getDate() + 1);
      attempts++;
    }
    return result;
  }

  cursor = advanceToNextWorkDay(cursor);

  return taskDefs.map((def: any, idx: number) => {
    const slotDate = new Date(cursor);
    slotDate.setHours(hour, 0, 0, 0);

    // Avançar cursor para o próximo dia de trabalho disponível
    cursor.setDate(cursor.getDate() + 1);
    cursor = advanceToNextWorkDay(cursor);

    return {
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
      is_critical: idx === 0,
      phase_number: Math.floor(idx / blocksPerWeek) + 1,
      week_number: Math.floor(idx / blocksPerWeek) + 1,
    };
  });
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
