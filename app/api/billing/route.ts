// @ts-nocheck
import { createClient } from "@/lib/supabase/server";

// Inicializar Stripe de forma lazy (só em runtime, nunca em build time)
function getStripe() {
  const Stripe = require("stripe");
  return new Stripe(process.env.STRIPE_SECRET_KEY || "sk_placeholder", { apiVersion: "2024-06-20" });
}

export async function POST(request: Request) {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    if (!process.env.STRIPE_SECRET_KEY) {
      return Response.json({ error: "Stripe not configured" }, { status: 503 });
    }

    const stripe = getStripe();
    const { priceId, interval } = await request.json();
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://ddp-phi.vercel.app";

    const { data: profile } = await supabase
      .from("users").select("stripe_customer_id, email").eq("id", user.id).single();

    let customerId = profile?.stripe_customer_id;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email || profile?.email,
        metadata: { supabase_user_id: user.id },
      });
      customerId = customer.id;
      await supabase.from("users").update({ stripe_customer_id: customerId }).eq("id", user.id);
    }

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ["card"],
      line_items: [{ price: priceId, quantity: 1 }],
      mode: "subscription",
      success_url: `${appUrl}/dashboard?upgraded=true`,
      cancel_url: `${appUrl}/upgrade`,
      metadata: { supabase_user_id: user.id },
      locale: "pt-BR",
      allow_promotion_codes: true,
    });

    return Response.json({ url: session.url });
  } catch (error: any) {
    console.error("Billing error:", error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}

export async function GET(request: Request) {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const { data: profile } = await supabase
      .from("users")
      .select("subscription_status, free_blocks_used, stripe_customer_id")
      .eq("id", user.id).single();

    return Response.json({
      plan: profile?.subscription_status || "free",
      freeBlocksUsed: profile?.free_blocks_used || 0,
      hasStripe: !!profile?.stripe_customer_id,
    });
  } catch {
    return Response.json({ plan: "free", freeBlocksUsed: 0 });
  }
}

export async function DELETE(request: Request) {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    if (!process.env.STRIPE_SECRET_KEY) return Response.json({ error: "Stripe not configured" }, { status: 503 });

    const stripe = getStripe();
    const { data: profile } = await supabase
      .from("users").select("stripe_customer_id").eq("id", user.id).single();

    if (!profile?.stripe_customer_id) return Response.json({ error: "No subscription" }, { status: 400 });

    const subscriptions = await stripe.subscriptions.list({ customer: profile.stripe_customer_id, status: "active" });
    for (const sub of subscriptions.data) {
      await stripe.subscriptions.update(sub.id, { cancel_at_period_end: true });
    }

    return Response.json({ cancelled: true });
  } catch (error: any) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
