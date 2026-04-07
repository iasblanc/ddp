// @ts-nocheck
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const { dreamId, milestoneType } = await request.json();

    const { data: dream } = await supabase
      .from("dreams").select("title, status").eq("id", dreamId).eq("user_id", user.id).single();
    if (!dream) return Response.json({ error: "Not found" }, { status: 404 });

    const { count: completed } = await supabase
      .from("blocks").select("id", { count: "exact" })
      .eq("dream_id", dreamId).eq("status", "completed");

    const { data: firstBlock } = await supabase
      .from("blocks").select("completed_at")
      .eq("dream_id", dreamId).eq("status", "completed")
      .order("completed_at", { ascending: true }).limit(1).single();

    const daysWorking = firstBlock?.completed_at
      ? Math.floor((Date.now() - new Date(firstBlock.completed_at).getTime()) / (1000 * 60 * 60 * 24))
      : 0;

    const hoursInvested = Math.round((completed || 0) * 0.5);

    const card = {
      dream_title: dream.title,
      blocks_completed: completed || 0,
      hours_invested: hoursInvested,
      days_working: daysWorking,
      milestone_type: milestoneType || (dream.status === "completed" ? "completed" : "progress"),
      hashtag: "#DontDreamPlan",
    };

    // Guardar card
    const { data: shareCard } = await supabase.from("share_cards").insert({
      dream_id: dreamId,
      user_id: user.id,
      card_data: card,
      milestone_type: card.milestone_type,
    }).select("id").single();

    return Response.json({ card, shareId: shareCard?.id });
  } catch {
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
