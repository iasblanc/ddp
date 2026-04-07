// @ts-nocheck
"use client";
import { useEffect, useState, Suspense } from "react";
import { useRouter } from "next/navigation";

const T = {
  bg: "#0D0D14", surface: "#141420", card: "#1A1A2E", light: "#E8E4DC",
  silver: "#6B6B80", blue: "#4A6FA5", green: "#2D6A4F", amber: "#C9853A",
  mauve: "#7B5EA7", border: "#252538",
};

function DashboardContent() {
  const router = useRouter();
  const [activeDream, setActiveDream] = useState<any>(null);
  const [allDreams, setAllDreams] = useState<any[]>([]);
  const [nextBlock, setNextBlock] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [streamText, setStreamText] = useState("");
  const [conversationType, setConversationType] = useState("checkin");
  const [loading, setLoading] = useState(true);
  const [calendarConnected, setCalendarConnected] = useState(false);
  const [northMessage, setNorthMessage] = useState<string | null>(null);
  const [witnessMessage, setWitnessMessage] = useState<string | null>(null);
  const [witnesses, setWitnesses] = useState<any[]>([]);
  const [showWitnessModal, setShowWitnessModal] = useState(false);
  const [witnessName, setWitnessName] = useState("");
  const [witnessUrl, setWitnessUrl] = useState("");

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    setLoading(true);
    const [dreamsRes, calRes, retentionRes] = await Promise.all([
      fetch("/api/dreams"),
      fetch("/api/calendar/sync"),
      fetch("/api/retention"),
    ]);

    if (dreamsRes.ok) {
      const { dreams } = await dreamsRes.json();
      setAllDreams(dreams || []);
      const active = dreams?.find((d: any) => d.status === "active");
      if (active) {
        setActiveDream(active);
        const blocksRes = await fetch(`/api/blocks?dreamId=${active.id}&days=7`);
        if (blocksRes.ok) {
          const { blocks } = await blocksRes.json();
          setNextBlock(blocks?.[0] || null);
          // Buscar testemunhas
          const wRes = await fetch(`/api/witnesses?dreamId=${active.id}`);
          if (wRes.ok) {
            const { witnesses: ws } = await wRes.json();
            setWitnesses(ws || []);
            // Mensagem da testemunha mais recente
            const latestMsg = ws?.flatMap((w: any) => w.messages || [])
              .sort((a: any, b: any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0];
            if (latestMsg) setWitnessMessage(`${latestMsg.from}: "${latestMsg.content}"`);
          }
        }
      } else if (!dreams?.length) {
        router.push("/onboarding");
        return;
      }
    }

    if (calRes.ok) {
      const { connected } = await calRes.json();
      setCalendarConnected(connected);
    }

    if (retentionRes.ok) {
      const { north_message } = await retentionRes.json();
      if (north_message) {
        setNorthMessage(north_message);
        setMessages([{ role: "assistant", content: north_message, timestamp: new Date().toISOString() }]);
      }
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
        body: JSON.stringify({ messages: newMessages, conversationType, dreamId: activeDream?.id }),
      });
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
                setMessages(prev => [...prev, { role: "assistant", content: full }]);
                setStreamText("");
              }
            } catch {}
          }
        }
      }
    } catch {
      setMessages(prev => [...prev, { role: "assistant", content: "Algo correu mal.", }]);
      setStreamText("");
    } finally { setStreaming(false); }
  }

  async function generateShareCard() {
    if (!activeDream) return;
    const res = await fetch("/api/share", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dreamId: activeDream.id }),
    });
    if (res.ok) {
      const { card } = await res.json();
      alert(`Card gerado!\n\n"Investi ${card.hours_invested}h em ${card.days_working} dias a construir o meu sonho. ${card.hashtag}"`);
    }
  }

  async function createWitness() {
    if (!activeDream || !witnessName.trim()) return;
    const res = await fetch("/api/witnesses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dreamId: activeDream.id, witnessName }),
    });
    if (res.ok) {
      const { url } = await res.json();
      setWitnessUrl(url);
      setWitnessName("");
    }
  }

  const formatDate = (iso: string) => new Date(iso).toLocaleDateString("pt-BR", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

  if (loading) return (
    <div style={{ minHeight: "100vh", background: T.bg, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ color: T.silver, fontSize: "14px", fontFamily: "Inter, sans-serif" }}>A carregar...</div>
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", background: T.bg, color: T.light, fontFamily: "Inter, sans-serif", display: "flex", flexDirection: "column" }}>
      {/* Header */}
      <div style={{ borderBottom: `1px solid ${T.border}`, padding: "16px 24px", display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, background: `${T.bg}F0`, backdropFilter: "blur(12px)", zIndex: 50, flexWrap: "wrap", gap: "10px" }}>
        <p style={{ fontFamily: "'Playfair Display', serif", fontSize: "18px", fontWeight: 700, margin: 0, letterSpacing: "0.04em" }}>DP.</p>
        <div style={{ display: "flex", gap: "8px" }}>
          {activeDream && <button onClick={() => router.push(`/plan?dreamId=${activeDream.id}`)} style={{ padding: "7px 14px", background: `${T.blue}22`, border: `1px solid ${T.blue}44`, borderRadius: "8px", color: T.blue, fontSize: "12px", cursor: "pointer", fontFamily: "Inter, sans-serif" }}>Ver Plano</button>}
          <button onClick={() => router.push("/dreams")} style={{ padding: "7px 14px", background: "transparent", border: `1px solid ${T.border}`, borderRadius: "8px", color: T.silver, fontSize: "12px", cursor: "pointer", fontFamily: "Inter, sans-serif" }}>Sonhos</button>
        </div>
      </div>

      <div style={{ flex: 1, display: "flex" }}>
        {/* Sidebar */}
        <div style={{ width: "260px", borderRight: `1px solid ${T.border}`, padding: "24px 20px", flexShrink: 0, display: "flex", flexDirection: "column", gap: "20px", overflowY: "auto" }}>

          {activeDream ? (
            <div>
              <p style={{ fontSize: "10px", color: T.silver, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: "10px" }}>Sonho Activo</p>
              <div onClick={() => router.push(`/plan?dreamId=${activeDream.id}`)} style={{ padding: "14px", background: `${T.blue}11`, border: `1px solid ${T.blue}33`, borderRadius: "10px", cursor: "pointer" }}>
                <p style={{ fontFamily: "'Playfair Display', serif", fontSize: "14px", margin: "0 0 8px", lineHeight: 1.3 }}>{activeDream.title}</p>
                {activeDream.blocks_total > 0 && (
                  <>
                    <div style={{ height: "2px", background: T.border, borderRadius: "999px", marginBottom: "6px" }}>
                      <div style={{ height: "100%", width: `${activeDream.progress || 0}%`, background: T.blue, borderRadius: "999px" }} />
                    </div>
                    <p style={{ fontSize: "11px", color: T.silver, margin: 0 }}>{activeDream.blocks_completed || 0} blocos</p>
                  </>
                )}
              </div>
            </div>
          ) : (
            <button onClick={() => router.push("/dreams")} style={{ padding: "12px", background: T.blue, border: "none", borderRadius: "8px", color: T.light, fontSize: "13px", cursor: "pointer", fontFamily: "Inter, sans-serif" }}>+ Adicionar sonho</button>
          )}

          {/* Próximo bloco */}
          {nextBlock && (
            <div>
              <p style={{ fontSize: "10px", color: T.silver, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: "10px" }}>Próximo bloco</p>
              <div onClick={() => router.push(`/block/${nextBlock.id}`)} style={{ padding: "14px", background: T.surface, border: `1px solid ${T.amber}44`, borderRadius: "10px", cursor: "pointer" }}>
                <p style={{ margin: "0 0 6px", fontSize: "13px", fontWeight: 500 }}>{nextBlock.title}</p>
                <p style={{ margin: 0, fontSize: "11px", color: T.silver }}>{formatDate(nextBlock.scheduled_at)}</p>
                <button onClick={e => { e.stopPropagation(); router.push(`/block/${nextBlock.id}`); }}
                  style={{ marginTop: "10px", width: "100%", padding: "8px", background: T.blue, border: "none", borderRadius: "6px", color: T.light, fontSize: "12px", cursor: "pointer", fontFamily: "Inter, sans-serif", fontWeight: 500 }}>
                  Executar →
                </button>
              </div>
            </div>
          )}

          {/* Mensagem da Testemunha */}
          {witnessMessage && (
            <div style={{ padding: "12px", background: `${T.mauve}11`, border: `1px solid ${T.mauve}33`, borderRadius: "10px" }}>
              <p style={{ fontSize: "10px", color: T.mauve, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "6px" }}>Testemunha</p>
              <p style={{ margin: 0, fontSize: "12px", fontStyle: "italic", lineHeight: 1.5, color: T.light }}>{witnessMessage}</p>
            </div>
          )}

          {/* Tipo de conversa */}
          <div>
            <p style={{ fontSize: "10px", color: T.silver, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: "10px" }}>North</p>
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

          {/* Acções sociais */}
          {activeDream && (
            <div>
              <p style={{ fontSize: "10px", color: T.silver, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: "10px" }}>Partilhar</p>
              <button onClick={() => setShowWitnessModal(true)}
                style={{ display: "block", width: "100%", padding: "8px 10px", marginBottom: "6px", background: `${T.mauve}22`, border: `1px solid ${T.mauve}44`, borderRadius: "6px", color: T.mauve, fontSize: "12px", cursor: "pointer", textAlign: "left", fontFamily: "Inter, sans-serif" }}>
                + Convidar Testemunha {witnesses.length > 0 ? `(${witnesses.length})` : ""}
              </button>
              <button onClick={generateShareCard}
                style={{ display: "block", width: "100%", padding: "8px 10px", background: "transparent", border: `1px solid ${T.border}`, borderRadius: "6px", color: T.silver, fontSize: "12px", cursor: "pointer", textAlign: "left", fontFamily: "Inter, sans-serif" }}>
                Gerar card de progresso
              </button>
            </div>
          )}

          {/* Status calendar */}
          <div style={{ marginTop: "auto", paddingTop: "8px", borderTop: `1px solid ${T.border}` }}>
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <div style={{ width: "6px", height: "6px", borderRadius: "50%", background: calendarConnected ? T.green : T.silver }} />
              <span style={{ fontSize: "11px", color: T.silver }}>{calendarConnected ? "Calendar activo" : "Calendar inactivo"}</span>
            </div>
          </div>
        </div>

        {/* Chat */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
          <div style={{ flex: 1, padding: "32px 40px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "14px" }}>
            {messages.length === 0 && (
              <div style={{ margin: "auto", textAlign: "center", maxWidth: "380px" }}>
                <p style={{ fontFamily: "'Playfair Display', serif", fontSize: "40px", fontWeight: 300, color: `${T.light}33`, marginBottom: "20px" }}>N</p>
                <p style={{ fontSize: "15px", fontWeight: 300, fontStyle: "italic", color: T.light, lineHeight: 1.8, margin: "0 0 8px" }}>Olá. Eu sou North.<br />Estou aqui.</p>
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
                <p style={{ margin: 0, fontSize: "14px", lineHeight: 1.7, fontWeight: m.role === "assistant" ? 300 : 400, fontStyle: m.role === "assistant" ? "italic" : "normal" }}>{m.content}</p>
              </div>
            ))}
            {(streaming && streamText) && (
              <div style={{ maxWidth: "82%", padding: "12px 16px", background: T.card, borderRadius: "12px", border: `1px solid ${T.border}`, borderLeft: `2px solid ${T.silver}` }}>
                <p style={{ margin: 0, fontSize: "14px", fontWeight: 300, fontStyle: "italic", lineHeight: 1.7 }}>{streamText}<span style={{ opacity: 0.4 }}>▊</span></p>
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
              <textarea value={input} onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key === "Enter" && !e.shiftKey && (e.preventDefault(), sendMessage())}
                placeholder="Escreve para North..." rows={2} disabled={streaming}
                style={{ flex: 1, background: T.card, border: `1px solid ${T.border}`, borderRadius: "10px", padding: "12px 16px", color: T.light, fontSize: "14px", fontFamily: "Inter, sans-serif", resize: "none", outline: "none", lineHeight: 1.5, opacity: streaming ? 0.6 : 1 }}
              />
              <button onClick={sendMessage} disabled={streaming || !input.trim()}
                style={{ padding: "12px 18px", background: input.trim() && !streaming ? T.blue : T.border, border: "none", borderRadius: "10px", color: T.light, fontSize: "13px", fontWeight: 500, cursor: "pointer", fontFamily: "Inter, sans-serif" }}>→</button>
            </div>
          </div>
        </div>
      </div>

      {/* Modal Testemunha */}
      {showWitnessModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, padding: "24px" }}>
          <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: "16px", padding: "32px", maxWidth: "400px", width: "100%" }}>
            <p style={{ fontFamily: "'Playfair Display', serif", fontSize: "20px", margin: "0 0 8px" }}>Testemunha do Sonho</p>
            <p style={{ fontSize: "13px", color: T.silver, lineHeight: 1.6, marginBottom: "24px" }}>
              A testemunha vê o teu progresso mas não as conversas com North.
            </p>

            {!witnessUrl ? (
              <>
                <input value={witnessName} onChange={e => setWitnessName(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && createWitness()}
                  placeholder="Nome da testemunha"
                  style={{ width: "100%", background: T.surface, border: `1px solid ${T.border}`, borderRadius: "8px", padding: "12px", color: T.light, fontSize: "14px", fontFamily: "Inter, sans-serif", outline: "none", boxSizing: "border-box", marginBottom: "10px" }} />
                <button onClick={createWitness} disabled={!witnessName.trim()}
                  style={{ width: "100%", padding: "12px", background: witnessName.trim() ? T.mauve : T.border, border: "none", borderRadius: "8px", color: T.light, fontSize: "13px", cursor: "pointer", fontFamily: "Inter, sans-serif", fontWeight: 500 }}>
                  Criar link
                </button>
              </>
            ) : (
              <div>
                <p style={{ fontSize: "13px", color: T.silver, marginBottom: "8px" }}>Link criado. Partilha com a testemunha:</p>
                <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: "8px", padding: "12px", fontSize: "12px", fontFamily: "monospace", color: T.light, wordBreak: "break-all", marginBottom: "12px" }}>{witnessUrl}</div>
                <button onClick={() => { navigator.clipboard.writeText(witnessUrl); }}
                  style={{ width: "100%", padding: "10px", background: T.mauve, border: "none", borderRadius: "8px", color: T.light, fontSize: "13px", cursor: "pointer", fontFamily: "Inter, sans-serif" }}>
                  Copiar link
                </button>
              </div>
            )}

            <button onClick={() => { setShowWitnessModal(false); setWitnessUrl(""); setWitnessName(""); }}
              style={{ width: "100%", marginTop: "8px", padding: "10px", background: "transparent", border: `1px solid ${T.border}`, borderRadius: "8px", color: T.silver, fontSize: "13px", cursor: "pointer", fontFamily: "Inter, sans-serif" }}>
              Fechar
            </button>
          </div>
        </div>
      )}
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
