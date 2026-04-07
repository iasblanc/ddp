// @ts-nocheck
"use client";
import { useEffect, useState, Suspense } from "react";
import { useRouter } from "next/navigation";

const T = {
  bg: "#0D0D14", surface: "#141420", card: "#1A1A2E", light: "#E8E4DC",
  silver: "#6B6B80", blue: "#4A6FA5", green: "#2D6A4F", amber: "#C9853A",
  border: "#252538",
};

function DashboardContent() {
  const router = useRouter();
  const [activeDream, setActiveDream] = useState<any>(null);
  const [upcomingBlocks, setUpcomingBlocks] = useState<any[]>([]);
  const [messages, setMessages] = useState<any[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [streamText, setStreamText] = useState("");
  const [conversationType, setConversationType] = useState("checkin");
  const [loading, setLoading] = useState(true);
  const [calendarConnected, setCalendarConnected] = useState(false);

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    setLoading(true);
    const [dreamsRes, calRes] = await Promise.all([
      fetch("/api/dreams"),
      fetch("/api/calendar/sync"),
    ]);
    if (dreamsRes.ok) {
      const { dreams } = await dreamsRes.json();
      const active = dreams?.find((d: any) => d.status === "active");
      if (active) {
        setActiveDream(active);
        const blocksRes = await fetch(`/api/blocks?dreamId=${active.id}&days=7`);
        if (blocksRes.ok) {
          const { blocks } = await blocksRes.json();
          setUpcomingBlocks(blocks || []);
        }
      } else if (!dreams?.length) {
        router.push("/onboarding");
      }
    }
    if (calRes.ok) {
      const { connected } = await calRes.json();
      setCalendarConnected(connected);
    }
    setLoading(false);
  }

  async function sendMessage() {
    if (!input.trim() || streaming) return;
    const userMsg = { role: "user", content: input.trim(), timestamp: new Date().toISOString() };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput("");
    setStreaming(true);
    setStreamText("");

    try {
      const res = await fetch("/api/north/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: newMessages, conversationType,
          dreamId: activeDream?.id,
        }),
      });
      if (!res.ok) throw new Error("API error");

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let full = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        for (const line of decoder.decode(value).split("\n")) {
          if (line.startsWith("data: ")) {
            try {
              const d = JSON.parse(line.slice(6));
              if (d.text) { full += d.text; setStreamText(full); }
              if (d.done) {
                setMessages(prev => [...prev, { role: "assistant", content: full, timestamp: new Date().toISOString() }]);
                setStreamText("");
              }
            } catch {}
          }
        }
      }
    } catch {
      setMessages(prev => [...prev, { role: "assistant", content: "Algo correu mal. Tenta novamente.", timestamp: new Date().toISOString() }]);
      setStreamText("");
    } finally {
      setStreaming(false);
    }
  }

  const nextBlock = upcomingBlocks[0];
  const formatDate = (iso: string) => new Date(iso).toLocaleDateString("pt-BR", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

  if (loading) return (
    <div style={{ minHeight: "100vh", background: T.bg, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ color: T.silver, fontSize: "14px", fontFamily: "Inter, sans-serif" }}>A carregar...</div>
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", background: T.bg, color: T.light, fontFamily: "Inter, sans-serif", display: "flex", flexDirection: "column" }}>
      {/* Header */}
      <div style={{ borderBottom: `1px solid ${T.border}`, padding: "16px 24px", display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, background: `${T.bg}F0`, backdropFilter: "blur(12px)", zIndex: 50, flexWrap: "wrap", gap: "12px" }}>
        <p style={{ fontFamily: "'Playfair Display', serif", fontSize: "18px", fontWeight: 700, margin: 0, letterSpacing: "0.04em" }}>DP.</p>
        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
          {activeDream && (
            <button onClick={() => router.push(`/plan?dreamId=${activeDream.id}`)}
              style={{ padding: "7px 14px", background: `${T.blue}22`, border: `1px solid ${T.blue}44`, borderRadius: "8px", color: T.blue, fontSize: "12px", cursor: "pointer", fontFamily: "Inter, sans-serif" }}
            >Ver Plano</button>
          )}
          <button onClick={() => router.push("/dreams")}
            style={{ padding: "7px 14px", background: "transparent", border: `1px solid ${T.border}`, borderRadius: "8px", color: T.silver, fontSize: "12px", cursor: "pointer", fontFamily: "Inter, sans-serif" }}
          >Sonhos</button>
        </div>
      </div>

      <div style={{ flex: 1, display: "flex" }}>
        {/* Sidebar */}
        <div style={{ width: "260px", borderRight: `1px solid ${T.border}`, padding: "24px 20px", flexShrink: 0, display: "flex", flexDirection: "column", gap: "24px" }}>

          {/* Sonho activo */}
          {activeDream ? (
            <div>
              <p style={{ fontSize: "10px", color: T.silver, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: "10px" }}>Sonho Activo</p>
              <div style={{ padding: "14px", background: `${T.blue}11`, border: `1px solid ${T.blue}33`, borderRadius: "10px", cursor: "pointer" }}
                onClick={() => router.push(`/plan?dreamId=${activeDream.id}`)}>
                <p style={{ fontFamily: "'Playfair Display', serif", fontSize: "14px", margin: "0 0 8px", lineHeight: 1.3 }}>{activeDream.title}</p>
                {activeDream.blocks_total > 0 && (
                  <>
                    <div style={{ height: "2px", background: T.border, borderRadius: "999px", marginBottom: "6px" }}>
                      <div style={{ height: "100%", width: `${activeDream.progress || 0}%`, background: T.blue, borderRadius: "999px" }} />
                    </div>
                    <p style={{ fontSize: "11px", color: T.silver, margin: 0 }}>{activeDream.blocks_completed || 0} blocos completos</p>
                  </>
                )}
              </div>
            </div>
          ) : (
            <button onClick={() => router.push("/dreams")}
              style={{ padding: "12px", background: T.blue, border: "none", borderRadius: "8px", color: T.light, fontSize: "13px", cursor: "pointer", fontFamily: "Inter, sans-serif" }}>
              + Adicionar sonho
            </button>
          )}

          {/* Próximo bloco */}
          {nextBlock && (
            <div>
              <p style={{ fontSize: "10px", color: T.silver, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: "10px" }}>Próximo bloco</p>
              <div style={{ padding: "14px", background: T.surface, border: `1px solid ${T.amber}44`, borderRadius: "10px" }}>
                <p style={{ margin: "0 0 6px", fontSize: "13px", fontWeight: 500 }}>{nextBlock.title}</p>
                <p style={{ margin: 0, fontSize: "11px", color: T.silver }}>{formatDate(nextBlock.scheduled_at)}</p>
                <p style={{ margin: "4px 0 0", fontSize: "11px", color: T.silver }}>{nextBlock.duration_minutes || 30} min</p>
              </div>
            </div>
          )}

          {/* Tipo de conversa */}
          <div>
            <p style={{ fontSize: "10px", color: T.silver, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: "10px" }}>Falar com North</p>
            {[
              { key: "checkin", label: "Check-in" },
              { key: "extraction", label: "Novo Sonho" },
              { key: "pre_block", label: "Pré-bloco" },
              { key: "post_block", label: "Pós-bloco" },
              { key: "crisis", label: "Momento difícil" },
              { key: "revaluation", label: "Reavaliar" },
            ].map(t => (
              <button key={t.key} onClick={() => setConversationType(t.key)}
                style={{ display: "block", width: "100%", padding: "8px 10px", marginBottom: "3px", background: conversationType === t.key ? `${T.blue}22` : "transparent", border: `1px solid ${conversationType === t.key ? T.blue + "44" : "transparent"}`, borderRadius: "6px", color: conversationType === t.key ? T.blue : T.silver, fontSize: "12px", cursor: "pointer", textAlign: "left", fontFamily: "Inter, sans-serif" }}
              >{t.label}</button>
            ))}
          </div>

          {/* Calendar status */}
          <div style={{ marginTop: "auto" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <div style={{ width: "6px", height: "6px", borderRadius: "50%", background: calendarConnected ? T.green : T.silver }} />
              <span style={{ fontSize: "11px", color: T.silver }}>
                {calendarConnected ? "Google Calendar conectado" : "Calendar não conectado"}
              </span>
            </div>
          </div>
        </div>

        {/* Chat */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
          <div style={{ flex: 1, padding: "32px 40px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "14px" }}>
            {messages.length === 0 && (
              <div style={{ margin: "auto", textAlign: "center", maxWidth: "380px" }}>
                <p style={{ fontFamily: "'Playfair Display', serif", fontSize: "36px", fontWeight: 300, color: `${T.light}44`, marginBottom: "16px" }}>N</p>
                <p style={{ fontSize: "15px", fontWeight: 300, fontStyle: "italic", color: T.light, lineHeight: 1.8, margin: "0 0 8px" }}>
                  Olá. Eu sou North.<br />Estou aqui.
                </p>
                <p style={{ fontSize: "13px", color: T.silver }}>Escreve o que tens em mente.</p>
              </div>
            )}
            {messages.map((m: any, i: number) => (
              <div key={i} style={{
                maxWidth: m.role === "user" ? "72%" : "82%",
                alignSelf: m.role === "user" ? "flex-end" : "flex-start",
                padding: "12px 16px", borderRadius: "12px",
                background: m.role === "user" ? T.surface : T.card,
                border: `1px solid ${T.border}`,
                borderLeft: m.role === "assistant" ? `2px solid ${T.silver}` : undefined,
              }}>
                <p style={{ margin: 0, fontSize: "14px", lineHeight: 1.7, fontWeight: m.role === "assistant" ? 300 : 400, fontStyle: m.role === "assistant" ? "italic" : "normal" }}>
                  {m.content}
                </p>
              </div>
            ))}
            {streaming && streamText && (
              <div style={{ maxWidth: "82%", padding: "12px 16px", background: T.card, borderRadius: "12px", border: `1px solid ${T.border}`, borderLeft: `2px solid ${T.silver}` }}>
                <p style={{ margin: 0, fontSize: "14px", lineHeight: 1.7, fontWeight: 300, fontStyle: "italic" }}>
                  {streamText}<span style={{ opacity: 0.4 }}>▊</span>
                </p>
              </div>
            )}
            {streaming && !streamText && (
              <div style={{ padding: "12px 16px", background: T.card, borderRadius: "12px", border: `1px solid ${T.border}`, alignSelf: "flex-start" }}>
                <p style={{ margin: 0, fontSize: "13px", color: T.silver, fontStyle: "italic" }}>North está a pensar...</p>
              </div>
            )}
          </div>

          <div style={{ padding: "16px 40px 28px", borderTop: `1px solid ${T.border}` }}>
            <div style={{ display: "flex", gap: "8px", alignItems: "flex-end" }}>
              <textarea
                value={input} onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key === "Enter" && !e.shiftKey && (e.preventDefault(), sendMessage())}
                placeholder="Escreve para North..."
                rows={2} disabled={streaming}
                style={{ flex: 1, background: T.card, border: `1px solid ${T.border}`, borderRadius: "10px", padding: "12px 16px", color: T.light, fontSize: "14px", fontFamily: "Inter, sans-serif", resize: "none", outline: "none", lineHeight: 1.5, opacity: streaming ? 0.6 : 1 }}
              />
              <button onClick={sendMessage} disabled={streaming || !input.trim()}
                style={{ padding: "12px 18px", background: input.trim() && !streaming ? T.blue : T.border, border: "none", borderRadius: "10px", color: T.light, fontSize: "13px", fontWeight: 500, cursor: input.trim() && !streaming ? "pointer" : "default", fontFamily: "Inter, sans-serif" }}
              >→</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: "100vh", background: "#0D0D14" }} />}>
      <DashboardContent />
    </Suspense>
  );
}
