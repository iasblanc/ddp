// @ts-nocheck
export const dynamic = "force-dynamic";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const dreamId = searchParams.get("dreamId");

    let query = supabase.from("objectives")
      .select("*, blocks(id, title, status, scheduled_at, duration_minutes, is_critical)")
      .eq("user_id", user.id)
      .order("order_index", { ascending: true });

    if (dreamId) query = query.eq("dream_id", dreamId);

    const { data } = await query;
    return Response.json({ objectives: data || [] });
  } catch {
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const { id, title, description, status, order_index } = await request.json();
    if (!id) return Response.json({ error: "id required" }, { status: 400 });

    const updates: Record<string, any> = {};
    if (title !== undefined) updates.title = title;
    if (description !== undefined) updates.description = description;
    if (status !== undefined) updates.status = status;
    if (order_index !== undefined) updates.order_index = order_index;

    const { data } = await supabase.from("objectives")
      .update(updates).eq("id", id).eq("user_id", user.id).select().single();

    return Response.json({ objective: data });
  } catch {
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
