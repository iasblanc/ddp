// @ts-nocheck
import { createClient } from "@/lib/supabase/server";
import webpush from "web-push";

// Configurar VAPID (chaves geradas pelo Supabase ou manuais)
const VAPID_PUBLIC = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || "";
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY || "";

if (VAPID_PUBLIC && VAPID_PRIVATE) {
  webpush.setVapidDetails(
    "mailto:esj.iasblanc@gmail.com",
    VAPID_PUBLIC,
    VAPID_PRIVATE
  );
}

export async function POST(request: Request) {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const { userId, title, body, url } = await request.json();
    const targetId = userId || user.id;

    // Buscar subscription do utilizador
    const { data: profile } = await supabase.from("users")
      .select("push_subscription").eq("id", targetId).single();

    if (!profile?.push_subscription) {
      return Response.json({ error: "no_subscription" }, { status: 400 });
    }

    if (!VAPID_PUBLIC || !VAPID_PRIVATE) {
      return Response.json({ error: "VAPID not configured" }, { status: 500 });
    }

    const payload = JSON.stringify({ title, body, url: url || "/" });
    await webpush.sendNotification(profile.push_subscription, payload);

    return Response.json({ sent: true });
  } catch (error: any) {
    console.error("Push notification error:", error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}
