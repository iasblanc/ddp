// @ts-nocheck
import { createClient } from "@/lib/supabase/server";
import { randomBytes } from "crypto";

export async function GET(request: Request) {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const dreamId = searchParams.get("dreamId");

    let query = supabase.from("witnesses").select("*").eq("user_id", user.id);
    if (dreamId) query = query.eq("dream_id", dreamId);
    const { data } = await query;

    return Response.json({ witnesses: data || [] });
  } catch {
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const { dreamId, witnessName } = await request.json();
    if (!dreamId) return Response.json({ error: "dreamId required" }, { status: 400 });

    // Verificar que o sonho pertence ao utilizador
    const { data: dream } = await supabase.from("dreams")
      .select("id, title, status").eq("id", dreamId).eq("user_id", user.id).single();
    if (!dream) return Response.json({ error: "Dream not found" }, { status: 404 });

    // Gerar token único
    const token = randomBytes(32).toString("hex");

    const { data: witness } = await supabase.from("witnesses").insert({
      dream_id: dreamId,
      user_id: user.id,
      witness_name: witnessName || "Testemunha",
      token: token,
      is_active: true,
    }).select().single();

    const witnessUrl = `${process.env.NEXT_PUBLIC_APP_URL}/witness/${token}`;
    return Response.json({ witness, url: witnessUrl });
  } catch {
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const { witnessId } = await request.json();
    await supabase.from("witnesses").update({ is_active: false }).eq("id", witnessId).eq("user_id", user.id);
    return Response.json({ success: true });
  } catch {
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
