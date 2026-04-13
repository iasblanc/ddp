// @ts-nocheck
export const dynamic = "force-dynamic";
import { createClient } from "@/lib/supabase/server";

function getStripe() {
  const Stripe = require("stripe");
  return new Stripe(process.env.STRIPE_SECRET_KEY || "sk_placeholder", { apiVersion: "2024-06-20" });
}

export async function POST(request: Request) {
  if (!process.env.STRIPE_SECRET_KEY || !process.env.STRIPE_WEBHOOK_SECRET) {
    return Response.json({ error: "Stripe not configured" }, { status: 503 });
  }

  const body = await request.text();
  const sig = request.headers.get("stripe-signature") || "";
  const stripe = getStripe();

  let event: any;
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err: any) {
    return Response.json({ error: "Invalid signature" }, { status: 400 });
  }

  const supabase = createClient();

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object;
      const userId = session.metadata?.supabase_user_id;
      if (userId) {
        await supabase.from("users").update({
          subscription_status: "pro",
          stripe_customer_id: session.customer,
          updated_at: new Date().toISOString(),
        }).eq("id", userId);
      }
      break;
    }
    case "customer.subscription.updated":
    case "customer.subscription.deleted": {
      const sub = event.data.object;
      const customer = await stripe.customers.retrieve(sub.customer);
      const userId = customer.metadata?.supabase_user_id;
      if (userId) {
        const status = event.type === "customer.subscription.deleted" || sub.status !== "active" ? "free" : "pro";
        await supabase.from("users").update({ subscription_status: status, updated_at: new Date().toISOString() }).eq("id", userId);
      }
      break;
    }
  }

  return Response.json({ received: true });
}
