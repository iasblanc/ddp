// @ts-nocheck
export const dynamic = "force-dynamic";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request, { params }: { params: { id: string } }) {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const { data: block } = await supabase
      .from("blocks").select("*, dreams(title, id)")
      .eq("id", params.id).eq("user_id", user.id).single();

    if (!block) return Response.json({ error: "Not found" }, { status: 404 });
    return Response.json({ block });
  } catch {
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json();
    const updates: Record<string, any> = { updated_at: new Date().toISOString() };

    if (body.status) updates.status = body.status;
    if (body.scheduled_at) updates.scheduled_at = body.scheduled_at;
    if (body.notes !== undefined) updates.notes = body.notes;
    if (body.status === "completed") {
      updates.completed_at = new Date().toISOString();
      // Incrementar contador free_blocks
      await supabase.rpc("increment_free_blocks_used", { p_user_id: user.id }).catch(() => {});
    }

    const { data: block } = await supabase
      .from("blocks").update(updates).eq("id", params.id).eq("user_id", user.id).select().single();

    return Response.json({ block });
  } catch {
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
