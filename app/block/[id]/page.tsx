// @ts-nocheck
"use client";
import { useEffect, useState, useRef, Suspense } from "react";
import { useRouter, useParams } from "next/navigation";

const T = {
  bg: "#0D0D14", card: "#1A1A2E", light: "#E8E4DC",
  silver: "#6B6B80", blue: "#4A6FA5", green: "#2D6A4F",
  amber: "#C9853A", border: "#252538", surface: "#141420",
};

function BlockContent() {
  const router = useRouter();
  const params = useParams();
  const blockId = params.id as string;

  const [block, setBlock] = useState<any>(null);
  const [phase, setPhase] = useState<"pre" | "active" | "post" | "done">("pre");
  const [timeLeft, setTimeLeft] = useState(0);
  const [messages, setMessages] = useState<any[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [streamText, setStreamText] = useState("");
  const [postAnswer, setPostAnswer] = useState("");
  const [postObstacle, setPostObstacle] = useState("");
  const [postStep, setPostStep] = useState(0);
  const [loading, setLoading] = useState(true);
  const timerRef = useRef<any>(null);

  useEffect(() => {
    loadBlock();
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []);

  async function loadBlock() {
    const res = await fetch(`/api/blocks/${blockId}`);
    if (res.ok) {
      const { block } = await res.json();
      setBlock(block);
      setTimeLeft((block?.duration_minutes || 30) * 60);
      // Carregar mensagem pré-bloco de North
      await loadPreBlock(block);
    }
    setLoading(false);
  }

  async function loadPreBlock(b: any) {
    const res = await fetch("/api/north/pre-block", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ blockId: b.id, dreamId: b.dream_id, blockTitle: b.title }),
    });
    if (res.ok) {
      const { message } = await res.json();
      setMessages([{ role: "assistant", content: message, timestamp: new Date().toISOString() }]);
    }
  }

  function startBlock() {
    setPhase("active");
    // Marcar bloco como activo
    fetch(`/api/blocks/${blockId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "active" }),
    });
    // Iniciar timer
    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timerRef.current);
          setPhase("post");
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }

  function finishEarly() {
    clearInterval(timerRef.current);
    setPhase("post");
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
          conversationType: "pre_block",
          dreamId: block?.dream_id,
          blockId,
        }),
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
    } catch {} finally { setStreaming(false); }
  }

  async function submitPost() {
    if (postStep === 0) { setPostStep(1); return; }
    // Completar bloco
    await fetch(`/api/blocks/${blockId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "completed", notes: `${postAnswer} | ${postObstacle}` }),
    });
    // Post-bloco com North
    await fetch("/api/north/post-block", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ blockId, dreamId: block?.dream_id, completed: postAnswer, obstacle: postObstacle }),
    });
    // Sync calendar
    fetch("/api/calendar/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ blockId, action: "update" }),
    }).catch(() => {});
    setPhase("done");
  }

  const formatTime = (s: number) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
  const progress = block ? ((block.duration_minutes * 60 - timeLeft) / (block.duration_minutes * 60)) * 100 : 0;

  if (loading) return (
    <div style={{ minHeight: "100vh", background: T.bg, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <p style={{ color: T.silver, fontFamily: "Inter, sans-serif", fontSize: "14px" }}>A carregar...</p>
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", background: T.bg, color: T.light, fontFamily: "Inter, sans-serif", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "24px" }}>
      <div style={{ width: "100%", maxWidth: "520px" }}>

        {/* PRÉ-BLOCO */}
        {phase === "pre" && (
          <div>
            <div style={{ marginBottom: "32px" }}>
              <p style={{ fontSize: "11px", color: T.silver, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: "8px" }}>Bloco de {block?.duration_minutes || 30} min</p>
              <p style={{ fontFamily: "'Playfair Display', serif", fontSize: "22px", margin: "0 0 4px", lineHeight: 1.3 }}>{block?.title}</p>
            </div>

            {/* Mensagens North */}
            <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginBottom: "24px" }}>
              {messages.map((m: any, i: number) => (
                <div key={i} style={{
                  padding: "14px 18px", borderRadius: "12px",
                  background: m.role === "assistant" ? T.card : T.surface,
                  borderLeft: m.role === "assistant" ? `2px solid ${T.silver}` : undefined,
                  border: `1px solid ${T.border}`,
                }}>
                  <p style={{ margin: 0, fontSize: "14px", lineHeight: 1.7, fontWeight: 300, fontStyle: "italic" }}>{m.content}</p>
                </div>
              ))}
            </div>

            {/* Input para North */}
            <div style={{ display: "flex", gap: "8px", marginBottom: "20px" }}>
              <input
                value={input} onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key === "Enter" && sendMessage()}
                placeholder="Precisa de algo antes de começar?"
                style={{ flex: 1, background: T.card, border: `1px solid ${T.border}`, borderRadius: "8px", padding: "10px 14px", color: T.light, fontSize: "13px", fontFamily: "Inter, sans-serif", outline: "none" }}
              />
              <button onClick={sendMessage} disabled={!input.trim() || streaming}
                style={{ padding: "10px 14px", background: input.trim() ? T.blue : T.border, border: "none", borderRadius: "8px", color: T.light, cursor: "pointer", fontFamily: "Inter, sans-serif", fontSize: "13px" }}>→</button>
            </div>

            <button onClick={startBlock}
              style={{ width: "100%", padding: "16px", background: T.blue, border: "none", borderRadius: "12px", color: T.light, fontSize: "15px", fontWeight: 500, cursor: "pointer", fontFamily: "Inter, sans-serif", letterSpacing: "0.02em" }}>
              Começar bloco
            </button>
            <button onClick={() => router.push("/dashboard")}
              style={{ width: "100%", marginTop: "8px", padding: "12px", background: "transparent", border: `1px solid ${T.border}`, borderRadius: "10px", color: T.silver, fontSize: "13px", cursor: "pointer", fontFamily: "Inter, sans-serif" }}>
              Voltar
            </button>
          </div>
        )}

        {/* BLOCO ACTIVO — TIMER */}
        {phase === "active" && (
          <div style={{ textAlign: "center" }}>
            <p style={{ fontSize: "11px", color: T.blue, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: "24px" }}>Em andamento</p>

            {/* Timer */}
            <p style={{ fontFamily: "monospace", fontSize: "72px", fontWeight: 300, letterSpacing: "0.04em", margin: "0 0 8px", color: timeLeft < 60 ? T.amber : T.light }}>
              {formatTime(timeLeft)}
            </p>
            <p style={{ fontSize: "12px", color: T.silver, marginBottom: "32px" }}>restantes</p>

            {/* Barra de progresso */}
            <div style={{ height: "2px", background: T.border, borderRadius: "999px", marginBottom: "32px" }}>
              <div style={{ height: "100%", width: `${progress}%`, background: T.blue, borderRadius: "999px", transition: "width 1s linear" }} />
            </div>

            {/* Tarefa */}
            <div style={{ padding: "16px 20px", background: T.card, border: `1px solid ${T.border}`, borderRadius: "12px", marginBottom: "32px" }}>
              <p style={{ margin: 0, fontSize: "15px", fontStyle: "italic", fontWeight: 300, lineHeight: 1.6 }}>{block?.title}</p>
            </div>

            {/* Chat com North durante bloco */}
            {messages.length > 0 && (
              <div style={{ marginBottom: "16px", textAlign: "left" }}>
                {messages.slice(-1).map((m: any, i: number) => (
                  <div key={i} style={{ padding: "12px 16px", background: T.card, borderRadius: "10px", border: `1px solid ${T.border}`, borderLeft: `2px solid ${T.silver}` }}>
                    <p style={{ margin: 0, fontSize: "13px", fontStyle: "italic", fontWeight: 300 }}>{m.content}</p>
                  </div>
                ))}
              </div>
            )}

            <div style={{ display: "flex", gap: "8px", marginBottom: "12px" }}>
              <input
                value={input} onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key === "Enter" && sendMessage()}
                placeholder="Chamar North..."
                style={{ flex: 1, background: T.card, border: `1px solid ${T.border}`, borderRadius: "8px", padding: "10px 14px", color: T.light, fontSize: "13px", fontFamily: "Inter, sans-serif", outline: "none" }}
              />
              <button onClick={sendMessage} disabled={!input.trim() || streaming}
                style={{ padding: "10px 14px", background: input.trim() ? T.blue : T.border, border: "none", borderRadius: "8px", color: T.light, cursor: "pointer" }}>→</button>
            </div>

            <button onClick={finishEarly}
              style={{ padding: "10px 20px", background: "transparent", border: `1px solid ${T.border}`, borderRadius: "8px", color: T.silver, fontSize: "13px", cursor: "pointer", fontFamily: "Inter, sans-serif" }}>
              Terminar antecipadamente
            </button>
          </div>
        )}

        {/* PÓS-BLOCO */}
        {phase === "post" && (
          <div>
            <div style={{ width: "48px", height: "2px", background: T.green, borderRadius: "999px", margin: "0 auto 32px" }} />
            <p style={{ fontFamily: "'Playfair Display', serif", fontSize: "24px", textAlign: "center", marginBottom: "32px" }}>Bloco concluído.</p>

            {postStep === 0 ? (
              <div>
                <p style={{ fontSize: "15px", fontWeight: 300, fontStyle: "italic", color: T.light, marginBottom: "12px", lineHeight: 1.7 }}>
                  O que concluíste?
                </p>
                <textarea
                  value={postAnswer} onChange={e => setPostAnswer(e.target.value)}
                  placeholder="Descreve o que fizeste..."
                  rows={3}
                  style={{ width: "100%", background: T.card, border: `1px solid ${T.border}`, borderRadius: "10px", padding: "12px 16px", color: T.light, fontSize: "14px", fontFamily: "Inter, sans-serif", resize: "none", outline: "none", boxSizing: "border-box" }}
                />
                <button onClick={submitPost} disabled={!postAnswer.trim()}
                  style={{ width: "100%", marginTop: "12px", padding: "14px", background: postAnswer.trim() ? T.green : T.border, border: "none", borderRadius: "10px", color: T.light, fontSize: "14px", fontWeight: 500, cursor: "pointer", fontFamily: "Inter, sans-serif" }}>
                  Continuar
                </button>
              </div>
            ) : (
              <div>
                <p style={{ fontSize: "15px", fontWeight: 300, fontStyle: "italic", color: T.light, marginBottom: "12px", lineHeight: 1.7 }}>
                  Houve algum obstáculo?
                </p>
                <textarea
                  value={postObstacle} onChange={e => setPostObstacle(e.target.value)}
                  placeholder="Opcional — o que tornou este bloco difícil?"
                  rows={3}
                  style={{ width: "100%", background: T.card, border: `1px solid ${T.border}`, borderRadius: "10px", padding: "12px 16px", color: T.light, fontSize: "14px", fontFamily: "Inter, sans-serif", resize: "none", outline: "none", boxSizing: "border-box" }}
                />
                <button onClick={submitPost}
                  style={{ width: "100%", marginTop: "12px", padding: "14px", background: T.green, border: "none", borderRadius: "10px", color: T.light, fontSize: "14px", fontWeight: 500, cursor: "pointer", fontFamily: "Inter, sans-serif" }}>
                  Guardar
                </button>
              </div>
            )}
          </div>
        )}

        {/* CONCLUÍDO */}
        {phase === "done" && (
          <div style={{ textAlign: "center" }}>
            <div style={{ width: "64px", height: "2px", background: T.green, borderRadius: "999px", margin: "0 auto 32px" }} />
            <p style={{ fontFamily: "'Playfair Display', serif", fontSize: "28px", marginBottom: "8px" }}>Feito.</p>
            <p style={{ fontSize: "14px", color: T.silver, marginBottom: "40px", lineHeight: 1.6 }}>
              Mais um bloco real em direcção ao teu sonho.
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              <button onClick={() => router.push(`/plan?dreamId=${block?.dream_id}`)}
                style={{ padding: "14px", background: T.blue, border: "none", borderRadius: "10px", color: T.light, fontSize: "14px", fontWeight: 500, cursor: "pointer", fontFamily: "Inter, sans-serif" }}>
                Ver plano actualizado
              </button>
              <button onClick={() => router.push("/dashboard")}
                style={{ padding: "12px", background: "transparent", border: `1px solid ${T.border}`, borderRadius: "10px", color: T.silver, fontSize: "13px", cursor: "pointer", fontFamily: "Inter, sans-serif" }}>
                Dashboard
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function BlockPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: "100vh", background: "#0D0D14" }} />}>
      <BlockContent />
    </Suspense>
  );
}

// Verificação de limite foi movida para a API /api/north/chat (retorna 402)
// A UI já trata o erro 402 redirigindo para /upgrade
