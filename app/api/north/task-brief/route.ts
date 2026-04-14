// @ts-nocheck
export const dynamic = "force-dynamic";
export const maxDuration = 30;
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  try {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) return Response.json({ error: "north_unavailable" }, { status: 503 });

    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const { blockId } = await request.json();

    // Buscar bloco + objectivo + sonho + memória
    const { data: block } = await supabase
      .from("blocks")
      .select("*, objectives(title, description, why, dreams(title))")
      .eq("id", blockId).eq("user_id", user.id).single();

    if (!block) return Response.json({ error: "Not found" }, { status: 404 });

    const objective = block.objectives;
    const dream     = objective?.dreams;

    const prompt = `You are North. Generate a rich task briefing for this 30-minute work session.

DREAM: "${dream?.title || "—"}"
OBJECTIVE: "${objective?.title || "—"}"
WHY THIS OBJECTIVE: "${objective?.why || objective?.description || "—"}"
TASK: "${block.title}"
DESCRIPTION: "${block.description || "not specified"}"
SESSION TYPE: ${block.session_type || "practice"}
RESOURCE: ${block.resource_url ? `${block.resource_name || "link"} (${block.resource_url})` : "none"}

Generate a briefing with these EXACT sections. Keep each section SHORT and SPECIFIC.
Respond in JSON only, no markdown:

{
  "mission": "2-3 sentences: what this 30-minute session is about and why it matters right now in the journey",
  "steps": [
    "Step 1: specific action (max 15 words)",
    "Step 2: specific action (max 15 words)",
    "Step 3: specific action (max 15 words)"
  ],
  "prepare": [
    "Item needed before starting (max 10 words)",
    "Another item if relevant"
  ],
  "expected_outcome": "One sentence: what you will have at the end of these 30 minutes",
  "north_tip": "One practical tip specific to this task — something most people miss (max 20 words)",
  "difficulty": "easy|medium|hard",
  "focus_word": "One word that captures the essence of this session"
}

Language: Portuguese (pt-BR). Be specific to THIS task, not generic.`;

    const response = await new Anthropic({ apiKey }).messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 800,
      messages: [{ role: "user", content: prompt }],
    });

    const raw = response.content[0].type === "text" ? response.content[0].text : "{}";
    const start = raw.indexOf("{");
    const end   = raw.lastIndexOf("}");
    let brief: any = {};
    if (start !== -1 && end > start) {
      try { brief = JSON.parse(raw.slice(start, end + 1)); }
      catch { brief = {}; }
    }

    return Response.json({
      brief,
      block: {
        id: block.id,
        title: block.title,
        description: block.description,
        resource_url: block.resource_url,
        resource_name: block.resource_name,
        session_type: block.session_type,
        duration_minutes: block.duration_minutes,
        is_critical: block.is_critical,
        dream_id: block.dream_id,
      },
      objective: objective ? {
        title: objective.title,
        why: objective.why || objective.description,
      } : null,
      dream: dream ? { title: dream.title } : null,
    });
  } catch (error: any) {
    console.error("Task brief error:", error?.message);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
