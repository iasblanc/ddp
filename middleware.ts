import { NextResponse, type NextRequest } from "next/server";

// Rotas que não precisam de auth
const PUBLIC_ROUTES = new Set(["/", "/offline"]);
const PUBLIC_PREFIXES = [
  "/_next", "/api/", "/icons", "/manifest.json",
  "/sw.js", "/witness/", "/auth/",
];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Bypass completo para rotas públicas
  if (
    PUBLIC_ROUTES.has(pathname) ||
    PUBLIC_PREFIXES.some((p) => pathname.startsWith(p))
  ) {
    return NextResponse.next();
  }

  // Verificar cookie de sessão Supabase sem importar @supabase/ssr
  // O cookie tem o formato: sb-<ref>-auth-token
  const cookies = request.cookies;
  const hasSession = [...cookies.getAll()].some(
    (c) => c.name.startsWith("sb-") && c.name.endsWith("-auth-token")
  );

  if (!hasSession) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
