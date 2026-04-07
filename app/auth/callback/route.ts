// @ts-nocheck
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/dashboard";

  // Usar sempre a URL de produção, nunca localhost
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || origin;
  const redirectBase = appUrl.includes("localhost") 
    ? "https://ddp-phi.vercel.app" 
    : appUrl;

  if (code) {
    const supabase = createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    
    if (!error) {
      return NextResponse.redirect(`${redirectBase}${next}`);
    }
    
    console.error("Auth callback error:", error);
  }

  // Erro — redirigir para landing com mensagem
  return NextResponse.redirect(`${redirectBase}/?error=auth_failed`);
}
