// @ts-nocheck
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const dreamId = searchParams.get("dreamId");

    if (!dreamId) return Response.json({ error: "dreamId required" }, { status: 400 });

    const { data: memory } = await supabase
      .from("dream_memories").select("*")
      .eq("dream_id", dreamId).eq("user_id", user.id).single();

    return Response.json({ memory: memory || null });
  } catch (error) {
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const dreamId = searchParams.get("dreamId");

    if (!dreamId) return Response.json({ error: "dreamId required" }, { status: 400 });

    // Reset memory — manter registo mas limpar perfis
    await supabase.from("dream_memories")
      .update({
        dream_profile: {
          dream_declared: null, dream_real: null, deadline_declared: null,
          deadline_calibrated: null, obstacle_declared: null, obstacle_real: null,
          recurring_words: [], previous_attempts: [],
        },
        execution_profile: {
          declared_times: [], real_times: [], strong_days: [], weak_days: [],
          avg_real_duration: 30, current_streak: 0, best_streak: 0, abandonment_pattern: null,
        },
        emotional_profile: {
          preferred_tone: "direct", reacts_badly_to: [], reacts_well_to: [],
          crisis_moments: [], abandonment_triggers: [], resistance_language: [],
        },
        conversation_summaries: [],
        updated_at: new Date().toISOString(),
      })
      .eq("dream_id", dreamId).eq("user_id", user.id);

    return Response.json({ reset: true });
  } catch (error) {
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
