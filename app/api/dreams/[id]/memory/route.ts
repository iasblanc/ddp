// @ts-nocheck
export const dynamic = "force-dynamic";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request, { params }: { params: { id: string } }) {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const { data: memory } = await supabase
      .from("dream_memories").select("*")
      .eq("dream_id", params.id).eq("user_id", user.id).single();

    return Response.json({ memory: memory || null });
  } catch {
    return Response.json({ memory: null });
  }
}
