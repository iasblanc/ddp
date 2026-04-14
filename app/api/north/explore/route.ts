// @ts-nocheck
export const dynamic = "force-dynamic";
export const maxDuration = 30;
import Anthropic from "@anthropic-ai/sdk";

export async function POST(request: Request) {
  try {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) return Response.json({ question: null }, { status: 503 });

    const { dream, reflection, history, questionIndex } = await request.json();
    // history = [{role, content}] da conversa até agora
    // questionIndex = quantas perguntas já foram feitas (0-5)

    const systemPrompt = `You are North — the AI of Dont Dream. Plan.

You are in the dream exploration phase. The user has shared their dream and confirmed your reflection.
Now your job is to ask ONE precise question to deeply understand this dream before building any plan.

Your questions should progressively uncover:
- Q0-1: The real "why" behind the dream (emotional root, identity)
- Q2: What has been tried before and why it didn't work
- Q3: What success looks like in concrete detail (not generic)
- Q4: What specifically is blocking right now (fear, uncertainty, resource)
- Q5: What will change in their life when this becomes real

Rules:
- ONE question per message. Never two.
- Never generic ("tell me more"). Always specific to what they said.
- Reference their exact words from the conversation
- Short sentences. Max 15 words per sentence.
- Do NOT repeat a question already asked
- If questionIndex >= 5, respond with exactly: ENOUGH_CONTEXT
- Language: Portuguese (pt-BR)
- Style: calm, present, curious — not interrogating`;

    const messages = [
      { role: "user", content: `Dream: "${dream}"\nReflection confirmed: "${reflection}"\nQuestion index: ${questionIndex}` },
      ...history.map((h: any) => ({ role: h.role === "north" ? "assistant" : "user", content: h.content })),
      { role: "user", content: questionIndex >= 5 ? "Is that enough context?" : "Ask me the next question." }
    ];

    const response = await new Anthropic({ apiKey }).messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 200,
      system: systemPrompt,
      messages,
    });

    const text = response.content[0].type === "text" ? response.content[0].text.trim() : "";
    
    if (text === "ENOUGH_CONTEXT" || questionIndex >= 5) {
      return Response.json({ question: null, done: true });
    }

    return Response.json({ question: text, done: false });
  } catch (error: any) {
    console.error("Explore error:", error?.message);
    return Response.json({ question: null }, { status: 500 });
  }
}
