// @ts-nocheck
export const dynamic = "force-dynamic";
export const maxDuration = 60;
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) return Response.json({ error: "north_unavailable" }, { status: 503 });

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

    // Máx 12 blocos por chamada — evita timeout de 60s
    const totalBlocks = Math.min(12, Math.max(6, Number(weeks) * Number(blocksPerWeek)));

    const prompt = `You are North. Return ONLY a JSON array — no text before, no text after, no markdown.

Generate ${totalBlocks} tactical 30-minute sessions for:
OBJECTIVE: "${objective.title}"
DREAM: "${objective.dreams?.title}"
USER: level=${currentLevel}, daily time=${dailyTime}, best time=${bestTime}, deadline=${deadline}

Each item in the array:
{
  "title": "Specific task in Portuguese, max 10 words",
  "description": "What exactly to do (1 sentence, Portuguese)",
  "resource_url": "https://real-url-or-null",
  "resource_name": "Resource name or null",
  "week": 1,
  "day_of_week": "monday",
  "duration_minutes": 30,
  "is_critical": false,
  "session_type": "learn",
  "order": 0
}

session_type: learn, practice, review, or test. Vary them. Progress from basic to advanced.
Include real resource URLs (Khan Academy, YouTube, official docs).
Language: Portuguese (pt-BR).
START YOUR RESPONSE WITH [ AND END WITH ]`;

    const response = await new Anthropic({ apiKey }).messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 2500,
      messages: [{ role: "user", content: prompt }],
    });

    const rawText = response.content[0].type === "text" ? response.content[0].text : "";
    console.log("Raw response length:", rawText.length, "| First 100:", rawText.slice(0, 100));

    let blockDefs: any[] = [];
    const start = rawText.indexOf("[");
    const end = rawText.lastIndexOf("]");
    if (start !== -1 && end > start) {
      try {
        blockDefs = JSON.parse(rawText.slice(start, end + 1));
      } catch (e) {
        console.error("JSON parse failed:", (e as any)?.message);
        return Response.json({ error: "parse_failed", count: 0 }, { status: 200 });
      }
    } else {
      console.error("No JSON array found in response. Raw:", rawText.slice(0, 300));
      return Response.json({ error: "parse_failed", count: 0 }, { status: 200 });
    }

    if (!Array.isArray(blockDefs) || blockDefs.length === 0) {
      console.error("Empty array after parse");
      return Response.json({ error: "empty_result", count: 0 }, { status: 200 });
    }

    const blocks = blockDefs.map((def: any, idx: number) => {
      const dayMap: Record<string, number> = {
        sunday: 0, monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6,
        domingo: 0, segunda: 1, "terça": 2, quarta: 3, quinta: 4, sexta: 5, "sábado": 6,
      };
      const timeMap: Record<string, number> = {
        "manhã": 9, morning: 9, "meio-dia": 12, afternoon: 14, tarde: 15, noite: 20, evening: 19,
      };
      const hour = timeMap[bestTime?.toLowerCase()] ?? 9;
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const targetDay = dayMap[def.day_of_week?.toLowerCase()] ?? (1 + (idx % 5));
      const weekOffset = Math.max(0, (def.week || 1) - 1);
      const baseDate = new Date(today);
      baseDate.setDate(baseDate.getDate() + 1 + weekOffset * 7);
      const daysUntil = (targetDay - baseDate.getDay() + 7) % 7;
      baseDate.setDate(baseDate.getDate() + daysUntil);
      baseDate.setHours(hour, 0, 0, 0);

      return {
        objective_id: params.id,
        dream_id: objective.dream_id,
        user_id: user.id,
        title: def.title,
        description: def.description || null,
        resource_url: def.resource_url || null,
        resource_name: def.resource_name || null,
        session_type: def.session_type || "practice",
        duration_minutes: 30,
        scheduled_at: baseDate.toISOString(),
        status: "scheduled",
        is_critical: def.is_critical || idx === 0,
        phase_number: def.week || 1,
        week_number: def.week || 1,
      };
    });

    const { data: saved, error: insertError } = await supabase.from("blocks").insert(blocks).select();
    if (insertError) {
      console.error("Insert error:", insertError.message);
      return Response.json({ error: "insert_failed" }, { status: 500 });
    }
    await supabase.rpc("refresh_objective_progress", { p_objective_id: params.id });
    console.log("Blocks inserted:", saved?.length);
    return Response.json({ blocks: saved, count: saved?.length || 0 });

  } catch (error: any) {
    console.error("Generate blocks error:", error?.message, error?.status);
    return Response.json({ error: error?.message || "Internal server error" }, { status: 500 });
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
