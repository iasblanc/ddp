// @ts-nocheck
"use client";
import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { PRICES } from "@/lib/subscription";

const T = {
  bg: "#0D0D14", card: "#1A1A2E", light: "#E8E4DC",
  silver: "#6B6B80", blue: "#4A6FA5", green: "#2D6A4F",
  amber: "#C9853A", border: "#252538", surface: "#141420",
};

function UpgradeContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState<string | null>(null);
  const [plan, setPlan] = useState<string>("free");
  const [freeBlocksUsed, setFreeBlocksUsed] = useState(0);
  const trigger = searchParams.get("trigger"); // "blocks" | "plan"

  useEffect(() => {
    fetch("/api/billing").then(r => r.json()).then(d => {
      setPlan(d.plan);
      setFreeBlocksUsed(d.freeBlocksUsed || 0);
    });
  }, []);

  async function checkout(interval: "monthly" | "yearly") {
    setLoading(interval);
    const price = PRICES[interval];
    const res = await fetch("/api/billing", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ priceId: price.priceId, interval }),
    });
    const { url, error } = await res.json();
    if (error) { alert("Erro: " + error); setLoading(null); return; }
    window.location.href = url;
  }

  const features = [
    { free: "3 blocos com North", pro: "North ilimitado em todos os blocos" },
    { free: "1 sonho activo", pro: "Sonhos ilimitados na fila" },
    { free: "Plano básico gerado", pro: "Plano adaptativo que aprende contigo" },
    { free: "—", pro: "Testemunha do Sonho (até 5 pessoas)" },
    { free: "—", pro: "Relatórios de progresso semanais" },
    { free: "—", pro: "Check-ins de calibração automáticos" },
  ];

  return (
    <div style={{ minHeight: "100vh", background: T.bg, color: T.light, fontFamily: "Inter, sans-serif", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "40px 24px" }}>
      
      <button onClick={() => router.back()} style={{ position: "absolute", top: "24px", left: "24px", background: "none", border: "none", color: T.silver, cursor: "pointer", fontSize: "13px", fontFamily: "Inter, sans-serif" }}>
        ← Voltar
      </button>

      {/* Gatilho de conversão */}
      {trigger === "blocks" && (
        <div style={{ padding: "16px 24px", background: `${T.amber}11`, border: `1px solid ${T.amber}44`, borderRadius: "10px", marginBottom: "40px", textAlign: "center", maxWidth: "480px" }}>
          <p style={{ margin: 0, fontSize: "14px", fontWeight: 300, fontStyle: "italic", lineHeight: 1.7 }}>
            Completaste os teus primeiros 90 minutos em direcção ao teu sonho.<br />
            Para continuar com North em todos os blocos, activa o Pro.
          </p>
        </div>
      )}

      {/* Logo */}
      <div style={{ textAlign: "center", marginBottom: "48px" }}>
        <p style={{ fontFamily: "'Playfair Display', serif", fontSize: "20px", fontWeight: 700, letterSpacing: "0.04em", margin: "0 0 8px" }}>DONT DREAM. PLAN.</p>
        <p style={{ fontSize: "13px", color: T.silver }}>Escolhe o plano que funciona para ti.</p>
      </div>

      {/* Cards de preço */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", width: "100%", maxWidth: "600px", marginBottom: "48px" }}>
        
        {/* Free */}
        <div style={{ padding: "28px 24px", background: T.surface, border: `1px solid ${T.border}`, borderRadius: "16px" }}>
          <p style={{ fontSize: "12px", color: T.silver, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "8px" }}>Free</p>
          <p style={{ fontFamily: "'Playfair Display', serif", fontSize: "32px", fontWeight: 400, margin: "0 0 4px" }}>R$0</p>
          <p style={{ fontSize: "12px", color: T.silver, marginBottom: "24px" }}>Para começar</p>
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {features.map((f, i) => (
              <div key={i} style={{ display: "flex", gap: "8px", alignItems: "flex-start" }}>
                <span style={{ fontSize: "12px", color: f.free === "—" ? T.border : T.silver, marginTop: "2px" }}>{f.free === "—" ? "—" : "✓"}</span>
                <span style={{ fontSize: "12px", color: f.free === "—" ? T.border : T.silver, lineHeight: 1.4 }}>{f.free}</span>
              </div>
            ))}
          </div>
          {plan === "free" && (
            <div style={{ marginTop: "24px", padding: "10px", background: T.card, borderRadius: "8px", textAlign: "center" }}>
              <span style={{ fontSize: "12px", color: T.silver }}>Plano actual</span>
            </div>
          )}
        </div>

        {/* Pro */}
        <div style={{ padding: "28px 24px", background: T.card, border: `2px solid ${T.blue}`, borderRadius: "16px", position: "relative" }}>
          <div style={{ position: "absolute", top: "-12px", left: "50%", transform: "translateX(-50%)", background: T.blue, padding: "4px 14px", borderRadius: "999px", fontSize: "11px", fontWeight: 600, letterSpacing: "0.08em", whiteSpace: "nowrap" }}>
            RECOMENDADO
          </div>
          <p style={{ fontSize: "12px", color: T.blue, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "8px" }}>Pro</p>
          <p style={{ fontFamily: "'Playfair Display', serif", fontSize: "32px", fontWeight: 400, margin: "0 0 4px" }}>R$29</p>
          <p style={{ fontSize: "12px", color: T.silver, marginBottom: "24px" }}>por mês</p>
          <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginBottom: "24px" }}>
            {features.map((f, i) => (
              <div key={i} style={{ display: "flex", gap: "8px", alignItems: "flex-start" }}>
                <span style={{ fontSize: "12px", color: T.blue, marginTop: "2px" }}>✓</span>
                <span style={{ fontSize: "12px", color: T.light, lineHeight: 1.4 }}>{f.pro}</span>
              </div>
            ))}
          </div>

          {plan === "pro" ? (
            <div style={{ padding: "10px", background: `${T.green}22`, borderRadius: "8px", textAlign: "center" }}>
              <span style={{ fontSize: "12px", color: T.green }}>✓ Activo</span>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              <button onClick={() => checkout("monthly")} disabled={!!loading}
                style={{ padding: "12px", background: loading === "monthly" ? T.border : T.blue, border: "none", borderRadius: "8px", color: T.light, fontSize: "13px", fontWeight: 600, cursor: "pointer", fontFamily: "Inter, sans-serif" }}>
                {loading === "monthly" ? "A redirigir..." : "Mensal — R$29/mês"}
              </button>
              <button onClick={() => checkout("yearly")} disabled={!!loading}
                style={{ padding: "12px", background: "transparent", border: `1px solid ${T.blue}`, borderRadius: "8px", color: T.blue, fontSize: "13px", cursor: "pointer", fontFamily: "Inter, sans-serif" }}>
                {loading === "yearly" ? "A redirigir..." : "Anual — R$249/ano  (−28%)"}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Argumento de preço */}
      <div style={{ maxWidth: "480px", textAlign: "center" }}>
        <p style={{ fontSize: "13px", color: T.silver, lineHeight: 1.7, fontStyle: "italic" }}>
          "O produto não compete com outros apps.<br />
          Compete com o custo de não realizar o sonho."
        </p>
        <p style={{ fontSize: "11px", color: T.border, marginTop: "16px" }}>
          Cancela a qualquer momento. Sem compromissos.
        </p>
      </div>
    </div>
  );
}

export default function UpgradePage() {
  return (
    <Suspense fallback={<div style={{ minHeight: "100vh", background: "#0D0D14" }} />}>
      <UpgradeContent />
    </Suspense>
  );
}
