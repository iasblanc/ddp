// @ts-nocheck
"use client";
import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";

const tokens = {
  deepNight: "#0D0D14", stellarGray: "#1A1A2E", northLight: "#E8E4DC",
  mutedSilver: "#6B6B80", northBlue: "#4A6FA5", executeGreen: "#2D6A4F",
  pauseAmber: "#C9853A", border: "#252538", surface: "#141420",
};

function DashboardContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [activeDream, setActiveDream] = useState<any>(null);
  const [allDreams, setAllDreams] = useState<any[]>([]);
  const [messages, setMessages] = useState<any[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [conversationType, setConversationType] = useState("checkin");
  const [loading, setLoading] = useState(true);
  const [streamText, setStreamText] = useState("");

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    setLoading(true);
    const res = await fetch("/api/dreams");
    if (res.ok) {
      const data = await res.json();
      const dreams = data.dreams || [];
      setAllDreams(dreams);
      const active = dreams.find((d: any) => d.status === "active");
      setActiveDream(active || null);
      if (!active && dreams.length === 0) {
        router.push("/onboarding");
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
        body: JSON.stringify({
          messages: newMessages,
          conversationType,
          dreamId: activeDream?.id,
          endConversation: false,
        }),
      });

      if (!res.ok) throw new Error("API error");
      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let fullText = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value);
        const lines = chunk.split("\n");
        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const data = JSON.parse(line.slice(6));
              if (data.text) {
                fullText += data.text;
                setStreamText(fullText);
              }
              if (data.done) {
                setMessages(prev => [...prev, { role: "assistant", content: fullText, timestamp: new Date().toISOString() }]);
                setStreamText("");
              }
            } catch {}
          }
        }
      }
    } catch (error) {
      console.error("Chat error:", error);
      setMessages(prev => [...prev, { role: "assistant", content: "Algo correu mal. Tenta novamente.", timestamp: new Date().toISOString() }]);
      setStreamText("");
    } finally {
      setStreaming(false);
    }
  }

  const queuedDreams = allDreams.filter(d => d.status === "queued");
  const completedDreams = allDreams.filter(d => d.status === "completed");

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", background: tokens.deepNight, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ color: tokens.mutedSilver, fontSize: "14px", fontFamily: "Inter, sans-serif" }}>A carregar...</div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: tokens.deepNight, color: tokens.northLight, fontFamily: "Inter, sans-serif", display: "flex", flexDirection: "column" }}>
      {/* Header */}
      <div style={{ borderBottom: `1px solid ${tokens.border}`, padding: "16px 24px", display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, background: `${tokens.deepNight}F0`, backdropFilter: "blur(12px)", zIndex: 50, flexWrap: "wrap", gap: "12px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          <p style={{ fontFamily: "'Playfair Display', serif", fontSize: "18px", fontWeight: 700, margin: 0, letterSpacing: "0.04em" }}>DP.</p>
          {activeDream && (
            <div>
              <span style={{ fontSize: "11px", color: tokens.mutedSilver, textTransform: "uppercase", letterSpacing: "0.08em" }}>Activo</span>
              <p style={{ margin: 0, fontSize: "14px", fontFamily: "'Playfair Display', serif" }}>{activeDream.title}</p>
            </div>
          )}
        </div>
        <div style={{ display: "flex", gap: "8px" }}>
          <button onClick={() => router.push("/dreams")}
            style={{ padding: "7px 14px", background: "transparent", border: `1px solid ${tokens.border}`, borderRadius: "8px", color: tokens.mutedSilver, fontSize: "12px", cursor: "pointer", fontFamily: "Inter, sans-serif" }}
          >Sonhos</button>
          <button onClick={() => router.push("/design-system")}
            style={{ padding: "7px 14px", background: "transparent", border: `1px solid ${tokens.border}`, borderRadius: "8px", color: tokens.mutedSilver, fontSize: "12px", cursor: "pointer", fontFamily: "Inter, sans-serif" }}
          >Design System</button>
        </div>
      </div>

      <div style={{ flex: 1, display: "flex", maxWidth: "1200px", width: "100%", margin: "0 auto", padding: "0 0" }}>
        {/* Sidebar */}
        <div style={{ width: "280px", borderRight: `1px solid ${tokens.border}`, padding: "32px 24px", flexShrink: 0, display: "flex", flexDirection: "column", gap: "32px" }}>
          {/* Sonho activo */}
          {activeDream ? (
            <div>
              <p style={{ fontSize: "10px", color: tokens.mutedSilver, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: "12px" }}>Sonho Activo</p>
              <div style={{ padding: "16px", background: `${tokens.northBlue}11`, border: `1px solid ${tokens.northBlue}33`, borderRadius: "10px" }}>
                <p style={{ fontFamily: "'Playfair Display', serif", fontSize: "15px", margin: "0 0 8px", lineHeight: 1.3 }}>{activeDream.title}</p>
                {activeDream.blocks_total > 0 && (
                  <>
                    <div style={{ height: "2px", background: tokens.border, borderRadius: "999px", marginBottom: "6px" }}>
                      <div style={{ height: "100%", width: `${activeDream.progress}%`, background: tokens.northBlue, borderRadius: "999px" }} />
                    </div>
                    <p style={{ fontSize: "11px", color: tokens.mutedSilver, margin: 0 }}>{activeDream.blocks_completed} de {activeDream.blocks_total} blocos</p>
                  </>
                )}
              </div>
            </div>
          ) : (
            <div style={{ padding: "16px", background: tokens.surface, border: `1px solid ${tokens.border}`, borderRadius: "10px", textAlign: "center" }}>
              <p style={{ fontSize: "13px", color: tokens.mutedSilver, margin: "0 0 12px" }}>Nenhum sonho activo.</p>
              <button onClick={() => router.push("/dreams")}
                style={{ padding: "8px 16px", background: tokens.northBlue, border: "none", borderRadius: "8px", color: tokens.northLight, fontSize: "12px", cursor: "pointer", fontFamily: "Inter, sans-serif" }}
              >Adicionar sonho</button>
            </div>
          )}

          {/* Tipo de conversa */}
          <div>
            <p style={{ fontSize: "10px", color: tokens.mutedSilver, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: "10px" }}>Conversa com North</p>
            <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
              {[
                { key: "checkin", label: "Check-in" },
                { key: "extraction", label: "Novo Sonho" },
                { key: "pre_block", label: "Pré-bloco" },
                { key: "post_block", label: "Pós-bloco" },
                { key: "crisis", label: "Momento difícil" },
                { key: "revaluation", label: "Reavaliar" },
              ].map(t => (
                <button key={t.key} onClick={() => setConversationType(t.key)}
                  style={{ padding: "8px 12px", background: conversationType === t.key ? `${tokens.northBlue}22` : "transparent", border: `1px solid ${conversationType === t.key ? tokens.northBlue + "44" : "transparent"}`, borderRadius: "6px", color: conversationType === t.key ? tokens.northBlue : tokens.mutedSilver, fontSize: "12px", cursor: "pointer", textAlign: "left", fontFamily: "Inter, sans-serif", transition: "all 200ms ease" }}
                >{t.label}</button>
              ))}
            </div>
          </div>

          {/* Fila */}
          {queuedDreams.length > 0 && (
            <div>
              <p style={{ fontSize: "10px", color: tokens.mutedSilver, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: "10px" }}>Fila ({queuedDreams.length})</p>
              {queuedDreams.slice(0, 3).map((d: any) => (
                <p key={d.id} style={{ fontSize: "12px", color: tokens.mutedSilver, margin: "0 0 6px", fontFamily: "'Playfair Display', serif" }}>
                  {d.title}
                </p>
              ))}
            </div>
          )}

          {/* Realizados */}
          {completedDreams.length > 0 && (
            <div>
              <p style={{ fontSize: "10px", color: tokens.executeGreen, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: "6px" }}>Realizados ✓</p>
              <p style={{ fontSize: "20px", fontWeight: 300, color: tokens.executeGreen, margin: 0, fontFamily: "'Playfair Display', serif" }}>{completedDreams.length}</p>
            </div>
          )}
        </div>

        {/* Chat principal */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: "0" }}>
          {/* Mensagens */}
          <div style={{ flex: 1, padding: "32px 40px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "16px" }}>
            {messages.length === 0 && (
              <div style={{ margin: "auto", textAlign: "center", maxWidth: "400px" }}>
                <p style={{ fontFamily: "'Playfair Display', serif", fontSize: "32px", fontWeight: 300, color: `${tokens.northLight}66`, marginBottom: "12px" }}>N</p>
                <p style={{ fontSize: "15px", fontWeight: 300, fontStyle: "italic", color: tokens.northLight, lineHeight: 1.8, margin: "0 0 8px" }}>
                  Olá. Eu sou North.<br />Estou aqui.
                </p>
                <p style={{ fontSize: "13px", color: tokens.mutedSilver }}>Escreve o que tens em mente.</p>
              </div>
            )}

            {messages.map((msg: any, i: number) => (
              <div key={i} style={{
                maxWidth: msg.role === "user" ? "75%" : "85%",
                alignSelf: msg.role === "user" ? "flex-end" : "flex-start",
                padding: "14px 18px",
                background: msg.role === "user" ? tokens.surface : tokens.stellarGray,
                borderRadius: "12px",
                border: `1px solid ${msg.role === "user" ? tokens.border : tokens.border}`,
                borderLeft: msg.role === "assistant" ? `2px solid ${tokens.mutedSilver}` : undefined,
              }}>
                <p style={{ margin: 0, fontSize: "14px", lineHeight: 1.7, fontWeight: msg.role === "assistant" ? 300 : 400, fontStyle: msg.role === "assistant" ? "italic" : "normal" }}>
                  {msg.content}
                </p>
              </div>
            ))}

            {/* Streaming */}
            {(streaming && streamText) && (
              <div style={{ maxWidth: "85%", alignSelf: "flex-start", padding: "14px 18px", background: tokens.stellarGray, borderRadius: "12px", border: `1px solid ${tokens.border}`, borderLeft: `2px solid ${tokens.mutedSilver}` }}>
                <p style={{ margin: 0, fontSize: "14px", lineHeight: 1.7, fontWeight: 300, fontStyle: "italic" }}>
                  {streamText}
                  <span style={{ opacity: 0.5, animation: "pulse 1s infinite" }}>▊</span>
                </p>
              </div>
            )}

            {streaming && !streamText && (
              <div style={{ alignSelf: "flex-start", padding: "14px 18px", background: tokens.stellarGray, borderRadius: "12px", border: `1px solid ${tokens.border}` }}>
                <p style={{ margin: 0, fontSize: "13px", color: tokens.mutedSilver, fontStyle: "italic" }}>North está a pensar...</p>
              </div>
            )}
          </div>

          {/* Input */}
          <div style={{ padding: "20px 40px 32px", borderTop: `1px solid ${tokens.border}` }}>
            <div style={{ display: "flex", gap: "10px", alignItems: "flex-end" }}>
              <textarea
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key === "Enter" && !e.shiftKey && (e.preventDefault(), sendMessage())}
                placeholder="Escreve para North..."
                rows={2}
                disabled={streaming}
                style={{ flex: 1, background: tokens.stellarGray, border: `1px solid ${tokens.border}`, borderRadius: "10px", padding: "12px 16px", color: tokens.northLight, fontSize: "14px", fontFamily: "Inter, sans-serif", resize: "none", outline: "none", lineHeight: 1.5, opacity: streaming ? 0.6 : 1 }}
              />
              <button onClick={sendMessage} disabled={streaming || !input.trim()}
                style={{ padding: "12px 20px", background: input.trim() && !streaming ? tokens.northBlue : tokens.border, border: "none", borderRadius: "10px", color: tokens.northLight, fontSize: "13px", fontWeight: 500, cursor: input.trim() && !streaming ? "pointer" : "default", fontFamily: "Inter, sans-serif", transition: "all 200ms ease", whiteSpace: "nowrap" }}
              >Enviar</button>
            </div>
            <p style={{ fontSize: "11px", color: tokens.mutedSilver, margin: "8px 0 0", textAlign: "right" }}>
              Enter para enviar · Shift+Enter para nova linha
            </p>
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
