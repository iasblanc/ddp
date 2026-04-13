// @ts-nocheck
export const dynamic = "force-dynamic";
import { createClient } from "@/lib/supabase/server";

// Rota pública — acesso via token
export async function GET(request: Request, { params }: { params: { token: string } }) {
  try {
    const supabase = createClient();

    const { data: witness } = await supabase
      .from("witnesses")
      .select("*, dreams(title, status, plan_data)")
      .eq("token", params.token)
      .eq("is_active", true)
      .single();

    if (!witness) return Response.json({ error: "Not found" }, { status: 404 });

    // Progresso — apenas dados públicos (sem conversas)
    const { count: completed } = await supabase
      .from("blocks").select("id", { count: "exact" })
      .eq("dream_id", witness.dream_id).eq("status", "completed");

    const { count: total } = await supabase
      .from("blocks").select("id", { count: "exact" })
      .eq("dream_id", witness.dream_id).neq("status", "skipped");

    // Streak
    const { data: recentBlocks } = await supabase
      .from("blocks").select("completed_at")
      .eq("dream_id", witness.dream_id).eq("status", "completed")
      .order("completed_at", { ascending: false }).limit(30);

    const streak = calculateStreak(recentBlocks || []);

    // Próximo marco (próxima fase do plano)
    const plan = witness.dreams?.plan_data;
    const nextPhase = plan?.phases?.[0]?.name || null;

    return Response.json({
      dream_title: witness.dreams?.title,
      dream_status: witness.dreams?.status,
      witness_name: witness.witness_name,
      progress: total ? Math.round(((completed || 0) / total) * 100) : 0,
      blocks_completed: completed || 0,
      streak,
      next_milestone: nextPhase,
      messages: witness.messages || [],
    });
  } catch {
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}

// Testemunha envia mensagem de apoio
export async function POST(request: Request, { params }: { params: { token: string } }) {
  try {
    const supabase = createClient();

    const { data: witness } = await supabase
      .from("witnesses").select("*")
      .eq("token", params.token).eq("is_active", true).single();

    if (!witness) return Response.json({ error: "Not found" }, { status: 404 });

    const { message } = await request.json();
    if (!message?.trim()) return Response.json({ error: "Message required" }, { status: 400 });

    const newMessage = {
      content: message.trim(),
      from: witness.witness_name,
      timestamp: new Date().toISOString(),
    };

    const messages = [...(witness.messages || []), newMessage];
    await supabase.from("witnesses").update({ messages }).eq("id", witness.id);

    // Notificação push para o dono do sonho
    const { data: userProfile } = await supabase
      .from("users").select("push_subscription").eq("id", witness.user_id).single();

    if (userProfile?.push_subscription && process.env.VAPID_PRIVATE_KEY) {
      try {
        const webpush = await import("web-push");
        webpush.setVapidDetails(
          "mailto:esj.iasblanc@gmail.com",
          process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
          process.env.VAPID_PRIVATE_KEY!
        );
        await webpush.sendNotification(
          userProfile.push_subscription,
          JSON.stringify({
            title: `${witness.witness_name} está contigo`,
            body: message.trim().slice(0, 80),
            url: "/dashboard",
          })
        );
      } catch {}
    }

    return Response.json({ success: true });
  } catch {
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}

function calculateStreak(blocks: any[]): number {
  if (!blocks.length) return 0;
  let streak = 0;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  let checkDate = new Date(today);

  for (const block of blocks) {
    const blockDate = new Date(block.completed_at);
    blockDate.setHours(0, 0, 0, 0);
    const diff = Math.round((checkDate.getTime() - blockDate.getTime()) / (1000 * 60 * 60 * 24));
    if (diff <= 1) { streak++; checkDate = blockDate; }
    else break;
  }
  return streak;
}
