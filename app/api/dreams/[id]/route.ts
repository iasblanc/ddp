// @ts-nocheck
import { createClient } from "@/lib/supabase/server";

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json();
    const { status, title, description, declared_deadline } = body;
    const dreamId = params.id;

    const { data: dream } = await supabase
      .from("dreams").select("*").eq("id", dreamId).eq("user_id", user.id).single();
    if (!dream) return Response.json({ error: "Dream not found" }, { status: 404 });

    const updates: Record<string, any> = { updated_at: new Date().toISOString() };
    if (title !== undefined) updates.title = title;
    if (description !== undefined) updates.description = description;
    if (declared_deadline !== undefined) updates.declared_deadline = declared_deadline;

    if (status && status !== dream.status) {
      updates.status = status;
      if (status === "active") {
        await supabase.from("dreams")
          .update({ status: "queued", updated_at: new Date().toISOString() })
          .eq("user_id", user.id).eq("status", "active");
        updates.activated_at = new Date().toISOString();
      }
      if (status === "completed") updates.completed_at = new Date().toISOString();
      if (status === "archived") updates.archived_at = new Date().toISOString();
      if (status === "paused") updates.paused_at = new Date().toISOString();
    }

    const { data: updated } = await supabase
      .from("dreams").update(updates).eq("id", dreamId).eq("user_id", user.id).select().single();

    return Response.json({ dream: updated });
  } catch (error) {
    console.error("Dream PATCH error:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    await supabase.from("dreams")
      .update({ status: "archived", archived_at: new Date().toISOString() })
      .eq("id", params.id).eq("user_id", user.id);

    return Response.json({ archived: true });
  } catch (error) {
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
