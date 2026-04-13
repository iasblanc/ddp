// @ts-nocheck
export const dynamic = "force-dynamic";
import { createClient } from "@/lib/supabase/server";
import { detectMaturityStage } from "@/lib/north/prompt-builder";

export async function GET(request: Request) {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const { data: dreams } = await supabase
      .from("dreams")
      .select("*, dream_memories(dream_profile, execution_profile, emotional_profile)")
      .eq("user_id", user.id)
      .order("position", { ascending: true })
      .order("created_at", { ascending: false });

    // Contar blocos por sonho
    const dreamsWithProgress = await Promise.all(
      (dreams || []).map(async (dream: any) => {
        const { count: completed } = await supabase
          .from("blocks")
          .select("id", { count: "exact" })
          .eq("dream_id", dream.id)
          .eq("status", "completed");

        const { count: total } = await supabase
          .from("blocks")
          .select("id", { count: "exact" })
          .eq("dream_id", dream.id)
          .neq("status", "skipped");

        return {
          ...dream,
          blocks_completed: completed || 0,
          blocks_total: total || 0,
          progress: total ? Math.round(((completed || 0) / total) * 100) : 0,
        };
      })
    );

    return Response.json({ dreams: dreamsWithProgress });
  } catch (error) {
    console.error("Dreams GET error:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json();
    const { title, description, declared_deadline, time_available } = body;

    if (!title?.trim()) {
      return Response.json({ error: "Title required" }, { status: 400 });
    }

    // Verificar se já existe sonho activo
    const { data: activeDream } = await supabase
      .from("dreams")
      .select("id, title")
      .eq("user_id", user.id)
      .eq("status", "active")
      .single();

    // Detectar estágio de maturidade
    const maturityStage = detectMaturityStage(title + " " + (description || ""));

    // Determinar status inicial
    const shouldBeActive = !activeDream && maturityStage === 3;
    const status = shouldBeActive ? "active" : maturityStage === 3 ? "queued" : "maturing";

    // Próxima posição na fila
    const { count: queueCount } = await supabase
      .from("dreams")
      .select("id", { count: "exact" })
      .eq("user_id", user.id)
      .eq("status", "queued");

    const { data: dream, error } = await supabase
      .from("dreams")
      .insert({
        user_id: user.id,
        title: title.trim(),
        description: description || null,
        status,
        maturity_stage: maturityStage,
        declared_deadline: declared_deadline || null,
        position: status === "queued" ? (queueCount || 0) : 0,
        activated_at: shouldBeActive ? new Date().toISOString() : null,
      })
      .select()
      .single();

    if (error) throw error;

    // Criar memória inicial
    await supabase.from("dream_memories").insert({
      dream_id: dream.id,
      user_id: user.id,
      dream_profile: {
        dream_declared: title.trim(),
        dream_real: null,
        deadline_declared: declared_deadline || null,
        deadline_calibrated: null,
        obstacle_declared: null,
        obstacle_real: null,
        recurring_words: [],
        previous_attempts: [],
        last_updated: new Date().toISOString(),
      },
      execution_profile: {
        declared_times: time_available ? [time_available] : [],
        real_times: [],
        strong_days: [],
        weak_days: [],
        avg_real_duration: 30,
        current_streak: 0,
        best_streak: 0,
        abandonment_pattern: null,
      },
      emotional_profile: {
        preferred_tone: "direct",
        reacts_badly_to: [],
        reacts_well_to: [],
        crisis_moments: [],
        abandonment_triggers: [],
        resistance_language: [],
      },
      conversation_summaries: [],
    });

    return Response.json({ dream, warning: activeDream ? "queued_active_exists" : null });
  } catch (error) {
    console.error("Dreams POST error:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
