// @ts-nocheck
"use client";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

const tokens = {
  deepNight: "#0D0D14", stellarGray: "#1A1A2E", northLight: "#E8E4DC",
  mutedSilver: "#6B6B80", northBlue: "#4A6FA5", border: "#252538",
};

export default function HomePage() {
  const router = useRouter();
  const [dream, setDream] = useState("");
  const [email, setEmail] = useState("");
  const [step, setStep] = useState<"dream" | "auth" | "sent">("dream");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const supabase = createClient();

  // Se já tem sessão activa, redirigir
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) router.replace("/dashboard");
    });
  }, []);

  async function handleDreamSubmit() {
    if (!dream.trim()) return;
    // Guardar sonho no localStorage para recuperar após auth
    localStorage.setItem("ddp_initial_dream", dream.trim());
    setStep("auth");
  }

  async function handleGoogleLogin() {
    setLoading(true);
    setError("");
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/auth/callback?next=/onboarding`,
          scopes: "email profile https://www.googleapis.com/auth/calendar",
          queryParams: { access_type: "offline", prompt: "consent" },
        },
      });
      if (error) throw error;
    } catch (err: any) {
      setError("Erro ao conectar com Google. Tenta o email.");
      setLoading(false);
    }
  }

  async function handleMagicLink() {
    if (!email.trim()) return;
    setLoading(true);
    setError("");
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback?next=/onboarding`,
        },
      });
      if (error) {
        if (error.message.includes("rate limit") || error.message.includes("over_email_send_rate_limit")) {
          setError("Limite de emails atingido. Usa o Google para entrar.");
        } else {
          setError(error.message);
        }
      } else {
        setStep("sent");
      }
    } catch {
      setError("Algo correu mal. Tenta novamente.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={{
      minHeight: "100vh", background: tokens.deepNight, display: "flex",
      flexDirection: "column", alignItems: "center", justifyContent: "center",
      padding: "24px", fontFamily: "Inter, sans-serif",
    }}>
      {/* Logo */}
      <div style={{ marginBottom: "56px", textAlign: "center" }}>
        <h1 style={{ fontFamily: "'Playfair Display', serif", color: tokens.northLight, lineHeight: 1.1, margin: 0 }}>
          <span style={{ display: "block", fontSize: "22px", fontWeight: 400, letterSpacing: "0.08em" }}>DONT DREAM.</span>
          <span style={{ display: "block", fontSize: "22px", fontWeight: 700, letterSpacing: "0.04em" }}>PLAN.</span>
        </h1>
      </div>

      <div style={{ width: "100%", maxWidth: "480px" }}>

        {/* PASSO 1 — Sonho */}
        {step === "dream" && (
          <div style={{ animation: "fadeIn 0.4s ease" }}>
            <p style={{ fontSize: "15px", fontWeight: 300, fontStyle: "italic", color: tokens.northLight, marginBottom: "20px", lineHeight: 1.7, textAlign: "center" }}>
              Qual é o sonho que não paras de adiar?
            </p>
            <textarea
              value={dream}
              onChange={e => setDream(e.target.value)}
              onKeyDown={e => e.key === "Enter" && !e.shiftKey && (e.preventDefault(), handleDreamSubmit())}
              placeholder="Escreve aqui..."
              rows={4}
              autoFocus
              style={{
                width: "100%", background: tokens.stellarGray, border: `1px solid ${tokens.border}`,
                borderRadius: "10px", padding: "16px", color: tokens.northLight, fontSize: "15px",
                fontFamily: "Inter, sans-serif", fontWeight: 300, resize: "none", outline: "none",
                lineHeight: 1.6, boxSizing: "border-box", transition: "border-color 280ms ease",
              }}
            />
            <button
              onClick={handleDreamSubmit}
              disabled={!dream.trim()}
              style={{
                width: "100%", marginTop: "12px", padding: "14px",
                background: dream.trim() ? tokens.northBlue : tokens.border,
                border: "none", borderRadius: "10px", color: tokens.northLight,
                fontSize: "14px", fontWeight: 500, cursor: dream.trim() ? "pointer" : "default",
                fontFamily: "Inter, sans-serif", transition: "all 280ms ease",
              }}
            >
              Continuar →
            </button>
            <p style={{ textAlign: "center", fontSize: "11px", color: tokens.mutedSilver, marginTop: "16px" }}>
              O teu sonho fica privado.
            </p>
          </div>
        )}

        {/* PASSO 2 — Auth */}
        {step === "auth" && (
          <div>
            <p style={{ fontSize: "15px", fontWeight: 300, fontStyle: "italic", color: tokens.northLight, marginBottom: "28px", lineHeight: 1.7, textAlign: "center" }}>
              Para guardar o teu progresso, entra na tua conta.
            </p>

            {/* Google OAuth — método principal */}
            <button
              onClick={handleGoogleLogin}
              disabled={loading}
              style={{
                width: "100%", padding: "14px 20px", marginBottom: "16px",
                background: tokens.northBlue, border: "none", borderRadius: "10px",
                color: tokens.northLight, fontSize: "14px", fontWeight: 500,
                cursor: loading ? "default" : "pointer", fontFamily: "Inter, sans-serif",
                display: "flex", alignItems: "center", justifyContent: "center", gap: "10px",
                transition: "all 280ms ease", opacity: loading ? 0.7 : 1,
              }}
            >
              <GoogleIcon />
              {loading ? "A conectar..." : "Continuar com Google"}
            </button>

            {/* Separador */}
            <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "16px" }}>
              <div style={{ flex: 1, height: "1px", background: tokens.border }} />
              <span style={{ fontSize: "11px", color: tokens.mutedSilver, letterSpacing: "0.06em" }}>ou</span>
              <div style={{ flex: 1, height: "1px", background: tokens.border }} />
            </div>

            {/* Email magic link — fallback */}
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleMagicLink()}
              placeholder="O teu email"
              style={{
                width: "100%", background: tokens.stellarGray, border: `1px solid ${tokens.border}`,
                borderRadius: "10px", padding: "12px 16px", color: tokens.northLight,
                fontSize: "14px", fontFamily: "Inter, sans-serif", outline: "none",
                boxSizing: "border-box", marginBottom: "8px",
              }}
            />
            <button
              onClick={handleMagicLink}
              disabled={loading || !email.trim()}
              style={{
                width: "100%", padding: "12px",
                background: "transparent", border: `1px solid ${tokens.border}`,
                borderRadius: "10px", color: email.trim() ? tokens.northLight : tokens.mutedSilver,
                fontSize: "13px", cursor: email.trim() && !loading ? "pointer" : "default",
                fontFamily: "Inter, sans-serif",
              }}
            >
              {loading ? "A enviar..." : "Enviar link por email"}
            </button>

            {error && (
              <p style={{ color: "#E57373", fontSize: "12px", marginTop: "10px", textAlign: "center" }}>
                {error}
              </p>
            )}

            <button
              onClick={() => setStep("dream")}
              style={{ background: "none", border: "none", color: tokens.mutedSilver, fontSize: "12px", cursor: "pointer", marginTop: "16px", display: "block", marginLeft: "auto", marginRight: "auto", fontFamily: "Inter, sans-serif" }}
            >
              ← Voltar
            </button>
          </div>
        )}

        {/* PASSO 3 — Email enviado */}
        {step === "sent" && (
          <div style={{ textAlign: "center" }}>
            <p style={{ fontSize: "32px", marginBottom: "16px" }}>✉️</p>
            <p style={{ fontSize: "16px", fontWeight: 300, color: tokens.northLight, marginBottom: "8px" }}>
              Link enviado.
            </p>
            <p style={{ fontSize: "13px", color: tokens.mutedSilver, lineHeight: 1.6 }}>
              Verifica o teu email <strong style={{ color: tokens.northLight }}>{email}</strong> e clica no link para entrar.
            </p>
            <p style={{ fontSize: "11px", color: tokens.mutedSilver, marginTop: "20px" }}>
              Não encontras? Verifica a pasta de spam.
            </p>
          </div>
        )}
      </div>
    </main>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
      <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
      <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853"/>
      <path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
      <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
    </svg>
  );
}
