// @ts-nocheck
export const dynamic = "force-dynamic";
export const maxDuration = 60;
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    if (!process.env.ANTHROPIC_API_KEY)
      return Response.json({ error: "north_unavailable" }, { status: 503 });

    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const { data: objective } = await supabase
      .from("objectives")
      .select("*, dreams(title, description)")
      .eq("id", params.id).eq("user_id", user.id).single();

    if (!objective) return Response.json({ error: "Not found" }, { status: 404 });

    const {
      dailyTime = "1 hora", bestTime = "manhã",
      deadline = "3 meses", currentLevel = "iniciante",
      constraints = "nenhuma", weeks = 6, blocksPerWeek = 3,
    } = await request.json();

    const prompt = `You are North — the AI of Dont Dream. Plan.

DREAM: "${objective.dreams?.title}"
MACRO OBJECTIVE: "${objective.title}"
WHY IT MATTERS: "${objective.why || objective.description}"

USER PROFILE:
- Daily available time: ${dailyTime}
- Best time of day: ${bestTime}
- Total deadline: ${deadline}
- Current level: ${currentLevel}
- Constraints/restrictions: ${constraints}
- Sessions per week: ${blocksPerWeek}
- Total weeks for this objective: ${weeks}

TASK: Generate the COMPLETE sequence of specific 30-minute tactical sessions to achieve this objective.

RULES FOR EACH SESSION:
1. Title must be ultra-specific: NOT "Estudar álgebra" but "Resolver 25 questões de equações quadráticas do Khan Academy"
2. Include the EXACT resource/material/tool to use when relevant
3. Include a direct URL for quality learning resources when applicable (Khan Academy, Coursera, YouTube channels, official docs, etc.)
4. Each session builds on the previous — show progression
5. Alternate between: learning, practice, review, test
6. Be realistic: a beginner can't do advanced tasks in week 1
7. The final sessions should be close to exam/goal conditions

Return ONLY valid JSON array, no markdown:
[
  {
    "title": "Ultra-specific action title (max 12 words)",
    "description": "Exactly what to do in these 30 minutes, step by step",
    "resource_url": "https://... (direct link to best resource, or null)",
    "resource_name": "Name of resource (Khan Academy, etc.) or null",
    "week": 1,
    "day_of_week": "monday",
    "duration_minutes": 30,
    "is_critical": false,
    "session_type": "learn|practice|review|test",
    "order": 0
  }
]

Language: Portuguese (pt-BR). Be extremely specific. Include real URLs where relevant.`;

    const response = await new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! }).messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 4000,
      messages: [{ role: "user", content: prompt }],
    });

    const rawText = response.content[0].type === "text" ? response.content[0].text : "[]";
    // Extrair o array JSON de forma robusta — Claude por vezes adiciona texto antes/depois
    let blockDefs: any[] = [];
    try {
      const start = rawText.indexOf("[");
      const end   = rawText.lastIndexOf("]");
      if (start !== -1 && end !== -1 && end > start) {
        blockDefs = JSON.parse(rawText.slice(start, end + 1));
      } else {
        const clean = rawText.replace(/```json|```/g, "").trim();
        blockDefs = JSON.parse(clean);
      }
    } catch (parseErr) {
      console.error("Generate blocks JSON parse error:", (parseErr as any)?.message);
      console.error("Raw response (first 500 chars):", rawText.slice(0, 500));
      return Response.json({ error: "parse_failed", blocks: [], count: 0 }, { status: 200 });
    }

    const blocks = generateScheduledBlocks(
      blockDefs, params.id, objective.dream_id, user.id, bestTime
    );

    const { data: saved } = await supabase.from("blocks").insert(blocks).select();
    await supabase.rpc("refresh_objective_progress", { p_objective_id: params.id });

    return Response.json({ blocks: saved, count: saved?.length || 0 });
  } catch (error: any) {
    console.error("Generate blocks error:", error?.message);
    return Response.json({ error: "Internal server error" }, { status: 500 });
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

// ── helpers ───────────────────────────────────────────────────
function generateScheduledBlocks(
  defs: any[], objectiveId: string, dreamId: string, userId: string, bestTime: string
) {
  const dayMap: Record<string, number> = {
    sunday: 0, monday: 1, tuesday: 2, wednesday: 3,
    thursday: 4, friday: 5, saturday: 6,
    domingo: 0, segunda: 1, terça: 2, quarta: 3,
    quinta: 4, sexta: 5, sábado: 6,
  };
  const timeMap: Record<string, number> = {
    manhã: 9, morning: 9,
    "meio-dia": 12, afternoon: 14, tarde: 15,
    noite: 20, evening: 19, night: 20,
  };

  const hour = timeMap[bestTime?.toLowerCase()] ?? 9;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return defs.map((def, idx) => {
    const targetDay = dayMap[def.day_of_week?.toLowerCase()] ?? (1 + (idx % 5));
    const weekOffset = Math.max(0, (def.week || 1) - 1);
    const baseDate = new Date(today);
    baseDate.setDate(baseDate.getDate() + 1 + weekOffset * 7);

    // Ajustar para o dia da semana correcto
    const currentDay = baseDate.getDay();
    const daysUntil = (targetDay - currentDay + 7) % 7;
    baseDate.setDate(baseDate.getDate() + daysUntil);
    baseDate.setHours(hour, 0, 0, 0);

    return {
      objective_id: objectiveId,
      dream_id: dreamId,
      user_id: userId,
      title: def.title,
      description: def.description || null,
      resource_url: def.resource_url || null,
      resource_name: def.resource_name || null,
      session_type: def.session_type || "practice",
      duration_minutes: def.duration_minutes || 30,
      scheduled_at: baseDate.toISOString(),
      status: "scheduled",
      is_critical: def.is_critical || idx === 0,
      phase_number: def.week || 1,
      week_number: def.week || 1,
    };
  });
}
