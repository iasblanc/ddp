// @ts-nocheck
// ── HEALTH CHECK — diagnóstico rápido do estado do sistema ───────
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const checks: Record<string, { ok: boolean; detail: string }> = {};

  // 1. ANTHROPIC_API_KEY
  const hasAnthropicKey = !!process.env.ANTHROPIC_API_KEY && 
    process.env.ANTHROPIC_API_KEY.startsWith("sk-ant-");
  checks.anthropic = {
    ok: hasAnthropicKey,
    detail: hasAnthropicKey ? "API key configurada" : "ANTHROPIC_API_KEY não configurada ou inválida (deve começar com sk-ant-)",
  };

  // 2. Supabase
  try {
    const supabase = createClient();
    const { error } = await supabase.from("users").select("id").limit(1);
    checks.supabase = {
      ok: !error,
      detail: error ? `Erro: ${error.message}` : "Conectado",
    };
  } catch (e: any) {
    checks.supabase = { ok: false, detail: e.message };
  }

  // 3. Google Calendar OAuth
  checks.google_oauth = {
    ok: !!process.env.GOOGLE_CLIENT_ID && !!process.env.GOOGLE_CLIENT_SECRET,
    detail: (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET)
      ? "GOOGLE_CLIENT_ID ou GOOGLE_CLIENT_SECRET não configurado"
      : "Configurado",
  };

  // 4. Stripe
  checks.stripe = {
    ok: !!process.env.STRIPE_SECRET_KEY,
    detail: process.env.STRIPE_SECRET_KEY ? "Configurado" : "STRIPE_SECRET_KEY não configurado (não crítico para MVP)",
  };

  // 5. App URL
  checks.app_url = {
    ok: !!process.env.NEXT_PUBLIC_APP_URL,
    detail: process.env.NEXT_PUBLIC_APP_URL || "NEXT_PUBLIC_APP_URL não configurado",
  };

  const allOk = Object.values(checks).every(c => c.ok);
  const critical = !checks.anthropic.ok || !checks.supabase.ok;

  return Response.json({
    status: allOk ? "ok" : critical ? "critical" : "degraded",
    checks,
    timestamp: new Date().toISOString(),
  }, { status: allOk ? 200 : critical ? 503 : 207 });
}
