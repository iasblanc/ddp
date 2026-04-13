// @ts-nocheck
export const dynamic = "force-dynamic";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";

// POST /api/objectives/[id]/blocks — gera acções tácticas para 1 objectivo
export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    if (!process.env.ANTHROPIC_API_KEY) return Response.json({ error: "north_unavailable" }, { status: 503 });

    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    // Buscar objectivo + sonho
    const { data: objective } = await supabase
      .from("objectives")
      .select("*, dreams(title, description)")
      .eq("id", params.id)
      .eq("user_id", user.id)
      .single();

    if (!objective) return Response.json({ error: "Not found" }, { status: 404 });

    const { weeks = 4, blocksPerWeek = 3, timePreference = "morning" } = await request.json();

    const prompt = `You are North. Generate tactical 30-minute blocks for this macro objective.

DREAM: "${objective.dreams?.title}"
MACRO OBJECTIVE: "${objective.title}"
WHY IT MATTERS: "${objective.why || objective.description}"
TIMELINE: ${weeks} weeks
FREQUENCY: ${blocksPerWeek} sessions per week
PREFERRED TIME: ${timePreference}

Generate the complete sequence of 30-minute sessions needed to achieve this objective.
Each session must be:
- Specific (not "study X" — instead "solve 30 algebra questions focusing on quadratic functions")
- Ordered logically (each builds on previous)
- Completable in exactly 30 minutes
- Varied enough to maintain engagement

Respond ONLY with a valid JSON array:
[
  {
    "title": "Specific action (max 10 words)",
    "week": 1,
    "day_of_week": "monday",
    "duration_minutes": 30,
    "is_critical": false,
    "order": 0
  }
]

Language: Portuguese (pt-BR). Return ONLY the JSON array.`;

    const response = await new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY }).messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 2000,
      messages: [{ role: "user", content: prompt }],
    });

    const text = response.content[0].type === "text" ? response.content[0].text.trim() : "[]";
    const cleaned = text.replace(/```json|```/g, "").trim();
    const blockDefs = JSON.parse(cleaned);

    // Calcular datas reais a partir de hoje
    const blocks = generateScheduledBlocks(blockDefs, objective.id, objective.dream_id, user.id);

    const { data: saved } = await supabase.from("blocks").insert(blocks).select();

    // Actualizar cache do objectivo
    await supabase.rpc("refresh_objective_progress", { p_objective_id: params.id });

    return Response.json({ blocks: saved, count: saved?.length || 0 });
  } catch (error: any) {
    console.error("Generate blocks error:", error?.message);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}

function generateScheduledBlocks(defs: any[], objectiveId: string, dreamId: string, userId: string) {
  const dayMap: Record<string, number> = {
    sunday: 0, monday: 1, tuesday: 2, wednesday: 3,
    thursday: 4, friday: 5, saturday: 6
  };
  const timeMap: Record<string, number> = {
    morning: 9, afternoon: 15, evening: 19, night: 20
  };

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return defs.map((def, idx) => {
    const targetDay = dayMap[def.day_of_week?.toLowerCase()] ?? 1;
    const weekOffset = (def.week || 1) - 1;
    const daysFromToday = weekOffset * 7 + ((targetDay - today.getDay() + 7) % 7) || (weekOffset * 7 + 1);

    const blockDate = new Date(today);
    blockDate.setDate(blockDate.getDate() + daysFromToday);
    blockDate.setHours(timeMap.morning, 0, 0, 0);

    return {
      objective_id: objectiveId,
      dream_id: dreamId,
      user_id: userId,
      title: def.title,
      duration_minutes: def.duration_minutes || 30,
      scheduled_at: blockDate.toISOString(),
      status: "scheduled",
      is_critical: def.is_critical || idx === 0,
      phase_number: def.week || 1,
      week_number: def.week || 1,
    };
  });
}
