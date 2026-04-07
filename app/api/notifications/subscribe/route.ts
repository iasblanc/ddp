// @ts-nocheck
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
    const { subscription } = await request.json();
    if (!subscription?.endpoint) return Response.json({ error: "Invalid" }, { status: 400 });
    await supabase.from("users").update({ push_subscription: subscription }).eq("id", user.id);
    return Response.json({ success: true });
  } catch {
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
    await supabase.from("users").update({ push_subscription: null }).eq("id", user.id);
    return Response.json({ success: true });
  } catch {
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
