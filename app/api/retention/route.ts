// @ts-nocheck
export const dynamic = "force-dynamic";
import Anthropic from "@anthropic-ai/sdk";
// ── PROTOCOLO DE INACTIVIDADE DE NORTH ───────────────────────
// Chamado por cron job (Vercel Cron ou n8n)
// Detecta utilizadores inactivos e envia mensagem contextual

import { createClient } from "@/lib/supabase/server";


export async function POST(request: Request) {
  try {
    // Verificar chave de cron
    const auth = request.headers.get("authorization");
    if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = createClient();
    const now = new Date();

    // Buscar utilizadores com sonho activo e sem actividade recente
    const { data: inactiveUsers } = await supabase
      .from("users")
      .select(`
        id, email, push_subscription,
        dreams!inner(id, title, status),
        blocks(scheduled_at, status, updated_at)
      `)
      .eq("dreams.status", "active")
      .order("updated_at", { ascending: true });

    const results = { contacted: 0, skipped: 0 };

    for (const user of (inactiveUsers || [])) {
      const lastActivity = await getLastActivity(supabase, user.id);
      const daysSince = Math.floor((now.getTime() - lastActivity.getTime()) / (1000 * 60 * 60 * 24));

      // Protocolo: dia 3, depois 48h sem resposta → silêncio 7 dias
      if (daysSince === 3 || daysSince === 5) {
        const alreadyContacted = await wasRecentlyContacted(supabase, user.id, 2);
        if (alreadyContacted) { results.skipped++; continue; }

        const message = await generateInactivityMessage(user, daysSince);
        await sendInactivityMessage(supabase, user, message, daysSince);
        await recordContact(supabase, user.id, daysSince);
        results.contacted++;
      }
    }

    return Response.json(results);
  } catch (error) {
    console.error("Retention error:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}

async function getLastActivity(supabase: any, userId: string): Promise<Date> {
  const { data } = await supabase
    .from("blocks")
    .select("updated_at")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false })
    .limit(1)
    .single();

  if (data?.updated_at) return new Date(data.updated_at);

  // Fallback: data de criação da conta
  const { data: user } = await supabase.from("users").select("created_at").eq("id", userId).single();
  return user?.created_at ? new Date(user.created_at) : new Date();
}

async function wasRecentlyContacted(supabase: any, userId: string, days: number): Promise<boolean> {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
  const { data } = await supabase
    .from("conversations")
    .select("id")
    .eq("user_id", userId)
    .eq("type", "crisis")
    .gte("created_at", since)
    .limit(1);
  return (data?.length || 0) > 0;
}

async function generateInactivityMessage(user: any, daysSince: number): Promise<string> {
  const isFirstContact = daysSince === 3;
  const dreamTitle = user.dreams?.[0]?.title || "o teu sonho";

  const prompt = `You are North. Write a SHORT inactivity message (2-3 sentences max).

DAYS SINCE LAST ACTIVITY: ${daysSince}
IS FIRST CONTACT: ${isFirstContact}
DREAM: "${dreamTitle}"

Rules for day 3 (first contact):
- Do NOT mention the dream or missed blocks
- Be present, not accusatory
- Example: "Oi. Não precisei de você esses dias, mas pensei em como você estava. Está tudo bem?"

Rules for day 5 (second contact, if no response):
- Acknowledge the dream exists, no pressure
- Example: "Seu sonho ainda está aqui. Sem pressa. Quando quiser, é só aparecer."

Language: Portuguese (pt-BR). Return ONLY the message text.`;

  const response = await new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY }).messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 100,
    messages: [{ role: "user", content: prompt }],
  });

  return response.content[0].type === "text"
    ? response.content[0].text.trim()
    : "Oi. Estava pensando em você. Tudo bem?";
}

async function sendInactivityMessage(supabase: any, user: any, message: string, daysSince: number) {
  // Guardar como conversa de crise no histórico
  await supabase.from("conversations").insert({
    user_id: user.id,
    dream_id: user.dreams?.[0]?.id || null,
    type: "crisis",
    messages: [{ role: "assistant", content: message, timestamp: new Date().toISOString(), automated: true }],
    tokens_used: 0,
    model_used: "claude-haiku-4-5-20251001",
  });

  // Push notification se subscrito
  if (user.push_subscription && process.env.VAPID_PRIVATE_KEY) {
    try {
      const webpush = await import("web-push");
      webpush.setVapidDetails(
        "mailto:esj.iasblanc@gmail.com",
        process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
        process.env.VAPID_PRIVATE_KEY!
      );
      await webpush.sendNotification(
        user.push_subscription,
        JSON.stringify({ title: "North", body: message, url: "/dashboard" })
      );
    } catch (e) { console.error("Push failed:", e); }
  }
}

async function recordContact(supabase: any, userId: string, daysSince: number) {
  await supabase.from("users").update({
    last_inactivity_contact: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }).eq("id", userId);
}

// GET — verificar inactividade do utilizador actual
export async function GET(request: Request) {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const lastActivity = await getLastActivity(supabase, user.id);
    const daysSince = Math.floor((Date.now() - lastActivity.getTime()) / (1000 * 60 * 60 * 24));

    // Buscar mensagens de North não lidas
    const { data: unread } = await supabase
      .from("conversations")
      .select("id, messages, created_at")
      .eq("user_id", user.id)
      .eq("type", "crisis")
      .order("created_at", { ascending: false })
      .limit(1);

    return Response.json({
      days_since_last_activity: daysSince,
      last_activity: lastActivity.toISOString(),
      north_message: unread?.[0]?.messages?.slice(-1)[0]?.content || null,
    });
  } catch {
    return Response.json({ days_since_last_activity: 0 });
  }
}
