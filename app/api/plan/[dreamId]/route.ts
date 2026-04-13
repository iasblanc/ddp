// @ts-nocheck
export const dynamic = "force-dynamic";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request, { params }: { params: { dreamId: string } }) {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const { data: dream } = await supabase
      .from("dreams")
      .select("id, title, status, plan_data, plan_generated_at, declared_deadline")
      .eq("id", params.dreamId).eq("user_id", user.id).single();

    if (!dream) return Response.json({ error: "Not found" }, { status: 404 });

    // Blocos das próximas 4 semanas
    const { data: blocks } = await supabase
      .from("blocks")
      .select("*")
      .eq("dream_id", params.dreamId).eq("user_id", user.id)
      .gte("scheduled_at", new Date().toISOString())
      .order("scheduled_at", { ascending: true })
      .limit(20);

    // Stats
    const { count: completedCount } = await supabase
      .from("blocks")
      .select("id", { count: "exact" })
      .eq("dream_id", params.dreamId).eq("status", "completed");

    return Response.json({ dream, blocks: blocks || [], completed: completedCount || 0 });
  } catch {
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
