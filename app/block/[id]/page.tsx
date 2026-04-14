// @ts-nocheck
"use client";
import { useEffect, useState, useRef, Suspense } from "react";
import { useRouter, useParams } from "next/navigation";

const T = {
  bg: "#0D0D14", card: "#1A1A2E", light: "#E8E4DC",
  silver: "#6B6B80", blue: "#4A6FA5", green: "#2D6A4F",
  amber: "#C9853A", border: "#252538", surface: "#141420",
  mauve: "#7B5EA7",
};

const SESSION_COLOR: Record<string, string> = {
  learn: T.blue, practice: T.amber, review: T.mauve, test: T.green,
};
const SESSION_LABEL: Record<string, string> = {
  learn: "Aprender", practice: "Praticar", review: "Rever", test: "Testar",
};
const DIFF_COLOR: Record<string, string> = {
  easy: T.green, medium: T.amber, hard: "#E05252",
};
const DIFF_LABEL: Record<string, string> = {
  easy: "Fácil", medium: "Médio", hard: "Desafiador",
};

function BlockContent() {
  const router  = useRouter();
  const params  = useParams();
  const blockId = params.id as string;
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Fases
  const [phase, setPhase] = useState<"loading"|"briefing"|"active"|"post"|"done">("loading");

  // Dados
  const [block,     setBlock]     = useState<any>(null);
  const [brief,     setBrief]     = useState<any>(null);
  const [objective, setObjective] = useState<any>(null);
  const [dream,     setDream]     = useState<any>(null);
  const [dreamId,   setDreamId]   = useState<string|null>(null);

  // Chat com North
  const [messages,   setMessages]   = useState<any[]>([]);
  const [chatInput,  setChatInput]  = useState("");
  const [streaming,  setStreaming]  = useState(false);
  const [streamText, setStreamText] = useState("");

  // Timer
  const [timeLeft,  setTimeLeft]  = useState(0);
  const [postStep,  setPostStep]  = useState(0);
  const [postAns,   setPostAns]   = useState("");
  const [postObs,   setPostObs]   = useState("");
  const timerRef = useRef<any>(null);

  useEffect(() => {
    loadBrief();
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []);

  async function loadBrief() {
    const res = await fetch("/api/north/task-brief", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ blockId }),
    });
    if (res.ok) {
      const data = await res.json();
      setBlock(data.block);
      setBrief(data.brief);
      setObjective(data.objective);
      setDream(data.dream);
      setDreamId(data.block?.dream_id || null);
      setTimeLeft((data.block?.duration_minutes || 30) * 60);
      // Iniciar chat com mensagem de boas-vindas de North
      if (data.brief?.mission) {
        setMessages([{
          role: "assistant",
          content: `${data.brief.mission}\n\nTem alguma dúvida sobre esta tarefa antes de começar?`,
        }]);
      }
    }
    setPhase("briefing");
  }

  const scrollChat = () => setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: "smooth" }), 60);

  async function sendChat() {
    if (!chatInput.trim() || streaming) return;
    const msg = { role: "user", content: chatInput.trim() };
    const newMessages = [...messages, msg];
    setMessages(newMessages);
    setChatInput("");
    setStreaming(true);
    setStreamText("");
    scrollChat();

    const res = await fetch("/api/north/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: newMessages,
        conversationType: "pre_block",
        dreamId,
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
    setStreaming(false);
  }

  function startBlock() {
    setPhase("active");
    fetch(`/api/blocks/${blockId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "active" }),
    });
    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) { clearInterval(timerRef.current); setPhase("post"); return 0; }
        return prev - 1;
      });
    }, 1000);
  }

  async function submitPost() {
    if (postStep === 0 && !postAns.trim()) return;
    if (postStep === 0) { setPostStep(1); return; }
    await fetch(`/api/blocks/${blockId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "completed", notes: `${postAns} | ${postObs}` }),
    });
    await fetch("/api/north/post-block", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ blockId, dreamId, completed: postAns, obstacle: postObs }),
    });
    setPhase("done");
  }

  const fmtTime = (s: number) =>
    `${String(Math.floor(s/60)).padStart(2,"0")}:${String(s%60).padStart(2,"0")}`;
  const progress = block
    ? ((block.duration_minutes*60 - timeLeft) / (block.duration_minutes*60)) * 100
    : 0;
  const sessColor = SESSION_COLOR[block?.session_type] || T.blue;
  const backUrl   = dreamId ? `/schedule?dreamId=${dreamId}` : "/dashboard";

  // ── LOADING ────────────────────────────────────────────────────────────────
  if (phase === "loading") return (
    <div style={{ minHeight:"100vh", background:T.bg, display:"flex", alignItems:"center", justifyContent:"center" }}>
      <div style={{ textAlign:"center" }}>
        <p style={{ fontFamily:"'Playfair Display',serif", fontSize:"20px", color:T.silver, marginBottom:"8px" }}>North está preparando o seu briefing...</p>
        <p style={{ fontSize:"13px", color:T.silver, fontFamily:"Inter,sans-serif" }}>Isso leva alguns segundos.</p>
      </div>
    </div>
  );

  // ── BRIEFING ───────────────────────────────────────────────────────────────
  if (phase === "briefing") return (
    <div style={{ minHeight:"100vh", background:T.bg, color:T.light, fontFamily:"Inter,sans-serif", display:"flex", flexDirection:"column" }}>

      {/* Header */}
      <div style={{ borderBottom:`1px solid ${T.border}`, padding:"14px 28px", display:"flex", alignItems:"center", justifyContent:"space-between", position:"sticky", top:0, background:`${T.bg}F8`, backdropFilter:"blur(12px)", zIndex:50 }}>
        <button onClick={()=>router.push(backUrl)} style={{ background:"none", border:"none", color:T.silver, cursor:"pointer", fontSize:"13px", fontFamily:"Inter,sans-serif" }}>
          ← Agenda
        </button>
        <div style={{ display:"flex", alignItems:"center", gap:"10px" }}>
          {block?.session_type && (
            <span style={{ fontSize:"11px", color:sessColor, background:`${sessColor}18`, padding:"3px 10px", borderRadius:"999px", border:`1px solid ${sessColor}33` }}>
              {SESSION_LABEL[block.session_type]}
            </span>
          )}
          {brief?.difficulty && (
            <span style={{ fontSize:"11px", color:DIFF_COLOR[brief.difficulty] || T.silver }}>
              {DIFF_LABEL[brief.difficulty] || brief.difficulty}
            </span>
          )}
          {block?.is_critical && (
            <span style={{ fontSize:"11px", color:T.amber }}>★ Crítica</span>
          )}
        </div>
      </div>

      <div style={{ flex:1, display:"flex", gap:0, overflow:"hidden" }}>

        {/* Painel esquerdo — Briefing */}
        <div style={{ width:"55%", padding:"28px 32px", overflowY:"auto", borderRight:`1px solid ${T.border}` }}>

          {/* Contexto */}
          {(dream || objective) && (
            <div style={{ marginBottom:"20px", padding:"10px 14px", background:`${T.blue}0A`, border:`1px solid ${T.blue}22`, borderRadius:"8px" }}>
              {dream && <p style={{ margin:"0 0 2px", fontSize:"10px", color:T.silver, textTransform:"uppercase", letterSpacing:"0.08em" }}>Sonho</p>}
              {dream && <p style={{ margin:"0 0 8px", fontSize:"13px", fontFamily:"'Playfair Display',serif" }}>{dream.title}</p>}
              {objective && <p style={{ margin:"0 0 2px", fontSize:"10px", color:T.blue, textTransform:"uppercase", letterSpacing:"0.08em" }}>Objetivo</p>}
              {objective && <p style={{ margin:0, fontSize:"13px", fontWeight:500 }}>{objective.title}</p>}
              {objective?.why && <p style={{ margin:"4px 0 0", fontSize:"11px", color:T.silver, fontStyle:"italic" }}>→ {objective.why}</p>}
            </div>
          )}

          {/* Título da tarefa */}
          <div style={{ marginBottom:"24px" }}>
            {brief?.focus_word && (
              <p style={{ margin:"0 0 8px", fontSize:"11px", color:sessColor, textTransform:"uppercase", letterSpacing:"0.12em", fontWeight:600 }}>
                {brief.focus_word}
              </p>
            )}
            <h1 style={{ margin:"0 0 6px", fontSize:"22px", fontFamily:"'Playfair Display',serif", lineHeight:1.3 }}>
              {block?.title}
            </h1>
            {block?.description && (
              <p style={{ margin:0, fontSize:"14px", color:T.silver, lineHeight:1.6 }}>{block.description}</p>
            )}
          </div>

          {/* Missão de North */}
          {brief?.mission && (
            <div style={{ marginBottom:"24px", padding:"16px 20px", background:T.card, borderLeft:`3px solid ${T.silver}`, borderRadius:"0 8px 8px 0" }}>
              <p style={{ margin:"0 0 4px", fontSize:"10px", color:T.silver, textTransform:"uppercase", letterSpacing:"0.08em" }}>North</p>
              <p style={{ margin:0, fontSize:"14px", fontWeight:300, fontStyle:"italic", lineHeight:1.8, color:T.light }}>
                {brief.mission}
              </p>
            </div>
          )}

          {/* Recurso */}
          {block?.resource_url && (
            <a href={block.resource_url} target="_blank" rel="noopener noreferrer"
              style={{ display:"flex", alignItems:"center", gap:"12px", padding:"14px 18px", background:T.surface, border:`1px solid ${T.blue}33`, borderRadius:"10px", textDecoration:"none", marginBottom:"24px" }}>
              <div style={{ width:"36px", height:"36px", background:`${T.blue}22`, borderRadius:"8px", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                <span style={{ fontSize:"18px" }}>🔗</span>
              </div>
              <div style={{ flex:1 }}>
                <p style={{ margin:"0 0 2px", fontSize:"13px", fontWeight:500, color:T.light }}>{block.resource_name || "Abrir recurso"}</p>
                <p style={{ margin:0, fontSize:"11px", color:T.blue, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", maxWidth:"240px" }}>{block.resource_url}</p>
              </div>
              <span style={{ fontSize:"12px", color:T.blue, flexShrink:0 }}>Abrir →</span>
            </a>
          )}

          {/* Passos */}
          {brief?.steps?.length > 0 && (
            <div style={{ marginBottom:"24px" }}>
              <p style={{ margin:"0 0 12px", fontSize:"11px", color:T.silver, textTransform:"uppercase", letterSpacing:"0.08em" }}>
                Como fazer estes 30 minutos
              </p>
              {brief.steps.map((step: string, i: number) => (
                <div key={i} style={{ display:"flex", gap:"12px", marginBottom:"10px" }}>
                  <div style={{ width:"22px", height:"22px", borderRadius:"50%", background:`${sessColor}22`, border:`1px solid ${sessColor}44`, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, marginTop:"1px" }}>
                    <span style={{ fontSize:"11px", fontWeight:700, color:sessColor }}>{i+1}</span>
                  </div>
                  <p style={{ margin:0, fontSize:"13px", lineHeight:1.6, color:T.light }}>{step}</p>
                </div>
              ))}
            </div>
          )}

          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"12px", marginBottom:"24px" }}>
            {/* Preparação */}
            {brief?.prepare?.length > 0 && (
              <div style={{ padding:"14px 16px", background:T.surface, border:`1px solid ${T.border}`, borderRadius:"10px" }}>
                <p style={{ margin:"0 0 10px", fontSize:"10px", color:T.silver, textTransform:"uppercase", letterSpacing:"0.08em" }}>
                  Antes de começar
                </p>
                {brief.prepare.map((item: string, i: number) => (
                  <div key={i} style={{ display:"flex", gap:"8px", marginBottom:"6px", alignItems:"flex-start" }}>
                    <span style={{ color:T.amber, fontSize:"12px", marginTop:"2px" }}>◦</span>
                    <p style={{ margin:0, fontSize:"12px", color:T.light, lineHeight:1.4 }}>{item}</p>
                  </div>
                ))}
              </div>
            )}

            {/* Resultado esperado */}
            {brief?.expected_outcome && (
              <div style={{ padding:"14px 16px", background:T.surface, border:`1px solid ${T.border}`, borderRadius:"10px" }}>
                <p style={{ margin:"0 0 8px", fontSize:"10px", color:T.silver, textTransform:"uppercase", letterSpacing:"0.08em" }}>
                  Ao final dos 30min
                </p>
                <p style={{ margin:0, fontSize:"12px", color:T.light, lineHeight:1.5 }}>{brief.expected_outcome}</p>
              </div>
            )}
          </div>

          {/* Dica de North */}
          {brief?.north_tip && (
            <div style={{ padding:"12px 16px", background:`${T.amber}0A`, border:`1px solid ${T.amber}22`, borderRadius:"10px" }}>
              <p style={{ margin:"0 0 4px", fontSize:"10px", color:T.amber, textTransform:"uppercase", letterSpacing:"0.08em" }}>💡 Dica de North</p>
              <p style={{ margin:0, fontSize:"13px", color:T.light, fontStyle:"italic", lineHeight:1.6 }}>{brief.north_tip}</p>
            </div>
          )}
        </div>

        {/* Painel direito — Chat com North */}
        <div style={{ width:"45%", display:"flex", flexDirection:"column" }}>
          <div style={{ padding:"16px 20px", borderBottom:`1px solid ${T.border}`, background:T.surface }}>
            <p style={{ margin:0, fontSize:"12px", color:T.silver }}>
              Fala com North sobre esta tarefa — qualquer dúvida, bloqueio ou preparação.
            </p>
          </div>

          {/* Mensagens */}
          <div style={{ flex:1, padding:"16px 20px", overflowY:"auto", display:"flex", flexDirection:"column", gap:"10px" }}>
            {messages.map((m, i) => (
              <div key={i} style={{
                maxWidth:"88%",
                alignSelf: m.role==="user" ? "flex-end" : "flex-start",
                padding:"10px 14px",
                borderRadius:"10px",
                background: m.role==="user" ? T.surface : T.card,
                border:`1px solid ${T.border}`,
                borderLeft: m.role==="assistant" ? `2px solid ${T.silver}` : undefined,
              }}>
                <p style={{ margin:0, fontSize:"13px", lineHeight:1.7, fontWeight: m.role==="assistant" ? 300 : 400, fontStyle: m.role==="assistant" ? "italic" : "normal", whiteSpace:"pre-wrap" }}>
                  {m.content}
                </p>
              </div>
            ))}
            {streaming && streamText && (
              <div style={{ maxWidth:"88%", padding:"10px 14px", background:T.card, borderRadius:"10px", border:`1px solid ${T.border}`, borderLeft:`2px solid ${T.silver}` }}>
                <p style={{ margin:0, fontSize:"13px", fontWeight:300, fontStyle:"italic", lineHeight:1.7 }}>{streamText}<span style={{ opacity:0.4 }}>▊</span></p>
              </div>
            )}
            {streaming && !streamText && (
              <div style={{ padding:"10px 14px", background:T.card, borderRadius:"10px", border:`1px solid ${T.border}`, alignSelf:"flex-start" }}>
                <p style={{ margin:0, fontSize:"12px", color:T.silver, fontStyle:"italic" }}>North está pensando...</p>
              </div>
            )}
            <div ref={chatEndRef} style={{ height:"1px" }} />
          </div>

          {/* Input de chat */}
          <div style={{ padding:"12px 20px", borderTop:`1px solid ${T.border}` }}>
            <div style={{ display:"flex", gap:"8px" }}>
              <input
                value={chatInput}
                onChange={e => setChatInput(e.target.value)}
                onKeyDown={e => e.key==="Enter" && sendChat()}
                placeholder="Pergunta algo a North sobre esta tarefa..."
                disabled={streaming}
                style={{ flex:1, background:T.card, border:`1px solid ${T.border}`, borderRadius:"8px", padding:"10px 14px", color:T.light, fontSize:"13px", fontFamily:"Inter,sans-serif", outline:"none", opacity:streaming?0.6:1 }}
              />
              <button onClick={sendChat} disabled={!chatInput.trim()||streaming}
                style={{ padding:"10px 14px", background:chatInput.trim()&&!streaming?T.blue:T.border, border:"none", borderRadius:"8px", color:T.light, cursor:"pointer", fontSize:"13px" }}>→</button>
            </div>
          </div>
        </div>
      </div>

      {/* Footer — CTA */}
      <div style={{ borderTop:`1px solid ${T.border}`, padding:"16px 32px", display:"flex", alignItems:"center", justifyContent:"space-between", background:`${T.bg}F8`, position:"sticky", bottom:0 }}>
        <div>
          <p style={{ margin:0, fontSize:"11px", color:T.silver }}>Duração: {block?.duration_minutes||30} min</p>
        </div>
        <button onClick={startBlock}
          style={{ padding:"13px 32px", background:T.blue, border:"none", borderRadius:"10px", color:T.light, fontSize:"14px", fontWeight:600, cursor:"pointer", fontFamily:"Inter,sans-serif", letterSpacing:"0.02em" }}>
          Iniciar bloco →
        </button>
      </div>
    </div>
  );

  // ── TIMER ACTIVO ───────────────────────────────────────────────────────────
  if (phase === "active") return (
    <div style={{ minHeight:"100vh", background:T.bg, color:T.light, fontFamily:"Inter,sans-serif", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:"24px" }}>
      <div style={{ width:"100%", maxWidth:"480px", textAlign:"center" }}>

        <span style={{ fontSize:"10px", color:T.blue, letterSpacing:"0.1em", textTransform:"uppercase" }}>Em andamento</span>

        <p style={{ fontFamily:"monospace", fontSize:"80px", fontWeight:300, letterSpacing:"0.04em", margin:"20px 0 4px", color:timeLeft<60?T.amber:T.light }}>
          {fmtTime(timeLeft)}
        </p>
        <p style={{ fontSize:"11px", color:T.silver, marginBottom:"28px" }}>restantes</p>

        <div style={{ height:"3px", background:T.border, borderRadius:"999px", marginBottom:"28px" }}>
          <div style={{ height:"100%", width:`${progress}%`, background:sessColor, borderRadius:"999px", transition:"width 1s linear" }} />
        </div>

        {/* Tarefa + recurso visíveis durante o timer */}
        <div style={{ padding:"16px 20px", background:T.card, border:`1px solid ${T.border}`, borderRadius:"12px", marginBottom:"20px", textAlign:"left" }}>
          <p style={{ margin:"0 0 4px", fontSize:"14px", fontStyle:"italic", fontWeight:300, lineHeight:1.6 }}>{block?.title}</p>
          {block?.description && <p style={{ margin:"0 0 6px", fontSize:"11px", color:T.silver, lineHeight:1.4 }}>{block.description}</p>}
          {block?.resource_url && (
            <a href={block.resource_url} target="_blank" rel="noopener noreferrer"
              style={{ display:"inline-flex", alignItems:"center", gap:"4px", fontSize:"11px", color:T.blue, textDecoration:"none" }}>
              🔗 {block.resource_name || "Abrir recurso"}
            </a>
          )}
        </div>

        {/* Passos resumidos */}
        {brief?.steps?.length > 0 && (
          <div style={{ textAlign:"left", marginBottom:"20px" }}>
            {brief.steps.map((step: string, i: number) => (
              <div key={i} style={{ display:"flex", gap:"8px", marginBottom:"6px", opacity:0.7 }}>
                <span style={{ fontSize:"10px", color:sessColor, minWidth:"16px", paddingTop:"2px" }}>{i+1}.</span>
                <p style={{ margin:0, fontSize:"12px", color:T.silver, lineHeight:1.4 }}>{step}</p>
              </div>
            ))}
          </div>
        )}

        {/* Chat rápido durante execução */}
        <div style={{ display:"flex", gap:"8px", marginBottom:"12px" }}>
          <input value={chatInput} onChange={e=>setChatInput(e.target.value)}
            onKeyDown={e=>e.key==="Enter"&&sendChat()}
            placeholder="Chamar North..."
            style={{ flex:1, background:T.card, border:`1px solid ${T.border}`, borderRadius:"8px", padding:"9px 12px", color:T.light, fontSize:"12px", fontFamily:"Inter,sans-serif", outline:"none" }}
          />
          <button onClick={sendChat} disabled={!chatInput.trim()||streaming}
            style={{ padding:"9px 12px", background:chatInput.trim()?T.blue:T.border, border:"none", borderRadius:"8px", color:T.light, cursor:"pointer", fontSize:"12px" }}>→</button>
        </div>

        <button onClick={()=>{ clearInterval(timerRef.current); setPhase("post"); }}
          style={{ padding:"9px 20px", background:"transparent", border:`1px solid ${T.border}`, borderRadius:"8px", color:T.silver, fontSize:"12px", cursor:"pointer", fontFamily:"Inter,sans-serif" }}>
          Terminar antecipadamente
        </button>
      </div>
    </div>
  );

  // ── PÓS-BLOCO ──────────────────────────────────────────────────────────────
  if (phase === "post") return (
    <div style={{ minHeight:"100vh", background:T.bg, color:T.light, fontFamily:"Inter,sans-serif", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:"24px" }}>
      <div style={{ width:"100%", maxWidth:"480px" }}>
        <div style={{ width:"40px", height:"2px", background:T.green, borderRadius:"999px", margin:"0 auto 28px" }} />
        <p style={{ fontFamily:"'Playfair Display',serif", fontSize:"22px", textAlign:"center", marginBottom:"28px" }}>Bloco concluído.</p>

        {postStep === 0 ? (
          <div>
            <p style={{ fontSize:"14px", fontWeight:300, fontStyle:"italic", marginBottom:"10px", lineHeight:1.7 }}>O que você concluiu?</p>
            <textarea value={postAns} onChange={e=>setPostAns(e.target.value)}
              placeholder="Descreve o que fizeste..." rows={3}
              style={{ width:"100%", background:T.card, border:`1px solid ${T.border}`, borderRadius:"10px", padding:"11px 14px", color:T.light, fontSize:"13px", fontFamily:"Inter,sans-serif", resize:"none", outline:"none", boxSizing:"border-box" }}
            />
            <button onClick={submitPost} disabled={!postAns.trim()}
              style={{ width:"100%", marginTop:"10px", padding:"13px", background:postAns.trim()?T.green:T.border, border:"none", borderRadius:"10px", color:T.light, fontSize:"13px", fontWeight:500, cursor:postAns.trim()?"pointer":"default", fontFamily:"Inter,sans-serif" }}>
              Continuar
            </button>
          </div>
        ) : (
          <div>
            <p style={{ fontSize:"14px", fontWeight:300, fontStyle:"italic", marginBottom:"10px", lineHeight:1.7 }}>Houve algum obstáculo?</p>
            <textarea value={postObs} onChange={e=>setPostObs(e.target.value)}
              placeholder="Opcional — o que tornou difícil?" rows={3}
              style={{ width:"100%", background:T.card, border:`1px solid ${T.border}`, borderRadius:"10px", padding:"11px 14px", color:T.light, fontSize:"13px", fontFamily:"Inter,sans-serif", resize:"none", outline:"none", boxSizing:"border-box" }}
            />
            <button onClick={submitPost}
              style={{ width:"100%", marginTop:"10px", padding:"13px", background:T.green, border:"none", borderRadius:"10px", color:T.light, fontSize:"13px", fontWeight:500, cursor:"pointer", fontFamily:"Inter,sans-serif" }}>
              Guardar
            </button>
          </div>
        )}
      </div>
    </div>
  );

  // ── DONE ───────────────────────────────────────────────────────────────────
  if (phase === "done") return (
    <div style={{ minHeight:"100vh", background:T.bg, color:T.light, fontFamily:"Inter,sans-serif", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:"24px" }}>
      <div style={{ width:"100%", maxWidth:"420px", textAlign:"center" }}>
        <div style={{ width:"56px", height:"2px", background:T.green, borderRadius:"999px", margin:"0 auto 28px" }} />
        <p style={{ fontFamily:"'Playfair Display',serif", fontSize:"26px", marginBottom:"8px" }}>Feito.</p>
        <p style={{ fontSize:"13px", color:T.silver, marginBottom:"36px", lineHeight:1.6 }}>
          Mais um bloco real em direção ao seu sonho.
        </p>
        <div style={{ display:"flex", flexDirection:"column", gap:"8px" }}>
          <button onClick={()=>router.push(backUrl)}
            style={{ padding:"13px", background:T.blue, border:"none", borderRadius:"10px", color:T.light, fontSize:"13px", fontWeight:500, cursor:"pointer", fontFamily:"Inter,sans-serif" }}>
            ← Voltar à Agenda
          </button>
          <button onClick={()=>router.push(dreamId?`/objectives?dreamId=${dreamId}`:"/dashboard")}
            style={{ padding:"11px", background:"transparent", border:`1px solid ${T.border}`, borderRadius:"10px", color:T.silver, fontSize:"12px", cursor:"pointer", fontFamily:"Inter,sans-serif" }}>
            Ver objetivos
          </button>
        </div>
      </div>
    </div>
  );

  return null;
}

export default function BlockPage() {
  return (
    <Suspense fallback={<div style={{ minHeight:"100vh", background:"#0D0D14" }} />}>
      <BlockContent />
    </Suspense>
  );
}
