// @ts-nocheck
"use client";
import { useAuthGuard } from "@/lib/auth-guard";
import { useEffect, useState, useRef, Suspense } from "react";
import { useRouter } from "next/navigation";

const T = {
  bg: "#0D0D14", surface: "#141420", card: "#1A1A2E", light: "#E8E4DC",
  silver: "#6B6B80", blue: "#4A6FA5", green: "#2D6A4F", amber: "#C9853A",
  mauve: "#7B5EA7", border: "#252538",
};

// Toast simples no design system (substitui alert)
function Toast({ msg, onClose }: { msg: string; onClose: () => void }) {
  useEffect(() => { const t = setTimeout(onClose, 4000); return () => clearTimeout(t); }, []);
  return (
    <div style={{ position: "fixed", bottom: "24px", left: "50%", transform: "translateX(-50%)", background: T.card, border: `1px solid ${T.border}`, borderRadius: "10px", padding: "14px 20px", maxWidth: "420px", width: "90%", zIndex: 200, boxShadow: "0 8px 32px rgba(0,0,0,0.4)", fontFamily: "Inter, sans-serif" }}>
      <p style={{ margin: 0, fontSize: "13px", color: T.light, lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{msg}</p>
    </div>
  );
}

function DashboardContent() {
  const router = useRouter();
  useAuthGuard();
  const chatBottomRef = useRef<HTMLDivElement>(null);

  const [activeDream, setActiveDream] = useState<any>(null);
  const [nextBlock, setNextBlock] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [streamText, setStreamText] = useState("");
  const [conversationType, setConversationType] = useState("checkin");
  const [loading, setLoading] = useState(true);
  const [calendarConnected, setCalendarConnected] = useState(false);
  const [generatingPlan, setGeneratingPlan] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  // Fluxo Novo Sonho
  const [newDreamStep, setNewDreamStep] = useState<"idle"|"input"|"synergy">("idle");
  const [newDreamText, setNewDreamText] = useState("");
  const [newDreamInput, setNewDreamInput] = useState("");

  // Social
  const [witnessMessage, setWitnessMessage] = useState<string | null>(null);
  const [witnesses, setWitnesses] = useState<any[]>([]);
  const [showWitnessModal, setShowWitnessModal] = useState(false);
  const [witnessName, setWitnessName] = useState("");
  const [witnessUrl, setWitnessUrl] = useState("");

  // Scroll automático para o fundo do chat
  const scrollChat = () => {
    setTimeout(() => chatBottomRef.current?.scrollIntoView({ behavior: "smooth" }), 60);
  };

  function selectConversationType(type: string) {
    if (streaming) return;
    setConversationType(type);
    setNewDreamStep("idle");
    setNewDreamInput("");
    setInput("");

    const openers: Record<string, string> = {
      checkin:     "Como está indo essa semana?\n\nConta o que aconteceu desde a última vez.",
      pre_block:   nextBlock
        ? `Seu próximo bloco é:\n"${nextBlock.title}"\n\nHá algo que precisa esclarecer antes de começar?`
        : "Para qual bloco você quer se preparar?\nMe diz o que tem agendado.",
      post_block:  "Como foi o último bloco?\n\nO que você concluiu — e o que ficou por fazer?",
      crisis:      "O que está acontecendo?\n\nNão tenho pressa. Conta.",
      revaluation: "O que te fez questionar o plano?\n\nAlgo mudou, ou é uma dúvida que já existia?",
    };

    if (type === "extraction") {
      setNewDreamStep("input");
      setMessages([{
        role: "assistant",
        content: activeDream
          ? `Você tem um sonho ativo: "${activeDream.title}"\n\nAntes de avançar, vou verificar a sinergia e a disponibilidade de calendário.\n\nQual é o novo sonho?`
          : "Qual é o novo sonho que você quer trabalhar?",
        timestamp: new Date().toISOString()
      }]);
      scrollChat();
      return;
    }

    const opener = openers[type];
    if (!opener) return;
    setMessages([{ role: "assistant", content: opener, timestamp: new Date().toISOString() }]);
    scrollChat();
  }

  async function handleNewDreamSubmit() {
    if (!newDreamInput.trim() || streaming) return;
    const dream = newDreamInput.trim();
    setNewDreamText(dream);
    setNewDreamInput("");
    setMessages(prev => [...prev, { role: "user", content: dream }]);

    if (activeDream) {
      setNewDreamStep("synergy");
      const r = await fetch(`/api/blocks?dreamId=${activeDream.id}&days=30`).then(r => r.json()).catch(() => ({}));
      const scheduled = Array.isArray(r.blocks) ? r.blocks.length : (Array.isArray(r) ? r.length : 0);
      setMessages(prev => [...prev, {
        role: "assistant",
        content: `Analisei seu plano atual.\n\nVocê tem ${scheduled} blocos agendados nas próximas 4 semanas para "${activeDream.title}".\n\nPosso encaixar um novo sonho em paralelo — mas dependendo do tempo disponível, isso pode estender os prazos ou reduzir a frequência de blocos por sonho.\n\nComo prefere?`,
        timestamp: new Date().toISOString()
      }]);
    } else {
      router.push(`/onboarding?dream=${encodeURIComponent(dream)}`);
    }
    scrollChat();
  }

  async function confirmNewDream(parallel: boolean) {
    if (parallel) {
      router.push(`/onboarding?dream=${encodeURIComponent(newDreamText)}`);
    } else {
      setMessages(prev => [...prev, {
        role: "assistant",
        content: `Entendido. O sonho "${newDreamText}" fica na fila.\n\nVou te lembrar dele quando o sonho atual estiver concluído.`,
        timestamp: new Date().toISOString()
      }]);
      await fetch("/api/dreams", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: newDreamText }),
      });
      setNewDreamStep("idle");
      scrollChat();
    }
  }

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
      const active = dreams?.find((d: any) => d.status === "active");
      if (active) {
        setActiveDream(active);
        const blocksRes = await fetch(`/api/blocks?dreamId=${active.id}&days=7`);
        if (blocksRes.ok) {
          const { blocks } = await blocksRes.json();
          setNextBlock(blocks?.[0] || null);
          const wRes = await fetch(`/api/witnesses?dreamId=${active.id}`);
          if (wRes.ok) {
            const { witnesses: ws } = await wRes.json();
            setWitnesses(ws || []);
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

    let hasRetentionMessage = false;
    if (retentionRes.ok) {
      const { north_message } = await retentionRes.json();
      if (north_message) {
        hasRetentionMessage = true;
        setMessages([{ role: "assistant", content: north_message, timestamp: new Date().toISOString() }]);
      }
    }
    if (!hasRetentionMessage) {
      const hour = new Date().getHours();
      const greeting = hour < 12 ? "Bom dia." : hour < 18 ? "Boa tarde." : "Boa noite.";
      setMessages([{ role: "assistant", content: `${greeting} Estou aqui.`, timestamp: new Date().toISOString() }]);
    }

    setLoading(false);
    fetch("/api/calendar/webhook").catch(() => {});
  }

  async function sendMessage() {
    if (!input.trim() || streaming) return;
    const userMsg = { role: "user", content: input.trim(), timestamp: new Date().toISOString() };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput("");
    setStreaming(true);
    setStreamText("");
    scrollChat();

    try {
      const res = await fetch("/api/north/chat", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: newMessages, conversationType, dreamId: activeDream?.id }),
      });
      if (res.status === 503) {
        setMessages(prev => [...prev, { role: "assistant", content: "North está temporariamente indisponível.", timestamp: new Date().toISOString() }]);
        setStreaming(false); return;
      }
      if (res.status === 402) { router.push("/upgrade?trigger=blocks"); setStreaming(false); return; }

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
              if (d.text) { full += d.text; setStreamText(full); scrollChat(); }
              if (d.done) {
                setMessages(prev => [...prev, { role: "assistant", content: full }]);
                setStreamText("");
                scrollChat();
              }
            } catch {}
          }
        }
      }
    } catch {
      setMessages(prev => [...prev, { role: "assistant", content: "Algo deu errado." }]);
    } finally { setStreaming(false); }
  }

  async function generatePlan() {
    if (!activeDream || generatingPlan) return;
    setGeneratingPlan(true);
    try {
      const res = await fetch("/api/plan/generate", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dreamId: activeDream.id }),
      });
      if (res.ok) { await loadData(); router.push(`/objectives?dreamId=${activeDream.id}`); }
    } catch {}
    setGeneratingPlan(false);
  }

  async function generateShareCard() {
    if (!activeDream) return;
    const res = await fetch("/api/share", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dreamId: activeDream.id }),
    });
    if (res.ok) {
      const { card } = await res.json();
      setToast(`Card de progresso gerado:\n\n"Investi ${card.hours_invested}h em ${card.days_working} dias construindo meu sonho. ${card.hashtag}"`);
    }
  }

  async function createWitness() {
    if (!activeDream || !witnessName.trim()) return;
    const res = await fetch("/api/witnesses", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dreamId: activeDream.id, witnessName }),
    });
    if (res.ok) { const { url } = await res.json(); setWitnessUrl(url); setWitnessName(""); }
  }

  const fmtDate = (iso: string) => new Date(iso).toLocaleDateString("pt-BR", {
    weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit"
  });

  if (loading) return (
    <div style={{ minHeight: "100vh", background: T.bg, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ color: T.silver, fontSize: "14px", fontFamily: "Inter, sans-serif" }}>A carregar...</div>
    </div>
  );

  const isNewDreamFlow = newDreamStep !== "idle";

  return (
    <div style={{ minHeight: "100vh", background: T.bg, color: T.light, fontFamily: "Inter, sans-serif", display: "flex", flexDirection: "column" }}>

      {/* Header — hierarquia clara */}
      <div style={{ borderBottom: `1px solid ${T.border}`, padding: "14px 24px", display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, background: `${T.bg}F0`, backdropFilter: "blur(12px)", zIndex: 50, flexWrap: "wrap", gap: "8px" }}>
        <p style={{ fontFamily: "'Playfair Display', serif", fontSize: "18px", fontWeight: 700, margin: 0, letterSpacing: "0.04em" }}>DP.</p>
        <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
          {/* Objetivos — destaque principal */}
          {activeDream && (
            <button onClick={() => router.push(`/objectives?dreamId=${activeDream.id}`)}
              style={{ padding: "7px 14px", background: T.blue, border: "none", borderRadius: "8px", color: T.light, fontSize: "12px", fontWeight: 500, cursor: "pointer", fontFamily: "Inter, sans-serif" }}>
              Objetivos
            </button>
          )}
          {/* Timeline — secundário */}
          {activeDream && (
            <button onClick={() => router.push(`/timeline?dreamId=${activeDream.id}`)}
              style={{ padding: "7px 14px", background: "transparent", border: `1px solid ${T.border}`, borderRadius: "8px", color: T.silver, fontSize: "12px", cursor: "pointer", fontFamily: "Inter, sans-serif" }}>
              Timeline
            </button>
          )}
          <button onClick={() => router.push("/dreams")}
            style={{ padding: "7px 14px", background: "transparent", border: `1px solid ${T.border}`, borderRadius: "8px", color: T.silver, fontSize: "12px", cursor: "pointer", fontFamily: "Inter, sans-serif" }}>
            Sonhos
          </button>
          <button onClick={() => router.push("/account")}
            style={{ padding: "7px 14px", background: "transparent", border: `1px solid ${T.border}`, borderRadius: "8px", color: T.silver, fontSize: "12px", cursor: "pointer", fontFamily: "Inter, sans-serif" }}>
            Conta
          </button>
        </div>
      </div>

      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
        {/* Sidebar */}
        <div style={{ width: "240px", borderRight: `1px solid ${T.border}`, padding: "20px 16px", flexShrink: 0, display: "flex", flexDirection: "column", gap: "18px", overflowY: "auto" }}>

          {activeDream ? (
            <div>
              <p style={{ fontSize: "10px", color: T.silver, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: "8px" }}>Sonho ativo</p>
              <div onClick={() => router.push(`/objectives?dreamId=${activeDream.id}`)} style={{ padding: "12px", background: `${T.blue}11`, border: `1px solid ${T.blue}33`, borderRadius: "10px", cursor: "pointer" }}>
                <p style={{ fontFamily: "'Playfair Display', serif", fontSize: "13px", margin: "0 0 6px", lineHeight: 1.3 }}>{activeDream.title}</p>
                {activeDream.blocks_total > 0 && (
                  <>
                    <div style={{ height: "2px", background: T.border, borderRadius: "999px", marginBottom: "4px" }}>
                      <div style={{ height: "100%", width: `${activeDream.progress || 0}%`, background: T.blue, borderRadius: "999px" }} />
                    </div>
                    <p style={{ fontSize: "11px", color: T.silver, margin: 0 }}>{activeDream.blocks_completed || 0} blocos</p>
                  </>
                )}
              </div>
            </div>
          ) : (
            <button onClick={() => router.push("/onboarding")}
              style={{ padding: "12px", background: T.blue, border: "none", borderRadius: "8px", color: T.light, fontSize: "13px", cursor: "pointer", fontFamily: "Inter, sans-serif" }}>
              + Novo sonho
            </button>
          )}

          {nextBlock ? (
            <div>
              <p style={{ fontSize: "10px", color: T.silver, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: "8px" }}>Próximo bloco</p>
              <div onClick={() => router.push(`/block/${nextBlock.id}`)} style={{ padding: "12px", background: T.surface, border: `1px solid ${T.amber}44`, borderRadius: "10px", cursor: "pointer" }}>
                <p style={{ margin: "0 0 4px", fontSize: "12px", fontWeight: 500, lineHeight: 1.3 }}>{nextBlock.title}</p>
                <p style={{ margin: "0 0 8px", fontSize: "11px", color: T.silver }}>{fmtDate(nextBlock.scheduled_at)}</p>
                <button onClick={e => { e.stopPropagation(); router.push(`/block/${nextBlock.id}`); }}
                  style={{ width: "100%", padding: "7px", background: T.blue, border: "none", borderRadius: "6px", color: T.light, fontSize: "11px", cursor: "pointer", fontFamily: "Inter, sans-serif", fontWeight: 500 }}>
                  Executar →
                </button>
              </div>
            </div>
          ) : activeDream && (
            <button onClick={generatePlan} disabled={generatingPlan}
              style={{ width: "100%", padding: "10px", background: generatingPlan ? T.border : `${T.blue}22`, border: `1px solid ${T.blue}44`, borderRadius: "8px", color: T.blue, fontSize: "12px", cursor: "pointer", fontFamily: "Inter, sans-serif", textAlign: "left" }}>
              {generatingPlan ? "Gerando plano..." : "Gerar plano com North →"}
            </button>
          )}

          {witnessMessage && (
            <div style={{ padding: "10px", background: `${T.mauve}11`, border: `1px solid ${T.mauve}33`, borderRadius: "8px" }}>
              <p style={{ fontSize: "10px", color: T.mauve, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "4px" }}>Testemunha</p>
              <p style={{ margin: 0, fontSize: "11px", fontStyle: "italic", lineHeight: 1.5 }}>{witnessMessage}</p>
            </div>
          )}

          {/* Tipos de conversa */}
          <div>
            <p style={{ fontSize: "10px", color: T.silver, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: "8px" }}>Conversa com North</p>
            {[
              { key: "checkin",     label: "Check-in" },
              { key: "extraction",  label: "Novo sonho" },
              { key: "pre_block",   label: "Pré-bloco" },
              { key: "post_block",  label: "Pós-bloco" },
              { key: "crisis",      label: "Momento difícil" },
              { key: "revaluation", label: "Reavaliar" },
            ].map(t => (
              <button key={t.key} onClick={() => selectConversationType(t.key)}
                style={{ display: "block", width: "100%", padding: "7px 10px", marginBottom: "2px", background: conversationType === t.key && !isNewDreamFlow ? `${T.blue}22` : "transparent", border: `1px solid ${conversationType === t.key && !isNewDreamFlow ? T.blue + "44" : "transparent"}`, borderRadius: "6px", color: conversationType === t.key && !isNewDreamFlow ? T.blue : T.silver, fontSize: "12px", cursor: "pointer", textAlign: "left", fontFamily: "Inter, sans-serif" }}>
                {t.label}
              </button>
            ))}
          </div>

          {activeDream && (
            <div>
              <p style={{ fontSize: "10px", color: T.silver, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: "8px" }}>Partilhar</p>
              <button onClick={() => setShowWitnessModal(true)}
                style={{ display: "block", width: "100%", padding: "7px 10px", marginBottom: "4px", background: `${T.mauve}22`, border: `1px solid ${T.mauve}44`, borderRadius: "6px", color: T.mauve, fontSize: "11px", cursor: "pointer", textAlign: "left", fontFamily: "Inter, sans-serif" }}>
                + Convidar Testemunha {witnesses.length > 0 ? `(${witnesses.length})` : ""}
              </button>
              <button onClick={generateShareCard}
                style={{ display: "block", width: "100%", padding: "7px 10px", background: "transparent", border: `1px solid ${T.border}`, borderRadius: "6px", color: T.silver, fontSize: "11px", cursor: "pointer", textAlign: "left", fontFamily: "Inter, sans-serif" }}>
                Gerar card de progresso
              </button>
            </div>
          )}

          <div style={{ marginTop: "auto", paddingTop: "8px", borderTop: `1px solid ${T.border}` }}>
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <div style={{ width: "6px", height: "6px", borderRadius: "50%", background: calendarConnected ? T.green : T.silver }} />
              <span style={{ fontSize: "11px", color: T.silver }}>{calendarConnected ? "Calendar ativo" : "Calendar inativo"}</span>
            </div>
          </div>
        </div>

        {/* Área de chat */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>

          {/* Mensagens */}
          <div style={{ flex: 1, padding: "28px 36px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "12px" }}>
            {messages.length === 0 && (
              <div style={{ margin: "auto", textAlign: "center", maxWidth: "320px" }}>
                <p style={{ fontFamily: "'Playfair Display', serif", fontSize: "36px", fontWeight: 300, color: `${T.light}22`, marginBottom: "16px" }}>N</p>
                <p style={{ fontSize: "14px", fontWeight: 300, fontStyle: "italic", color: T.light, lineHeight: 1.8, margin: "0 0 6px" }}>Olá. Eu sou North.<br />Estou aqui.</p>
                <p style={{ fontSize: "12px", color: T.silver }}>Escreve o que tens em mente.</p>
              </div>
            )}
            {messages.map((m: any, i: number) => (
              <div key={i} style={{ maxWidth: m.role === "user" ? "72%" : "82%", alignSelf: m.role === "user" ? "flex-end" : "flex-start", padding: "11px 15px", borderRadius: "12px", background: m.role === "user" ? T.surface : T.card, border: `1px solid ${T.border}`, borderLeft: m.role === "assistant" ? `2px solid ${T.silver}` : undefined }}>
                <p style={{ margin: 0, fontSize: "13px", lineHeight: 1.75, fontWeight: m.role === "assistant" ? 300 : 400, fontStyle: m.role === "assistant" ? "italic" : "normal", whiteSpace: "pre-wrap" }}>{m.content}</p>
              </div>
            ))}
            {streaming && streamText && (
              <div style={{ maxWidth: "82%", padding: "11px 15px", background: T.card, borderRadius: "12px", border: `1px solid ${T.border}`, borderLeft: `2px solid ${T.silver}` }}>
                <p style={{ margin: 0, fontSize: "13px", fontWeight: 300, fontStyle: "italic", lineHeight: 1.75 }}>{streamText}<span style={{ opacity: 0.4 }}>▊</span></p>
              </div>
            )}
            {streaming && !streamText && (
              <div style={{ padding: "11px 15px", background: T.card, borderRadius: "12px", border: `1px solid ${T.border}`, alignSelf: "flex-start" }}>
                <p style={{ margin: 0, fontSize: "12px", color: T.silver, fontStyle: "italic" }}>North está pensando...</p>
              </div>
            )}
            <div ref={chatBottomRef} style={{ height: "1px" }} />
          </div>

          {/* Input — fluxo Novo Sonho OU input normal, nunca os dois */}
          <div style={{ borderTop: `1px solid ${T.border}`, padding: "14px 36px 24px" }}>
            {isNewDreamFlow ? (
              // Fluxo Novo Sonho — input dedicado
              newDreamStep === "input" ? (
                <div style={{ display: "flex", gap: "8px" }}>
                  <input
                    value={newDreamInput}
                    onChange={e => setNewDreamInput(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && handleNewDreamSubmit()}
                    placeholder="Descreve o novo sonho..."
                    autoFocus
                    style={{ flex: 1, background: T.card, border: `1px solid ${T.blue}55`, borderRadius: "10px", padding: "11px 15px", color: T.light, fontSize: "13px", fontFamily: "Inter, sans-serif", outline: "none" }}
                  />
                  <button onClick={handleNewDreamSubmit} disabled={!newDreamInput.trim()}
                    style={{ padding: "11px 16px", background: newDreamInput.trim() ? T.blue : T.border, border: "none", borderRadius: "10px", color: T.light, fontSize: "13px", cursor: "pointer", fontFamily: "Inter, sans-serif" }}>→</button>
                </div>
              ) : newDreamStep === "synergy" ? (
                <div style={{ display: "flex", gap: "8px" }}>
                  <button onClick={() => confirmNewDream(true)}
                    style={{ flex: 1, padding: "11px", background: `${T.blue}22`, border: `1px solid ${T.blue}44`, borderRadius: "8px", color: T.blue, fontSize: "12px", cursor: "pointer", fontFamily: "Inter, sans-serif", fontWeight: 500 }}>
                    Os dois em paralelo
                  </button>
                  <button onClick={() => confirmNewDream(false)}
                    style={{ flex: 1, padding: "11px", background: "transparent", border: `1px solid ${T.border}`, borderRadius: "8px", color: T.silver, fontSize: "12px", cursor: "pointer", fontFamily: "Inter, sans-serif" }}>
                    Terminar o atual primeiro
                  </button>
                </div>
              ) : null
            ) : (
              // Input normal de conversa com North
              <div style={{ display: "flex", gap: "8px", alignItems: "flex-end" }}>
                <textarea value={input} onChange={e => setInput(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && !e.shiftKey && (e.preventDefault(), sendMessage())}
                  placeholder="Escreve para North..." rows={2} disabled={streaming}
                  style={{ flex: 1, background: T.card, border: `1px solid ${T.border}`, borderRadius: "10px", padding: "11px 15px", color: T.light, fontSize: "13px", fontFamily: "Inter, sans-serif", resize: "none", outline: "none", lineHeight: 1.5, opacity: streaming ? 0.6 : 1 }}
                />
                <button onClick={sendMessage} disabled={streaming || !input.trim()}
                  style={{ padding: "11px 16px", background: input.trim() && !streaming ? T.blue : T.border, border: "none", borderRadius: "10px", color: T.light, fontSize: "13px", fontWeight: 500, cursor: "pointer", fontFamily: "Inter, sans-serif" }}>→</button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modal Testemunha */}
      {showWitnessModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, padding: "24px" }}>
          <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: "16px", padding: "28px", maxWidth: "380px", width: "100%" }}>
            <p style={{ fontFamily: "'Playfair Display', serif", fontSize: "18px", margin: "0 0 6px" }}>Testemunha do Sonho</p>
            <p style={{ fontSize: "12px", color: T.silver, lineHeight: 1.6, marginBottom: "20px" }}>A testemunha vê o seu progresso, mas não as conversas com North.</p>
            {!witnessUrl ? (
              <>
                <input value={witnessName} onChange={e => setWitnessName(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && createWitness()}
                  placeholder="Nome da testemunha"
                  style={{ width: "100%", background: T.surface, border: `1px solid ${T.border}`, borderRadius: "8px", padding: "11px", color: T.light, fontSize: "13px", fontFamily: "Inter, sans-serif", outline: "none", boxSizing: "border-box", marginBottom: "10px" }} />
                <button onClick={createWitness} disabled={!witnessName.trim()}
                  style={{ width: "100%", padding: "11px", background: witnessName.trim() ? T.mauve : T.border, border: "none", borderRadius: "8px", color: T.light, fontSize: "13px", cursor: "pointer", fontFamily: "Inter, sans-serif", fontWeight: 500 }}>
                  Criar link
                </button>
              </>
            ) : (
              <div>
                <p style={{ fontSize: "12px", color: T.silver, marginBottom: "8px" }}>Partilha este link com a testemunha:</p>
                <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: "8px", padding: "10px", fontSize: "11px", fontFamily: "monospace", color: T.light, wordBreak: "break-all", marginBottom: "10px" }}>{witnessUrl}</div>
                <button onClick={() => navigator.clipboard.writeText(witnessUrl)}
                  style={{ width: "100%", padding: "10px", background: T.mauve, border: "none", borderRadius: "8px", color: T.light, fontSize: "13px", cursor: "pointer", fontFamily: "Inter, sans-serif" }}>
                  Copiar link
                </button>
              </div>
            )}
            <button onClick={() => { setShowWitnessModal(false); setWitnessUrl(""); setWitnessName(""); }}
              style={{ width: "100%", marginTop: "8px", padding: "10px", background: "transparent", border: `1px solid ${T.border}`, borderRadius: "8px", color: T.silver, fontSize: "12px", cursor: "pointer", fontFamily: "Inter, sans-serif" }}>
              Fechar
            </button>
          </div>
        </div>
      )}

      {toast && <Toast msg={toast} onClose={() => setToast(null)} />}
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
