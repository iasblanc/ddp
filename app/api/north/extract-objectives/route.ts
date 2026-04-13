// @ts-nocheck
export const dynamic = "force-dynamic";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  try {
    if (!process.env.ANTHROPIC_API_KEY) {
      return Response.json({ error: "north_unavailable" }, { status: 503 });
    }

    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const { dreamId, dreamTitle, dreamReflection, deadline, timeAvailable, obstacle } = await request.json();
    if (!dreamId || !dreamTitle) return Response.json({ error: "dreamId and dreamTitle required" }, { status: 400 });

    const prompt = `You are North — the AI of Dont Dream. Plan.

The user has a dream: "${dreamTitle}"
${dreamReflection ? `Deeper meaning: "${dreamReflection}"` : ""}
${deadline ? `Timeline: ${deadline}` : ""}
${timeAvailable ? `Daily time available: ${timeAvailable}` : ""}
${obstacle ? `Main obstacle: "${obstacle}"` : ""}

Your task: decompose this dream into 3-6 concrete MACRO OBJECTIVES.

Each macro objective must be:
- A specific, measurable pillar that, when achieved, makes the dream real
- Phrased as a concrete outcome (not a process)
- Ordered logically (earlier objectives enable later ones)
- Distinct from each other (no overlap)

Respond ONLY with a valid JSON array, no markdown, no explanation:
[
  {
    "title": "Short objective title (max 6 words)",
    "description": "One sentence: what achieving this looks like concretely",
    "why": "One sentence: why this is essential to the dream",
    "order_index": 0,
    "estimated_weeks": 4,
    "blocks_per_week": 3
  }
]

Language: Portuguese (pt-BR). Return ONLY the JSON array.`;

    const response = await new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY }).messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 1200,
      messages: [{ role: "user", content: prompt }],
    });

    const text = response.content[0].type === "text" ? response.content[0].text.trim() : "[]";
    const cleaned = text.replace(/```json|```/g, "").trim();
    const objectives = JSON.parse(cleaned);

    // Persistir objectivos na DB
    const rows = objectives.map((obj: any, idx: number) => ({
      dream_id: dreamId,
      user_id: user.id,
      title: obj.title,
      description: obj.description || null,
      why: obj.why || null,
      order_index: obj.order_index ?? idx,
    }));

    const { data: saved, error } = await supabase
      .from("objectives")
      .insert(rows)
      .select();

    if (error) throw error;

    return Response.json({ objectives: saved, raw: objectives });
  } catch (error: any) {
    console.error("Extract objectives error:", error?.message);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
