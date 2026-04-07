// @ts-nocheck
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const dreamId = searchParams.get("dreamId");
    const days = parseInt(searchParams.get("days") || "7");

    let query = supabase.from("blocks").select("*, dreams(title)")
      .eq("user_id", user.id)
      .gte("scheduled_at", new Date().toISOString())
      .lte("scheduled_at", new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString())
      .order("scheduled_at", { ascending: true });

    if (dreamId) query = query.eq("dream_id", dreamId);

    const { data: blocks } = await query;
    return Response.json({ blocks: blocks || [] });
  } catch {
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json();
    const { dream_id, title, scheduled_at, duration_minutes = 30, is_critical = false } = body;

    const { data: block } = await supabase.from("blocks").insert({
      dream_id, user_id: user.id, title, scheduled_at,
      duration_minutes, is_critical, status: "scheduled",
    }).select().single();

    return Response.json({ block });
  } catch {
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
