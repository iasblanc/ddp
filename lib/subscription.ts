// @ts-nocheck
// ── FEATURE GATES — Dont Dream. Plan. ────────────────────────

export type Plan = "free" | "pro";

export interface PlanLimits {
  blocksPerDream: number;       // free: 3, pro: unlimited
  activeConversations: boolean; // North disponível em blocos
  adaptivePlan: boolean;        // plano calibra com tempo
  witnessInvites: number;       // free: 0, pro: 5
  dreamQueue: number;           // free: 3, pro: unlimited
}

export const PLAN_LIMITS: Record<Plan, PlanLimits> = {
  free: {
    blocksPerDream: 3,
    activeConversations: true,   // 3 blocos COM North
    adaptivePlan: false,
    witnessInvites: 0,
    dreamQueue: 3,
  },
  pro: {
    blocksPerDream: Infinity,
    activeConversations: true,
    adaptivePlan: true,
    witnessInvites: 5,
    dreamQueue: Infinity,
  },
};

export const PRICES = {
  monthly: { amount: 2900, label: "R$29/mês", priceId: process.env.STRIPE_PRICE_MONTHLY || "" },
  yearly:  { amount: 24900, label: "R$249/ano", priceId: process.env.STRIPE_PRICE_YEARLY || "" },
};

export function canExecuteBlock(freeBlocksUsed: number, plan: Plan): boolean {
  if (plan === "pro") return true;
  return freeBlocksUsed < PLAN_LIMITS.free.blocksPerDream;
}

export function blocksRemaining(freeBlocksUsed: number, plan: Plan): number {
  if (plan === "pro") return Infinity;
  return Math.max(0, PLAN_LIMITS.free.blocksPerDream - freeBlocksUsed);
}
