// @ts-nocheck
export const dynamic = "force-dynamic";
export const maxDuration = 60;
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  try {
    if (!process.env.ANTHROPIC_API_KEY)
      return Response.json({ error: "north_unavailable" }, { status: 503 });

    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const {
      dreamId, dreamTitle, dreamReflection,
      exploreContext,
      deadline, dailyTime, bestTime, currentLevel,
      mainObstacle, constraints, successMetric,
    } = await request.json();

    const prompt = `You are North — the AI of Dont Dream. Plan.

USER CONTEXT:
- Dream: "${dreamTitle}"
- Deeper meaning: "${dreamReflection || "wants to build something real"}"
- Exploration insights: "${exploreContext || "not available"}"
- Timeline: ${deadline || "not specified"}
- Daily time available: ${dailyTime || "not specified"}
- Best time of day: ${bestTime || "morning"}
- Current level/starting point: "${currentLevel || "beginner"}"
- Main obstacle: "${mainObstacle || "not specified"}"
- Constraints: "${constraints || "none specified"}"
- Success metric: "${successMetric || "not specified"}"

TASK: Decompose this dream into 3-7 concrete MACRO OBJECTIVES.

Rules:
- Each objective is a measurable PILLAR — a major capability or milestone
- Ordered logically: earlier objectives enable later ones
- Each objective should take 2-8 weeks of consistent 30-min sessions
- Must be specific to THIS dream, not generic
- Realistic given the daily time and timeline provided

Return ONLY valid JSON array, no markdown:
[
  {
    "title": "Specific objective title (max 7 words, action-oriented)",
    "description": "What achieving this looks like in concrete terms (1-2 sentences)",
    "why": "Why this is essential — what breaks without it (1 sentence)",
    "order_index": 0,
    "estimated_weeks": 4,
    "blocks_per_week": 3,
    "priority": "high"
  }
]

Language: Portuguese (pt-BR). Be specific to the dream context.`;

    const response = await new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! }).messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1500,
      messages: [{ role: "user", content: prompt }],
    });

    const rawText = response.content[0].type === "text" ? response.content[0].text : "[]";
    let objectives: any[] = [];
    try {
      const start = rawText.indexOf("[");
      const end   = rawText.lastIndexOf("]");
      if (start !== -1 && end !== -1 && end > start) {
        objectives = JSON.parse(rawText.slice(start, end + 1));
      } else {
        objectives = JSON.parse(rawText.replace(/```json|```/g, "").trim());
      }
    } catch (parseErr) {
      console.error("Extract objectives parse error:", (parseErr as any)?.message);
      console.error("Raw (first 500):", rawText.slice(0, 500));
      return Response.json({ error: "parse_failed", objectives: [] }, { status: 200 });
    }

    const rows = objectives.map((obj: any, idx: number) => ({
      dream_id: dreamId,
      user_id: user.id,
      title: obj.title,
      description: obj.description || null,
      why: obj.why || null,
      order_index: obj.order_index ?? idx,
    }));

    const { data: saved, error } = await supabase.from("objectives").insert(rows).select();
    if (error) throw error;

    return Response.json({ objectives: saved, raw: objectives });
  } catch (error: any) {
    console.error("Extract objectives error:", error?.message);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
