// @ts-nocheck
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";


export async function POST(request: Request) {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const { dream } = await request.json();
    if (!dream?.trim()) return Response.json({ error: "Dream required" }, { status: 400 });

    const message = await new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY }).messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 150,
      system: `You are North — the AI of Dont Dream. Plan.
Your task: read what the user wrote about their dream and return a single reflection sentence that:
1. Captures the DEEPER meaning — not the surface desire, but the identity/transformation behind it
2. Uses the user's own words when possible
3. Ends without a period (it will be followed by "Is that right?")
4. Is between 15-25 words
5. Starts with "You want to"

Examples:
- Input: "I want to open my own restaurant"
  Output: "You want to create something with your own hands — a place that is entirely yours"

- Input: "I want to change careers, I'm tired of this"  
  Output: "You want to stop living someone else's life and finally build your own path"

- Input: "I want to write a book"
  Output: "You want to leave something real in the world — proof that what you think matters"

Return ONLY the reflection sentence. Nothing else.`,
      messages: [{ role: "user", content: dream }],
    });

    const reflection = message.content[0].type === "text"
      ? message.content[0].text.trim()
      : "You want to build something that is truly yours — and you stopped believing you would actually do it";

    return Response.json({ reflection });
  } catch (error: any) {
    console.error("Reflect API error:", error?.message || error, "| KEY_SET:", !!process.env.ANTHROPIC_API_KEY);
    return Response.json({
      reflection: "You want to build something that is truly yours — and you stopped believing you would actually do it"
    });
  }
}
