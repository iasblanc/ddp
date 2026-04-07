// @ts-nocheck
import { createClient } from "@/lib/supabase/server";

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json();
    const { status, scheduled_at, notes } = body;
    const updates: Record<string, any> = { updated_at: new Date().toISOString() };

    if (status) updates.status = status;
    if (scheduled_at) updates.scheduled_at = scheduled_at;
    if (notes !== undefined) updates.notes = notes;
    if (status === "completed") updates.completed_at = new Date().toISOString();

    // Actualizar contador free_blocks se completado
    if (status === "completed") {
      await supabase.rpc("increment_free_blocks_used", { p_user_id: user.id }).catch(() => {});
    }

    const { data: block } = await supabase.from("blocks")
      .update(updates).eq("id", params.id).eq("user_id", user.id).select().single();

    return Response.json({ block });
  } catch {
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
