// @ts-nocheck
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/dashboard";
  const appUrl = "https://ddp-phi.vercel.app";

  if (code) {
    const supabase = createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error && data?.session) {
      // Guardar tokens Google Calendar se disponíveis
      const providerToken = data.session.provider_token;
      const providerRefreshToken = data.session.provider_refresh_token;

      if (providerToken && data.session.user) {
        const userId = data.session.user.id;
        try {
          // Verificar se já existe integração
          const { data: existing } = await supabase
            .from("calendar_integrations")
            .select("id")
            .eq("user_id", userId)
            .eq("provider", "google")
            .single();

          if (existing) {
            await supabase.from("calendar_integrations")
              .update({
                access_token: providerToken,
                refresh_token: providerRefreshToken || null,
                token_expires_at: new Date(Date.now() + 3600 * 1000).toISOString(),
                is_active: true,
                sync_enabled: true,
                updated_at: new Date().toISOString(),
              })
              .eq("id", existing.id);
          } else {
            await supabase.from("calendar_integrations").insert({
              user_id: userId,
              provider: "google",
              access_token: providerToken,
              refresh_token: providerRefreshToken || null,
              token_expires_at: new Date(Date.now() + 3600 * 1000).toISOString(),
              is_active: true,
              sync_enabled: true,
            });
          }
        } catch (err) {
          console.error("Calendar token save error:", err);
        }
      }

      // Se next=/onboarding mas onboarding já foi feito, ir para dashboard
      let finalNext = next;
      if (next === "/onboarding" && data.session.user) {
        try {
          const { data: profile } = await supabase
            .from("users")
            .select("onboarding_completed_at")
            .eq("id", data.session.user.id)
            .single();
          if (profile?.onboarding_completed_at) {
            finalNext = "/dashboard";
          }
        } catch {}
      }
      return NextResponse.redirect(`${appUrl}${finalNext}`);
    }

    console.error("Auth callback error:", error);
  }

  return NextResponse.redirect(`${appUrl}/?error=auth_failed`);
}
