// @ts-nocheck
"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

const T = {
  bg: "#0D0D14", card: "#1A1A2E", light: "#E8E4DC",
  silver: "#6B6B80", blue: "#4A6FA5", green: "#2D6A4F",
  amber: "#C9853A", border: "#252538", surface: "#141420",
};

export default function WitnessPage() {
  const params = useParams();
  const token = params.token as string;
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    const res = await fetch(`/api/witnesses/${token}`);
    if (res.ok) setData(await res.json());
    setLoading(false);
  }

  async function sendMessage() {
    if (!message.trim() || sending) return;
    setSending(true);
    const res = await fetch(`/api/witnesses/${token}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message }),
    });
    if (res.ok) { setSent(true); setMessage(""); }
    setSending(false);
  }

  if (loading) return (
    <div style={{ minHeight: "100vh", background: T.bg, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <p style={{ color: T.silver, fontFamily: "Inter, sans-serif", fontSize: "14px" }}>A carregar...</p>
    </div>
  );

  if (!data) return (
    <div style={{ minHeight: "100vh", background: T.bg, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <p style={{ color: T.silver, fontFamily: "Inter, sans-serif", fontSize: "14px" }}>Link não encontrado.</p>
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", background: T.bg, color: T.light, fontFamily: "Inter, sans-serif", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "24px" }}>
      <div style={{ width: "100%", maxWidth: "440px" }}>

        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: "40px" }}>
          <p style={{ fontFamily: "'Playfair Display', serif", fontSize: "18px", fontWeight: 700, letterSpacing: "0.04em", marginBottom: "4px" }}>DP.</p>
          <p style={{ fontSize: "12px", color: T.silver, letterSpacing: "0.08em", textTransform: "uppercase" }}>Testemunha do Sonho</p>
        </div>

        {/* Sonho */}
        <div style={{ padding: "28px", background: T.card, border: `1px solid ${T.border}`, borderRadius: "16px", marginBottom: "24px" }}>
          <p style={{ fontSize: "11px", color: T.silver, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "12px" }}>O Sonho</p>
          <p style={{ fontFamily: "'Playfair Display', serif", fontSize: "22px", lineHeight: 1.3, margin: "0 0 24px" }}>{data.dream_title}</p>

          {/* Stats */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "16px", marginBottom: "20px" }}>
            {[
              { label: "Blocos", value: data.blocks_completed },
              { label: "Streak", value: `${data.streak}d` },
              { label: "Progresso", value: `${data.progress}%` },
            ].map(s => (
              <div key={s.label} style={{ textAlign: "center" }}>
                <p style={{ fontSize: "24px", fontWeight: 300, color: T.blue, margin: "0 0 4px", fontFamily: "'Playfair Display', serif" }}>{s.value}</p>
                <p style={{ fontSize: "11px", color: T.silver, margin: 0, textTransform: "uppercase", letterSpacing: "0.06em" }}>{s.label}</p>
              </div>
            ))}
          </div>

          {/* Barra de progresso */}
          <div style={{ height: "2px", background: T.border, borderRadius: "999px" }}>
            <div style={{ height: "100%", width: `${data.progress}%`, background: T.blue, borderRadius: "999px", transition: "width 600ms ease-out" }} />
          </div>

          {data.next_milestone && (
            <p style={{ fontSize: "12px", color: T.silver, marginTop: "12px", fontStyle: "italic" }}>
              A trabalhar em: {data.next_milestone}
            </p>
          )}
        </div>

        {/* Mensagem de apoio */}
        {!sent ? (
          <div style={{ padding: "24px", background: T.surface, border: `1px solid ${T.border}`, borderRadius: "12px" }}>
            <p style={{ fontSize: "14px", fontWeight: 300, fontStyle: "italic", color: T.light, marginBottom: "14px", lineHeight: 1.6 }}>
              Envia uma mensagem de apoio. Aparecerá antes do próximo bloco.
            </p>
            <textarea
              value={message} onChange={e => setMessage(e.target.value)}
              placeholder="Escreve aqui..."
              rows={3}
              style={{ width: "100%", background: T.card, border: `1px solid ${T.border}`, borderRadius: "8px", padding: "12px", color: T.light, fontSize: "14px", fontFamily: "Inter, sans-serif", resize: "none", outline: "none", boxSizing: "border-box" }}
            />
            <button onClick={sendMessage} disabled={!message.trim() || sending}
              style={{ width: "100%", marginTop: "10px", padding: "12px", background: message.trim() && !sending ? T.blue : T.border, border: "none", borderRadius: "8px", color: T.light, fontSize: "13px", fontWeight: 500, cursor: "pointer", fontFamily: "Inter, sans-serif" }}>
              {sending ? "A enviar..." : "Enviar mensagem"}
            </button>
          </div>
        ) : (
          <div style={{ padding: "24px", background: `${T.green}11`, border: `1px solid ${T.green}33`, borderRadius: "12px", textAlign: "center" }}>
            <p style={{ fontSize: "15px", color: T.light, margin: "0 0 8px" }}>Mensagem enviada.</p>
            <p style={{ fontSize: "13px", color: T.silver, margin: 0 }}>Vai aparecer antes do próximo bloco.</p>
            <button onClick={() => setSent(false)} style={{ marginTop: "14px", background: "none", border: "none", color: T.silver, fontSize: "12px", cursor: "pointer", fontFamily: "Inter, sans-serif" }}>
              Enviar outra
            </button>
          </div>
        )}

        <p style={{ textAlign: "center", fontSize: "11px", color: T.silver, marginTop: "24px" }}>
          Dont Dream. Plan. — as conversas com North são privadas.
        </p>
      </div>
    </div>
  );
}
