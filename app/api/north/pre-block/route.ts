// @ts-nocheck
export const dynamic = "force-dynamic";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";


export async function POST(request: Request) {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const { blockId, dreamId, blockTitle } = await request.json();

    // Buscar memória e contexto
    let memory = null;
    if (dreamId) {
      const { data } = await supabase.from("dream_memories").select("*")
        .eq("dream_id", dreamId).eq("user_id", user.id).single();
      memory = data;
    }

    const { count: blocksCompleted } = await supabase
      .from("blocks").select("id", { count: "exact" })
      .eq("user_id", user.id).eq("status", "completed");

    const isFirst = (blocksCompleted || 0) === 0;

    const prompt = `You are North. Send a SHORT pre-block message (1-3 sentences max).

BLOCK TITLE: "${blockTitle}"
IS FIRST BLOCK EVER: ${isFirst}
DREAM: "${memory?.dream_profile?.dream_declared || "their dream"}"
BLOCKS COMPLETED SO FAR: ${blocksCompleted || 0}

Rules:
- Max 3 sentences. Usually 1-2 is better.
- No exclamation marks.
- Voice: NORTH THINKS (clear, direct, weight 500)
- If first block: acknowledge it briefly, don't make it dramatic
- Be specific about THIS block, not generic
- End with something concrete about the task, not motivation
- Language: Portuguese (pt-BR)

Example format (adapt to context):
"Seu bloco começa em um momento. Hoje você vai [specific action]. Precisa de algo antes de começar?"

Return ONLY the message text, no JSON, no quotes.`;

    const response = await new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! }).messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 150,
      messages: [{ role: "user", content: prompt }],
    });

    const message = response.content[0].type === "text" ? response.content[0].text.trim() : "Seu bloco começa agora. Só aparecer.";

    return Response.json({ message });
  } catch (error) {
    console.error("Pre-block error:", error);
    return Response.json({ message: "Seu bloco está pronto. Pode começar." });
  }
}
