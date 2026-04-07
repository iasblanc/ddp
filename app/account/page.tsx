// @ts-nocheck
"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthGuard } from "@/lib/auth-guard";
import { createClient } from "@/lib/supabase/client";

const T = {
  bg: "#0D0D14", card: "#1A1A2E", light: "#E8E4DC",
  silver: "#6B6B80", blue: "#4A6FA5", green: "#2D6A4F",
  amber: "#C9853A", border: "#252538", surface: "#141420",
};

export default function AccountPage() {
  const router = useRouter();
  useAuthGuard();
  const [billing, setBilling] = useState<any>(null);
  const [user, setUser] = useState<any>(null);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteInput, setDeleteInput] = useState("");
  const [cancellingPlan, setCancellingPlan] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => setUser(data.user));
    fetch("/api/billing").then(r => r.json()).then(setBilling);
  }, []);

  async function exportData() {
    window.location.href = "/api/user";
  }

  async function cancelPlan() {
    setCancellingPlan(true);
    const res = await fetch("/api/billing", { method: "DELETE" });
    const data = await res.json();
    if (data.cancelled) {
      alert("Subscrição cancelada. Manténs o acesso Pro até ao fim do período actual.");
      fetch("/api/billing").then(r => r.json()).then(setBilling);
    }
    setCancellingPlan(false);
  }

  async function deleteAccount() {
    if (deleteInput !== "APAGAR TUDO") return;
    setDeleting(true);
    const res = await fetch("/api/user", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ confirm: "APAGAR TUDO" }),
    });
    if (res.ok) {
      const supabase = createClient();
      await supabase.auth.signOut();
      router.push("/");
    } else {
      alert("Erro ao apagar conta.");
      setDeleting(false);
    }
  }

  return (
    <div style={{ minHeight: "100vh", background: T.bg, color: T.light, fontFamily: "Inter, sans-serif" }}>
      <div style={{ borderBottom: `1px solid ${T.border}`, padding: "16px 32px", display: "flex", alignItems: "center", gap: "16px", position: "sticky", top: 0, background: `${T.bg}F0`, backdropFilter: "blur(12px)" }}>
        <button onClick={() => router.push("/dashboard")} style={{ background: "none", border: "none", color: T.silver, cursor: "pointer", fontSize: "13px", fontFamily: "Inter, sans-serif" }}>← Dashboard</button>
        <span style={{ color: T.border }}>|</span>
        <span style={{ fontSize: "14px" }}>Conta</span>
      </div>

      <div style={{ maxWidth: "560px", margin: "0 auto", padding: "40px 32px", display: "flex", flexDirection: "column", gap: "24px" }}>

        {/* Perfil */}
        <section style={{ padding: "24px", background: T.card, border: `1px solid ${T.border}`, borderRadius: "12px" }}>
          <p style={{ fontSize: "11px", color: T.silver, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "16px" }}>Perfil</p>
          <p style={{ fontSize: "14px", margin: "0 0 4px" }}>{user?.email}</p>
          <p style={{ fontSize: "12px", color: T.silver, margin: 0 }}>
            Membro desde {user?.created_at ? new Date(user.created_at).toLocaleDateString("pt-BR") : "—"}
          </p>
        </section>

        {/* Plano */}
        <section style={{ padding: "24px", background: T.card, border: `1px solid ${T.border}`, borderRadius: "12px" }}>
          <p style={{ fontSize: "11px", color: T.silver, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "16px" }}>Plano</p>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <p style={{ fontSize: "16px", fontWeight: 500, margin: "0 0 4px", color: billing?.plan === "pro" ? T.blue : T.light }}>
                {billing?.plan === "pro" ? "Pro" : "Free"}
              </p>
              {billing?.plan === "free" && (
                <p style={{ fontSize: "12px", color: T.silver, margin: 0 }}>
                  {3 - (billing?.freeBlocksUsed || 0)} blocos restantes com North
                </p>
              )}
            </div>
            {billing?.plan === "free" ? (
              <button onClick={() => router.push("/upgrade")}
                style={{ padding: "8px 16px", background: T.blue, border: "none", borderRadius: "8px", color: T.light, fontSize: "12px", fontWeight: 600, cursor: "pointer", fontFamily: "Inter, sans-serif" }}>
                Actualizar para Pro
              </button>
            ) : (
              <button onClick={cancelPlan} disabled={cancellingPlan}
                style={{ padding: "8px 16px", background: "transparent", border: `1px solid ${T.border}`, borderRadius: "8px", color: T.silver, fontSize: "12px", cursor: "pointer", fontFamily: "Inter, sans-serif" }}>
                {cancellingPlan ? "A cancelar..." : "Cancelar plano"}
              </button>
            )}
          </div>
        </section>

        {/* Privacidade e dados */}
        <section style={{ padding: "24px", background: T.card, border: `1px solid ${T.border}`, borderRadius: "12px" }}>
          <p style={{ fontSize: "11px", color: T.silver, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "16px" }}>Privacidade e Dados</p>
          <p style={{ fontSize: "13px", color: T.silver, lineHeight: 1.6, marginBottom: "16px" }}>
            As tuas conversas com North nunca são usadas para treinar modelos de IA.
            Podes exportar ou apagar todos os teus dados a qualquer momento.
          </p>
          <button onClick={exportData}
            style={{ width: "100%", padding: "10px", background: "transparent", border: `1px solid ${T.border}`, borderRadius: "8px", color: T.light, fontSize: "13px", cursor: "pointer", fontFamily: "Inter, sans-serif", marginBottom: "8px" }}>
            Exportar dados (JSON)
          </button>
          <button onClick={() => setShowDeleteConfirm(true)}
            style={{ width: "100%", padding: "10px", background: "transparent", border: `1px solid ${T.amber}44`, borderRadius: "8px", color: T.amber, fontSize: "13px", cursor: "pointer", fontFamily: "Inter, sans-serif" }}>
            Apagar conta e todos os dados
          </button>
        </section>

        {/* Confirmação de apagar */}
        {showDeleteConfirm && (
          <section style={{ padding: "24px", background: `${T.amber}11`, border: `1px solid ${T.amber}44`, borderRadius: "12px" }}>
            <p style={{ fontSize: "14px", fontWeight: 500, marginBottom: "8px", color: T.amber }}>Apagar conta permanentemente</p>
            <p style={{ fontSize: "13px", color: T.silver, lineHeight: 1.6, marginBottom: "16px" }}>
              Esta acção é irreversível. Todos os teus sonhos, blocos, conversas com North e memórias serão eliminados.
            </p>
            <p style={{ fontSize: "13px", color: T.light, marginBottom: "8px" }}>Escreve <strong>APAGAR TUDO</strong> para confirmar:</p>
            <input value={deleteInput} onChange={e => setDeleteInput(e.target.value)}
              placeholder="APAGAR TUDO"
              style={{ width: "100%", background: T.surface, border: `1px solid ${T.border}`, borderRadius: "8px", padding: "10px 12px", color: T.light, fontSize: "13px", fontFamily: "monospace", outline: "none", boxSizing: "border-box", marginBottom: "10px" }} />
            <div style={{ display: "flex", gap: "8px" }}>
              <button onClick={deleteAccount} disabled={deleteInput !== "APAGAR TUDO" || deleting}
                style={{ flex: 1, padding: "10px", background: deleteInput === "APAGAR TUDO" ? T.amber : T.border, border: "none", borderRadius: "8px", color: T.light, fontSize: "13px", cursor: "pointer", fontFamily: "Inter, sans-serif" }}>
                {deleting ? "A apagar..." : "Confirmar apagamento"}
              </button>
              <button onClick={() => { setShowDeleteConfirm(false); setDeleteInput(""); }}
                style={{ padding: "10px 16px", background: "transparent", border: `1px solid ${T.border}`, borderRadius: "8px", color: T.silver, fontSize: "13px", cursor: "pointer", fontFamily: "Inter, sans-serif" }}>
                Cancelar
              </button>
            </div>
          </section>
        )}

        {/* Logout */}
        <button onClick={async () => {
          const supabase = createClient();
          await supabase.auth.signOut();
          router.push("/");
        }} style={{ padding: "12px", background: "transparent", border: `1px solid ${T.border}`, borderRadius: "8px", color: T.silver, fontSize: "13px", cursor: "pointer", fontFamily: "Inter, sans-serif" }}>
          Sair da conta
        </button>
      </div>
    </div>
  );
}
