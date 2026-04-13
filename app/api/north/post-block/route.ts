// @ts-nocheck
export const dynamic = "force-dynamic";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";


export async function POST(request: Request) {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const { blockId, dreamId, completed, obstacle } = await request.json();

    const { count: blocksCompleted } = await supabase
      .from("blocks").select("id", { count: "exact" })
      .eq("user_id", user.id).eq("status", "completed");

    const prompt = `You are North. Send a SHORT post-block acknowledgment (1-2 sentences).

WHAT USER COMPLETED: "${completed}"
OBSTACLE MENTIONED: "${obstacle || "none"}"
TOTAL BLOCKS COMPLETED NOW: ${blocksCompleted || 1}

Rules:
- Max 2 sentences. 1 is often enough.
- No exclamation marks.
- No generic praise ("Que ótimo!", "Parabéns!")
- Acknowledge what was done specifically
- If obstacle mentioned: acknowledge it briefly, don't fix it now
- If milestone (5, 10, 20 blocks): note it with weight, not celebration
- Language: Portuguese (pt-BR)
- Voice: NORTH THINKS or NORTH LISTENS

Return ONLY the message text.`;

    const response = await new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! }).messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 100,
      messages: [{ role: "user", content: prompt }],
    });

    const message = response.content[0].type === "text" ? response.content[0].text.trim() : "Registrado.";

    // Trigger memory updater assincronamente se houver obstáculo
    if (obstacle && dreamId) {
      updateMemoryWithObstacle(supabase, user.id, dreamId, obstacle).catch(console.error);
    }

    return Response.json({ message });
  } catch (error) {
    console.error("Post-block error:", error);
    return Response.json({ message: "Registrado." });
  }
}

async function updateMemoryWithObstacle(supabase: any, userId: string, dreamId: string, obstacle: string) {
  const { data: memory } = await supabase.from("dream_memories").select("execution_profile")
    .eq("dream_id", dreamId).eq("user_id", userId).single();
  if (!memory) return;

  const profile = memory.execution_profile || {};
  const pattern = profile.abandonment_pattern || "";
  if (obstacle && !pattern.includes(obstacle.slice(0, 20))) {
    await supabase.from("dream_memories").update({
      execution_profile: { ...profile, abandonment_pattern: pattern ? `${pattern}; ${obstacle}` : obstacle },
    }).eq("dream_id", dreamId).eq("user_id", userId);
  }
}
