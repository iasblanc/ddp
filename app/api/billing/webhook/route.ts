// @ts-nocheck
import Stripe from "stripe";
import { createClient } from "@/lib/supabase/server";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "", { apiVersion: "2024-06-20" });

export async function POST(request: Request) {
  const body = await request.text();
  const sig = request.headers.get("stripe-signature") || "";

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET || "");
  } catch (err: any) {
    console.error("Webhook signature failed:", err.message);
    return Response.json({ error: "Invalid signature" }, { status: 400 });
  }

  const supabase = createClient();

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.CheckoutSession;
      const userId = session.metadata?.supabase_user_id;
      if (userId) {
        await supabase.from("users").update({
          subscription_status: "pro",
          stripe_customer_id: session.customer as string,
          updated_at: new Date().toISOString(),
        }).eq("id", userId);
      }
      break;
    }

    case "customer.subscription.updated": {
      const sub = event.data.object as Stripe.Subscription;
      const customer = await stripe.customers.retrieve(sub.customer as string);
      const userId = (customer as Stripe.Customer).metadata?.supabase_user_id;
      if (userId) {
        const status = sub.status === "active" ? "pro" : "free";
        await supabase.from("users").update({
          subscription_status: status,
          updated_at: new Date().toISOString(),
        }).eq("id", userId);
      }
      break;
    }

    case "customer.subscription.deleted": {
      const sub = event.data.object as Stripe.Subscription;
      const customer = await stripe.customers.retrieve(sub.customer as string);
      const userId = (customer as Stripe.Customer).metadata?.supabase_user_id;
      if (userId) {
        await supabase.from("users").update({
          subscription_status: "free",
          updated_at: new Date().toISOString(),
        }).eq("id", userId);
      }
      break;
    }
  }

  return Response.json({ received: true });
}
