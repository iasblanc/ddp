// @ts-nocheck
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";


export async function POST(request: Request) {
  try {
    if (!process.env.ANTHROPIC_API_KEY) {
      console.error("Plan generate: ANTHROPIC_API_KEY not configured | KEY_SET: false");
      return Response.json({ error: "north_unavailable" }, { status: 503 });
    }

    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const { dreamId, conversationSummary, timeAvailable, deadline } = await request.json();
    if (!dreamId) return Response.json({ error: "dreamId required" }, { status: 400 });

    const { data: dream } = await supabase
      .from("dreams").select("*, dream_memories(*)").eq("id", dreamId).eq("user_id", user.id).single();
    if (!dream) return Response.json({ error: "Dream not found" }, { status: 404 });

    const memory = dream.dream_memories?.[0];
    const dreamProfile = memory?.dream_profile || {};

    // Gerar plano com Claude
    const prompt = `You are North, generating an adaptive plan for a user's dream.

DREAM: "${dream.title}"
${dream.description ? `DESCRIPTION: "${dream.description}"` : ""}
TIME AVAILABLE: ${timeAvailable || "30 minutes/day"}
TARGET DEADLINE: ${deadline || dreamProfile.deadline_calibrated || "3 months"}
REAL OBSTACLE: ${dreamProfile.obstacle_real || dreamProfile.obstacle_declared || "unknown"}
CONVERSATION SUMMARY: ${conversationSummary || "First time creating plan"}

Generate a realistic execution plan as JSON:
{
  "phases": [
    {
      "number": 1,
      "name": "Phase name",
      "duration_weeks": 2,
      "hypothesis": "assumption you are making about the user",
      "goal": "what will be achieved",
      "blocks": [
        {
          "week": 1,
          "day_of_week": "monday",
          "time_preference": "morning",
          "title": "specific action (max 8 words)",
          "duration_minutes": 30,
          "is_critical": false
        }
      ]
    }
  ],
  "total_weeks": 12,
  "calibration_hypothesis": "main assumption — state explicitly",
  "success_metric": "how we'll know it worked",
  "first_block_title": "title of the very first block (max 8 words)"
}

Rules:
- Max 3 phases
- 2-3 blocks per week per phase  
- First block MUST happen within 24 hours
- First block MUST be small enough to guarantee success
- Be specific — no vague actions like "research" or "think about"
- Return ONLY valid JSON, no markdown`;

    const response = await new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY }).messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 1500,
      messages: [{ role: "user", content: prompt }],
    });

    const text = response.content[0].type === "text" ? response.content[0].text : "";
    const cleaned = text.replace(/```json|```/g, "").trim();
    const plan = JSON.parse(cleaned);

    // Actualizar sonho com plano (não tocar em declared_deadline aqui — é date, não text)
    await supabase.from("dreams").update({
      plan_data: plan,
      plan_generated_at: new Date().toISOString(),
      status: "active",
    }).eq("id", dreamId).eq("user_id", user.id);

    // Gerar blocos concretos para as próximas 2 semanas
    const blocks = generateInitialBlocks(plan, dreamId, user.id);
    if (blocks.length > 0) {
      const { data: insertedBlocks } = await supabase.from("blocks").insert(blocks).select("id, scheduled_at, title");
      // Sincronizar primeiro bloco com Google Calendar
      if (insertedBlocks?.[0]) {
        await syncFirstBlock(supabase, user.id, insertedBlocks[0].id);
      }
    }

    return Response.json({ plan, blocks_created: blocks.length });
  } catch (error) {
    console.error("Plan generate error:", (error as any)?.message || error, "| KEY_SET:", !!process.env.ANTHROPIC_API_KEY);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}

function generateInitialBlocks(plan: any, dreamId: string, userId: string) {
  const blocks = [];
  const now = new Date();
  // Primeiro bloco: amanhã às 9h
  const firstBlock = new Date(now);
  firstBlock.setDate(firstBlock.getDate() + 1);
  firstBlock.setHours(9, 0, 0, 0);

  const phase1 = plan.phases?.[0];
  if (!phase1) return blocks;

  let currentDate = new Date(firstBlock);
  for (const blockDef of (phase1.blocks || []).slice(0, 6)) {
    // Encontrar próximo dia da semana correspondente
    const targetDay = getDayNumber(blockDef.day_of_week);
    const daysUntil = (targetDay - currentDate.getDay() + 7) % 7 || 0;
    const blockDate = new Date(currentDate);
    blockDate.setDate(blockDate.getDate() + daysUntil);
    setTimePreference(blockDate, blockDef.time_preference);

    blocks.push({
      dream_id: dreamId,
      user_id: userId,
      title: blockDef.title,
      duration_minutes: blockDef.duration_minutes || 30,
      scheduled_at: blockDate.toISOString(),
      status: "scheduled",
      is_critical: blockDef.is_critical || blocks.length === 0, // Primeiro é crítico
      phase_number: 1,
      week_number: blockDef.week || 1,
    });
    currentDate = new Date(blockDate);
    currentDate.setDate(currentDate.getDate() + 1);
  }

  // Garantir que o primeiro bloco é amanhã
  if (blocks.length > 0) {
    blocks[0].scheduled_at = firstBlock.toISOString();
    blocks[0].is_critical = true;
  }

  return blocks;
}

function getDayNumber(day: string): number {
  const days: Record<string, number> = { sunday: 0, monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6 };
  return days[day?.toLowerCase()] ?? 1;
}

function setTimePreference(date: Date, pref: string) {
  if (pref === "morning") date.setHours(9, 0, 0, 0);
  else if (pref === "afternoon") date.setHours(15, 0, 0, 0);
  else if (pref === "evening" || pref === "night") date.setHours(20, 0, 0, 0);
  else date.setHours(9, 0, 0, 0);
}

async function syncFirstBlock(supabase: any, userId: string, blockId: string) {
  try {
    await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/calendar/sync`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: "" },
      body: JSON.stringify({ blockId, action: "create" }),
    });
  } catch {}
}
