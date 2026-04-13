// @ts-nocheck
export const dynamic = "force-dynamic";
import { createClient } from "@/lib/supabase/server";

// GET — exportar todos os dados (LGPD)
export async function GET(request: Request) {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const [profile, dreams, blocks, conversations, memories, witnesses] = await Promise.all([
      supabase.from("users").select("*").eq("id", user.id).single(),
      supabase.from("dreams").select("*").eq("user_id", user.id),
      supabase.from("blocks").select("*").eq("user_id", user.id),
      supabase.from("conversations").select("id, type, messages, created_at").eq("user_id", user.id),
      supabase.from("dream_memories").select("dream_id, dream_profile, execution_profile, emotional_profile, created_at, updated_at").eq("user_id", user.id),
      supabase.from("witnesses").select("dream_id, witness_name, created_at").eq("user_id", user.id),
    ]);

    const exportData = {
      exported_at: new Date().toISOString(),
      user: { id: user.id, email: user.email, created_at: user.created_at },
      profile: { ...profile.data, push_subscription: undefined, stripe_customer_id: undefined },
      dreams: dreams.data || [],
      blocks: blocks.data || [],
      conversations: conversations.data || [],
      north_memories: memories.data || [],
      witnesses: witnesses.data || [],
    };

    return new Response(JSON.stringify(exportData, null, 2), {
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="ddp-dados-${user.id.slice(0, 8)}.json"`,
      },
    });
  } catch {
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}

// DELETE — apagar conta e todos os dados (LGPD)
export async function DELETE(request: Request) {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json().catch(() => ({}));
    if (body.confirm !== "APAGAR TUDO") {
      return Response.json({ error: "Confirmation required: send { confirm: 'APAGAR TUDO' }" }, { status: 400 });
    }

    // Apagar todos os dados em cascata
    await Promise.all([
      supabase.from("share_cards").delete().eq("user_id", user.id),
      supabase.from("witnesses").delete().eq("user_id", user.id),
      supabase.from("calendar_integrations").delete().eq("user_id", user.id),
    ]);
    await Promise.all([
      supabase.from("conversations").delete().eq("user_id", user.id),
      supabase.from("blocks").delete().eq("user_id", user.id),
    ]);
    await supabase.from("dream_memories").delete().eq("user_id", user.id);
    await supabase.from("dreams").delete().eq("user_id", user.id);
    await supabase.from("users").delete().eq("id", user.id);

    // Apagar conta Supabase Auth
    const adminClient = createClient();
    await adminClient.auth.admin?.deleteUser(user.id).catch(() => {});

    await supabase.auth.signOut();

    return Response.json({ deleted: true });
  } catch {
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
