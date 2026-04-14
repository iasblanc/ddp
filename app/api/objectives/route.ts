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

    const { data: objectives } = await query;

    // Incluir blocos sem objectivo como grupo "Geral"
    if (dreamId) {
      const { data: orphanBlocks } = await supabase
        .from("blocks")
        .select("id, title, status, scheduled_at, duration_minutes, is_critical, session_type, description, resource_url, resource_name")
        .eq("dream_id", dreamId)
        .eq("user_id", user.id)
        .is("objective_id", null)
        .order("scheduled_at", { ascending: true });

      if (orphanBlocks && orphanBlocks.length > 0) {
        const generalObj = {
          id: "general",
          dream_id: dreamId,
          title: "Blocos Gerais",
          description: "Tarefas não associadas a um objectivo macro específico",
          why: null,
          order_index: -1,
          status: "active",
          blocks: orphanBlocks,
          blocks_count: orphanBlocks.length,
          blocks_completed: orphanBlocks.filter((b: any) => b.status === "completed").length,
        };
        return Response.json({ objectives: [generalObj, ...(objectives || [])] });
      }
    }

    return Response.json({ objectives: objectives || [] });
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
