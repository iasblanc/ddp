// @ts-nocheck
"use client";
import { useAuthGuard } from "@/lib/auth-guard";
import { useEffect, useState, useRef, Suspense } from "react";
import { useRouter } from "next/navigation";

// ── Design tokens ────────────────────────────────────────────────────────────
const T = {
  bg:      "#0D0D14",
  surface: "#141420",
  card:    "#1A1A2E",
  cardHi:  "#1E2035",
  light:   "#E8E4DC",
  silver:  "#6B6B80",
  dim:     "#3A3A50",
  blue:    "#4A6FA5",
  blueHi:  "#5580BA",
  green:   "#2D6A4F",
  amber:   "#C9853A",
  mauve:   "#7B5EA7",
  border:  "#252538",
  borderHi:"#2E2E48",
};

// ── Helpers ──────────────────────────────────────────────────────────────────
function fmtDateTime(iso: string) {
  const d = new Date(iso);
  const local = new Date(d.getTime() - 3 * 3600000);
  const days  = ["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"];
  const months= ["jan","fev","mar","abr","mai","jun","jul","ago","set","out","nov","dez"];
  return `${days[local.getUTCDay()]}, ${local.getUTCDate()} ${months[local.getUTCMonth()]} · ${String(local.getUTCHours()).padStart(2,"0")}h${String(local.getUTCMinutes()).padStart(2,"0")}`;
}

function isBlockSoon(iso: string) {
  const diff = new Date(iso).getTime() - Date.now();
  return diff > 0 && diff < 2 * 3600000; // próximas 2h
}

// ── Toast ────────────────────────────────────────────────────────────────────
function Toast({ msg, onClose }: { msg: string; onClose: () => void }) {
  useEffect(() => { const t = setTimeout(onClose, 4000); return () => clearTimeout(t); }, []);
  return (
    <div style={{ position:"fixed", bottom:"24px", left:"50%", transform:"translateX(-50%)", background:T.card, border:`1px solid ${T.border}`, borderRadius:"12px", padding:"14px 20px", maxWidth:"440px", width:"90%", zIndex:200, boxShadow:"0 16px 48px rgba(0,0,0,0.5)", fontFamily:"Inter,sans-serif" }}>
      <p style={{ margin:0, fontSize:"13px", color:T.light, lineHeight:1.6, whiteSpace:"pre-wrap" }}>{msg}</p>
    </div>
  );
}

// ── Main ─────────────────────────────────────────────────────────────────────
function DashboardContent() {
  const router = useRouter();
  useAuthGuard();
  const chatEndRef    = useRef<HTMLDivElement>(null);
  const inputRef      = useRef<HTMLTextAreaElement>(null);

  const [activeDream,     setActiveDream]     = useState<any>(null);
  const [nextBlock,       setNextBlock]       = useState<any>(null);
  const [weekStats,       setWeekStats]       = useState({ done:0, total:0, streak:0, hours:0 });
  const [messages,        setMessages]        = useState<any[]>([]);
  const [input,           setInput]           = useState("");
  const [streaming,       setStreaming]        = useState(false);
  const [streamText,      setStreamText]       = useState("");
  const [convType,        setConvType]         = useState("checkin");
  const [loading,         setLoading]          = useState(true);
  const [calConnected,    setCalConnected]     = useState(false);
  const [generatingPlan,  setGeneratingPlan]   = useState(false);
  const [toast,           setToast]            = useState<string|null>(null);
  const [witnessMessage,  setWitnessMessage]   = useState<string|null>(null);
  const [witnesses,       setWitnesses]        = useState<any[]>([]);
  const [showWitness,     setShowWitness]      = useState(false);
  const [witnessName,     setWitnessName]      = useState("");
  const [witnessUrl,      setWitnessUrl]       = useState("");
  const [newDreamStep,    setNewDreamStep]     = useState<"idle"|"input"|"synergy">("idle");
  const [newDreamText,    setNewDreamText]     = useState("");
  const [newDreamInput,   setNewDreamInput]    = useState("");
  const [hoveredCard,     setHoveredCard]      = useState<string|null>(null);
  const [activeConvHover, setActiveConvHover]  = useState<string|null>(null);

  const scrollChat = () => setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior:"smooth" }), 60);

  // ── Load ──────────────────────────────────────────────────────────────────
  useEffect(() => { loadData(); }, []);

  async function loadData() {
    setLoading(true);
    const [dreamsRes, calRes, retRes] = await Promise.all([
      fetch("/api/dreams"),
      fetch("/api/calendar/sync"),
      fetch("/api/retention"),
    ]);

    if (dreamsRes.ok) {
      const { dreams } = await dreamsRes.json();
      const active = dreams?.find((d: any) => d.status === "active");
      if (active) {
        setActiveDream(active);
        const [blocksRes, wRes] = await Promise.all([
          fetch(`/api/blocks?dreamId=${active.id}&days=14`),
          fetch(`/api/witnesses?dreamId=${active.id}`),
        ]);
        if (blocksRes.ok) {
          const { blocks } = await blocksRes.json();
          setNextBlock(blocks?.[0] || null);
          // Stats da semana
          const now = new Date();
          const weekAgo = new Date(now.getTime() - 7*86400000);
          const thisWeek = (blocks||[]).filter((b:any) => new Date(b.scheduled_at) >= weekAgo);
          const done  = thisWeek.filter((b:any) => b.status === "completed").length;
          const total = thisWeek.length;
          const hours = done * 0.5;
          setWeekStats({ done, total, streak: active.streak || 0, hours });
        }
        if (wRes.ok) {
          const { witnesses: ws } = await wRes.json();
          setWitnesses(ws||[]);
          const latest = (ws||[]).flatMap((w:any) => w.messages||[])
            .sort((a:any,b:any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0];
          if (latest) setWitnessMessage(`${latest.from}: "${latest.content}"`);
        }
      } else if (!dreams?.length) {
        router.push("/onboarding"); return;
      }
    }

    if (calRes.ok) { const { connected } = await calRes.json(); setCalConnected(connected); }

    let hasRetention = false;
    if (retRes.ok) {
      const { north_message } = await retRes.json();
      if (north_message) {
        hasRetention = true;
        setMessages([{ role:"assistant", content:north_message }]);
      }
    }
    if (!hasRetention) {
      const h = new Date().getHours();
      const gr = h<12 ? "Bom dia." : h<18 ? "Boa tarde." : "Boa noite.";
      setMessages([{ role:"assistant", content:`${gr}\n\nEstou aqui.` }]);
    }
    setLoading(false);
    fetch("/api/calendar/webhook").catch(()=>{});
  }

  // ── Conversation types ───────────────────────────────────────────────────
  const convTypes = [
    { key:"checkin",     label:"Check-in",       icon:"◎" },
    { key:"pre_block",   label:"Pré-bloco",       icon:"▷" },
    { key:"post_block",  label:"Pós-bloco",       icon:"◈" },
    { key:"crisis",      label:"Momento difícil", icon:"⊙" },
    { key:"revaluation", label:"Reavaliar",       icon:"◉" },
    { key:"extraction",  label:"Novo sonho",      icon:"+" },
  ];

  function selectConvType(type: string) {
    if (streaming) return;
    setConvType(type);
    setNewDreamStep("idle");
    setNewDreamInput("");
    setInput("");
    const openers: Record<string,string> = {
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
      setMessages([{ role:"assistant", content: activeDream
        ? `Você tem um sonho ativo: "${activeDream.title}"\n\nAntes de avançar, vou verificar a sinergia.\n\nQual é o novo sonho?`
        : "Qual é o novo sonho que você quer trabalhar?" }]);
      scrollChat(); return;
    }
    if (openers[type]) {
      setMessages([{ role:"assistant", content:openers[type] }]);
      scrollChat();
    }
  }

  // ── Chat ─────────────────────────────────────────────────────────────────
  async function sendMessage() {
    if (!input.trim() || streaming) return;
    const userMsg = { role:"user", content:input.trim() };
    const newMsgs = [...messages, userMsg];
    setMessages(newMsgs); setInput(""); setStreaming(true); setStreamText(""); scrollChat();
    try {
      const res = await fetch("/api/north/chat", {
        method:"POST", headers:{"Content-Type":"application/json"},
        body:JSON.stringify({ messages:newMsgs, conversationType:convType, dreamId:activeDream?.id }),
      });
      if (res.status===503) { setMessages(p=>[...p,{role:"assistant",content:"North está temporariamente indisponível."}]); setStreaming(false); return; }
      if (res.status===402) { router.push("/upgrade?trigger=blocks"); setStreaming(false); return; }
      const reader = res.body!.getReader();
      const dec = new TextDecoder();
      let full = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        for (const line of dec.decode(value).split("\n")) {
          if (line.startsWith("data: ")) {
            try {
              const d = JSON.parse(line.slice(6));
              if (d.text) { full += d.text; setStreamText(full); scrollChat(); }
              if (d.done) { setMessages(p=>[...p,{role:"assistant",content:full}]); setStreamText(""); scrollChat(); }
            } catch {}
          }
        }
      }
    } catch { setMessages(p=>[...p,{role:"assistant",content:"Algo deu errado."}]); }
    finally { setStreaming(false); }
  }

  // ── New dream flow ────────────────────────────────────────────────────────
  async function handleNewDreamSubmit() {
    if (!newDreamInput.trim() || streaming) return;
    const dream = newDreamInput.trim();
    setNewDreamText(dream); setNewDreamInput("");
    setMessages(p=>[...p,{role:"user",content:dream}]);
    if (activeDream) {
      setNewDreamStep("synergy");
      const r = await fetch(`/api/blocks?dreamId=${activeDream.id}&days=30`).then(r=>r.json()).catch(()=>({}));
      const scheduled = Array.isArray(r.blocks)?r.blocks.length:0;
      setMessages(p=>[...p,{role:"assistant",content:`Analisei seu plano atual.\n\nVocê tem ${scheduled} blocos agendados nas próximas 4 semanas para "${activeDream.title}".\n\nPosso encaixar um novo sonho em paralelo — mas dependendo do tempo disponível, isso pode estender os prazos.\n\nComo prefere?`}]);
    } else { router.push(`/onboarding?dream=${encodeURIComponent(dream)}`); }
    scrollChat();
  }

  async function confirmNewDream(parallel: boolean) {
    if (parallel) { router.push(`/onboarding?dream=${encodeURIComponent(newDreamText)}`); }
    else {
      setMessages(p=>[...p,{role:"assistant",content:`Entendido. O sonho "${newDreamText}" fica na fila.\n\nVou te lembrar dele quando o sonho atual estiver concluído.`}]);
      await fetch("/api/dreams",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({title:newDreamText})});
      setNewDreamStep("idle"); scrollChat();
    }
  }

  // ── Other actions ─────────────────────────────────────────────────────────
  async function generatePlan() {
    if (!activeDream||generatingPlan) return;
    setGeneratingPlan(true);
    try {
      const res = await fetch("/api/plan/generate",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({dreamId:activeDream.id})});
      if (res.ok) { await loadData(); router.push(`/objectives?dreamId=${activeDream.id}`); }
    } catch {}
    setGeneratingPlan(false);
  }

  async function generateShareCard() {
    if (!activeDream) return;
    const res = await fetch("/api/share",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({dreamId:activeDream.id})});
    if (res.ok) {
      const { card } = await res.json();
      setToast(`Card de progresso gerado:\n\n"Investi ${card.hours_invested}h em ${card.days_working} dias construindo meu sonho. ${card.hashtag}"`);
    }
  }

  async function createWitness() {
    if (!activeDream||!witnessName.trim()) return;
    const res = await fetch("/api/witnesses",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({dreamId:activeDream.id,witnessName})});
    if (res.ok) { const { url } = await res.json(); setWitnessUrl(url); setWitnessName(""); }
  }

  const isNewDreamFlow = newDreamStep !== "idle";
  const pct = activeDream?.blocks_total ? Math.round((activeDream.blocks_completed||0)/activeDream.blocks_total*100) : 0;
  const soon = nextBlock && isBlockSoon(nextBlock.scheduled_at);

  if (loading) return (
    <div style={{ minHeight:"100vh", background:T.bg, display:"flex", alignItems:"center", justifyContent:"center" }}>
      <p style={{ fontFamily:"'Playfair Display',serif", fontSize:"18px", color:T.silver }}>A carregar...</p>
    </div>
  );

  return (
    <div style={{ minHeight:"100vh", background:T.bg, color:T.light, fontFamily:"Inter,sans-serif", display:"flex", flexDirection:"column" }}>

      {/* ── HEADER ─────────────────────────────────────────────────────────── */}
      <header style={{ borderBottom:`1px solid ${T.border}`, padding:"12px 28px", display:"flex", alignItems:"center", justifyContent:"space-between", position:"sticky", top:0, background:`${T.bg}F2`, backdropFilter:"blur(16px)", zIndex:60, gap:"12px" }}>
        <div style={{ display:"flex", alignItems:"center", gap:"20px" }}>
          <p style={{ fontFamily:"'Playfair Display',serif", fontSize:"20px", fontWeight:700, margin:0, letterSpacing:"0.04em", color:T.light }}>DP.</p>
          {activeDream && (
            <div style={{ display:"flex", alignItems:"center", gap:"6px" }}>
              <span style={{ color:T.dim, fontSize:"14px" }}>→</span>
              <span style={{ fontSize:"12px", color:T.silver, maxWidth:"260px", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{activeDream.title}</span>
            </div>
          )}
        </div>
        <nav style={{ display:"flex", gap:"4px", alignItems:"center" }}>
          {activeDream && [
            { label:"Agenda",    path:`/schedule?dreamId=${activeDream.id}`,   primary:true },
            { label:"Objetivos", path:`/objectives?dreamId=${activeDream.id}`, primary:false },
            { label:"Timeline",  path:`/timeline?dreamId=${activeDream.id}`,   primary:false },
            { label:"Sonhos",    path:"/dreams",                                primary:false },
          ].map(n => (
            <button key={n.label} onClick={()=>router.push(n.path)}
              style={{ padding:"6px 14px", background:n.primary?T.blue:"transparent", border:`1px solid ${n.primary?T.blue:T.border}`, borderRadius:"7px", color:n.primary?T.light:T.silver, fontSize:"12px", fontWeight:n.primary?500:400, cursor:"pointer", fontFamily:"Inter,sans-serif", transition:"all 200ms ease" }}>
              {n.label}
            </button>
          ))}
          <button onClick={()=>router.push("/account")}
            style={{ width:"32px", height:"32px", background:"transparent", border:`1px solid ${T.border}`, borderRadius:"50%", color:T.silver, fontSize:"14px", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center" }}>
            ↗
          </button>
        </nav>
      </header>

      <div style={{ flex:1, display:"flex", flexDirection:"column", maxWidth:"1200px", margin:"0 auto", width:"100%", padding:"24px 28px 0", gap:"16px", overflow:"hidden" }}>

        {/* ── HERO ROW: Dream + Next block + Stats ──────────────────────────── */}
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:"12px", flexShrink:0 }}>

          {/* Card 1 — Sonho Ativo */}
          <div
            onMouseEnter={()=>setHoveredCard("dream")}
            onMouseLeave={()=>setHoveredCard(null)}
            onClick={()=>activeDream && router.push(`/objectives?dreamId=${activeDream.id}`)}
            style={{ padding:"20px 22px", background:hoveredCard==="dream"?T.cardHi:T.card, border:`1px solid ${hoveredCard==="dream"?T.borderHi:T.border}`, borderRadius:"14px", cursor:activeDream?"pointer":"default", transition:"all 220ms ease", position:"relative", overflow:"hidden" }}>
            {/* Glow sutil */}
            <div style={{ position:"absolute", top:0, left:0, right:0, height:"2px", background:`linear-gradient(90deg, ${T.blue}00, ${T.blue}88, ${T.blue}00)`, opacity:activeDream?1:0 }} />
            <p style={{ margin:"0 0 10px", fontSize:"10px", color:T.silver, textTransform:"uppercase", letterSpacing:"0.1em" }}>Sonho ativo</p>
            {activeDream ? (
              <>
                <p style={{ margin:"0 0 14px", fontFamily:"'Playfair Display',serif", fontSize:"15px", lineHeight:1.4, color:T.light }}>{activeDream.title}</p>
                <div style={{ height:"3px", background:T.surface, borderRadius:"999px", marginBottom:"8px" }}>
                  <div style={{ height:"100%", width:`${pct}%`, background:`linear-gradient(90deg,${T.blue},${T.blueHi})`, borderRadius:"999px", transition:"width 600ms ease" }} />
                </div>
                <div style={{ display:"flex", justifyContent:"space-between" }}>
                  <span style={{ fontSize:"11px", color:T.silver }}>{activeDream.blocks_completed||0} de {activeDream.blocks_total||0} blocos</span>
                  <span style={{ fontSize:"11px", color:T.blue, fontWeight:500 }}>{pct}%</span>
                </div>
              </>
            ) : (
              <button onClick={()=>router.push("/onboarding")}
                style={{ width:"100%", padding:"10px", background:T.blue, border:"none", borderRadius:"8px", color:T.light, fontSize:"12px", fontWeight:500, cursor:"pointer", fontFamily:"Inter,sans-serif" }}>
                + Começar novo sonho
              </button>
            )}
          </div>

          {/* Card 2 — Próxima Tarefa */}
          <div
            onMouseEnter={()=>setHoveredCard("block")}
            onMouseLeave={()=>setHoveredCard(null)}
            style={{ padding:"20px 22px", background:hoveredCard==="block"?T.cardHi:T.card, border:`1px solid ${soon?"#C9853A55":hoveredCard==="block"?T.borderHi:T.border}`, borderRadius:"14px", cursor:nextBlock?"pointer":"default", transition:"all 220ms ease", position:"relative", overflow:"hidden" }}
            onClick={()=>nextBlock && router.push(`/block/${nextBlock.id}`)}>
            {soon && <div style={{ position:"absolute", top:0, left:0, right:0, height:"2px", background:`linear-gradient(90deg,${T.amber}00,${T.amber}AA,${T.amber}00)` }} />}
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:"10px" }}>
              <p style={{ margin:0, fontSize:"10px", color:T.silver, textTransform:"uppercase", letterSpacing:"0.1em" }}>Próxima tarefa</p>
              {soon && <span style={{ fontSize:"9px", color:T.amber, background:`${T.amber}22`, border:`1px solid ${T.amber}44`, padding:"1px 7px", borderRadius:"4px", fontWeight:600 }}>EM BREVE</span>}
            </div>
            {nextBlock ? (
              <>
                <p style={{ margin:"0 0 4px", fontSize:"13px", fontWeight:500, lineHeight:1.4, color:T.light, overflow:"hidden", display:"-webkit-box", WebkitLineClamp:2, WebkitBoxOrient:"vertical" }}>{nextBlock.title}</p>
                <p style={{ margin:"0 0 14px", fontSize:"11px", color:T.silver }}>{fmtDateTime(nextBlock.scheduled_at)}</p>
                <div style={{ display:"flex", gap:"6px" }}>
                  <button onClick={e=>{e.stopPropagation();router.push(`/block/${nextBlock.id}`)}}
                    style={{ flex:1, padding:"8px", background:T.blue, border:"none", borderRadius:"8px", color:T.light, fontSize:"11px", fontWeight:600, cursor:"pointer", fontFamily:"Inter,sans-serif", letterSpacing:"0.02em" }}>
                    Executar →
                  </button>
                  <button onClick={e=>{e.stopPropagation();router.push(`/schedule?dreamId=${activeDream?.id}`)}}
                    style={{ padding:"8px 10px", background:"transparent", border:`1px solid ${T.border}`, borderRadius:"8px", color:T.silver, fontSize:"11px", cursor:"pointer", fontFamily:"Inter,sans-serif" }}>
                    Agenda
                  </button>
                </div>
              </>
            ) : activeDream ? (
              <div>
                <p style={{ margin:"0 0 10px", fontSize:"12px", color:T.silver, lineHeight:1.5, fontStyle:"italic" }}>Sem blocos agendados.</p>
                <button onClick={e=>{e.stopPropagation();generatePlan()}} disabled={generatingPlan}
                  style={{ width:"100%", padding:"8px", background:generatingPlan?T.surface:`${T.blue}22`, border:`1px solid ${T.blue}44`, borderRadius:"8px", color:T.blue, fontSize:"11px", cursor:"pointer", fontFamily:"Inter,sans-serif" }}>
                  {generatingPlan?"A gerar...":"Gerar plano com North →"}
                </button>
              </div>
            ) : (
              <p style={{ margin:"0", fontSize:"12px", color:T.dim, fontStyle:"italic" }}>Nenhum sonho ativo.</p>
            )}
          </div>

          {/* Card 3 — Esta semana */}
          <div style={{ padding:"20px 22px", background:T.card, border:`1px solid ${T.border}`, borderRadius:"14px" }}>
            <p style={{ margin:"0 0 14px", fontSize:"10px", color:T.silver, textTransform:"uppercase", letterSpacing:"0.1em" }}>Esta semana</p>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"10px", marginBottom:"14px" }}>
              {[
                { val: weekStats.done,  label:"blocos feitos",   color:T.green },
                { val: weekStats.total, label:"agendados",       color:T.silver },
                { val: weekStats.hours, label:"horas investidas", color:T.blue, fmt:(v:number)=>`${v}h` },
                { val: weekStats.streak,label:"dias seguidos",   color:T.amber },
              ].map((s,i) => (
                <div key={i} style={{ padding:"10px 12px", background:T.surface, borderRadius:"8px" }}>
                  <p style={{ margin:"0 0 2px", fontSize:"20px", fontWeight:700, color:s.color, fontFamily:"monospace" }}>
                    {s.fmt ? s.fmt(s.val) : s.val}
                  </p>
                  <p style={{ margin:0, fontSize:"10px", color:T.silver }}>{s.label}</p>
                </div>
              ))}
            </div>
            {/* Status do calendário + partilha */}
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", paddingTop:"10px", borderTop:`1px solid ${T.border}` }}>
              <div style={{ display:"flex", alignItems:"center", gap:"5px" }}>
                <div style={{ width:"6px", height:"6px", borderRadius:"50%", background:calConnected?T.green:T.dim }} />
                <span style={{ fontSize:"10px", color:T.silver }}>{calConnected?"Calendar ativo":"Calendar inativo"}</span>
              </div>
              {activeDream && (
                <button onClick={()=>setShowWitness(true)} title="Testemunha do Sonho"
                  style={{ fontSize:"11px", color:T.mauve, background:"transparent", border:`1px solid ${T.mauve}44`, borderRadius:"5px", padding:"2px 8px", cursor:"pointer", fontFamily:"Inter,sans-serif" }}>
                  👁 {witnesses.length>0?witnesses.length:"Testemunha"}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* ── Mensagem da testemunha ────────────────────────────────────────── */}
        {witnessMessage && (
          <div style={{ padding:"12px 18px", background:`${T.mauve}0A`, border:`1px solid ${T.mauve}22`, borderRadius:"10px", display:"flex", alignItems:"center", gap:"12px", flexShrink:0 }}>
            <span style={{ fontSize:"14px" }}>💬</span>
            <p style={{ margin:0, fontSize:"12px", color:T.light, fontStyle:"italic", lineHeight:1.5 }}>{witnessMessage}</p>
          </div>
        )}

        {/* ── Chips de tipo de conversa ─────────────────────────────────────── */}
        <div style={{ display:"flex", gap:"6px", flexWrap:"wrap", flexShrink:0 }}>
          {convTypes.map(c => {
            const active = convType===c.key && !isNewDreamFlow;
            return (
              <button key={c.key} onClick={()=>selectConvType(c.key)}
                onMouseEnter={()=>setActiveConvHover(c.key)}
                onMouseLeave={()=>setActiveConvHover(null)}
                style={{ padding:"6px 14px", background:active?`${T.blue}22`:activeConvHover===c.key?T.surface:"transparent", border:`1px solid ${active?T.blue+"55":T.border}`, borderRadius:"999px", color:active?T.blue:T.silver, fontSize:"12px", fontWeight:active?500:400, cursor:"pointer", fontFamily:"Inter,sans-serif", display:"flex", alignItems:"center", gap:"5px", transition:"all 180ms ease" }}>
                <span style={{ fontSize:"10px", opacity:0.7 }}>{c.icon}</span>
                {c.label}
              </button>
            );
          })}
          {activeDream && (
            <button onClick={generateShareCard}
              onMouseEnter={()=>setActiveConvHover("share")}
              onMouseLeave={()=>setActiveConvHover(null)}
              style={{ marginLeft:"auto", padding:"6px 14px", background:activeConvHover==="share"?T.surface:"transparent", border:`1px solid ${T.border}`, borderRadius:"999px", color:T.silver, fontSize:"12px", cursor:"pointer", fontFamily:"Inter,sans-serif" }}>
              Gerar card
            </button>
          )}
        </div>

        {/* ── NORTH CHAT ───────────────────────────────────────────────────── */}
        <div style={{ flex:1, display:"flex", flexDirection:"column", minHeight:0, background:T.card, border:`1px solid ${T.border}`, borderRadius:"14px 14px 0 0", overflow:"hidden" }}>

          {/* Mensagens */}
          <div style={{ flex:1, padding:"20px 28px", overflowY:"auto", display:"flex", flexDirection:"column", gap:"10px" }}>
            {messages.length === 0 && (
              <div style={{ margin:"auto", textAlign:"center" }}>
                <p style={{ fontFamily:"'Playfair Display',serif", fontSize:"48px", fontWeight:300, color:`${T.light}14`, margin:"0 0 12px" }}>N</p>
                <p style={{ fontSize:"14px", fontWeight:300, fontStyle:"italic", color:T.light, lineHeight:1.8, margin:"0 0 4px" }}>Olá. Eu sou North.<br/>Estou aqui.</p>
                <p style={{ fontSize:"12px", color:T.silver }}>Escreve o que tens em mente.</p>
              </div>
            )}
            {messages.map((m:any,i:number) => (
              <div key={i} style={{ maxWidth:m.role==="user"?"68%":"78%", alignSelf:m.role==="user"?"flex-end":"flex-start", padding:"11px 16px", borderRadius:m.role==="user"?"12px 12px 2px 12px":"12px 12px 12px 2px", background:m.role==="user"?T.surface:T.bg, border:`1px solid ${T.border}`, borderLeft:m.role==="assistant"?`2px solid ${T.silver}44`:undefined }}>
                <p style={{ margin:0, fontSize:"13px", lineHeight:1.8, fontWeight:m.role==="assistant"?300:400, fontStyle:m.role==="assistant"?"italic":"normal", whiteSpace:"pre-wrap", color:T.light }}>{m.content}</p>
              </div>
            ))}
            {streaming && streamText && (
              <div style={{ maxWidth:"78%", padding:"11px 16px", background:T.bg, borderRadius:"12px 12px 12px 2px", border:`1px solid ${T.border}`, borderLeft:`2px solid ${T.silver}44` }}>
                <p style={{ margin:0, fontSize:"13px", fontWeight:300, fontStyle:"italic", lineHeight:1.8 }}>{streamText}<span style={{ opacity:0.3 }}>▊</span></p>
              </div>
            )}
            {streaming && !streamText && (
              <div style={{ padding:"10px 16px", background:T.bg, borderRadius:"12px 12px 12px 2px", border:`1px solid ${T.border}`, alignSelf:"flex-start" }}>
                <p style={{ margin:0, fontSize:"12px", color:T.silver, fontStyle:"italic" }}>North está pensando...</p>
              </div>
            )}
            <div ref={chatEndRef} style={{ height:"1px" }} />
          </div>

          {/* Input area */}
          <div style={{ padding:"12px 20px 16px", borderTop:`1px solid ${T.border}22`, background:T.card }}>
            {isNewDreamFlow ? (
              newDreamStep==="input" ? (
                <div style={{ display:"flex", gap:"8px" }}>
                  <input value={newDreamInput} onChange={e=>setNewDreamInput(e.target.value)}
                    onKeyDown={e=>e.key==="Enter"&&handleNewDreamSubmit()}
                    placeholder="Descreve o novo sonho..." autoFocus
                    style={{ flex:1, background:T.surface, border:`1px solid ${T.blue}44`, borderRadius:"10px", padding:"11px 15px", color:T.light, fontSize:"13px", fontFamily:"Inter,sans-serif", outline:"none" }}
                  />
                  <button onClick={handleNewDreamSubmit} disabled={!newDreamInput.trim()}
                    style={{ padding:"11px 16px", background:newDreamInput.trim()?T.blue:T.border, border:"none", borderRadius:"10px", color:T.light, fontSize:"13px", cursor:"pointer", fontFamily:"Inter,sans-serif" }}>→</button>
                </div>
              ) : (
                <div style={{ display:"flex", gap:"8px" }}>
                  <button onClick={()=>confirmNewDream(true)}
                    style={{ flex:1, padding:"11px", background:`${T.blue}22`, border:`1px solid ${T.blue}44`, borderRadius:"8px", color:T.blue, fontSize:"12px", fontWeight:500, cursor:"pointer", fontFamily:"Inter,sans-serif" }}>
                    Os dois em paralelo
                  </button>
                  <button onClick={()=>confirmNewDream(false)}
                    style={{ flex:1, padding:"11px", background:"transparent", border:`1px solid ${T.border}`, borderRadius:"8px", color:T.silver, fontSize:"12px", cursor:"pointer", fontFamily:"Inter,sans-serif" }}>
                    Terminar o atual primeiro
                  </button>
                </div>
              )
            ) : (
              <div style={{ display:"flex", gap:"8px", alignItems:"flex-end" }}>
                <textarea ref={inputRef} value={input} onChange={e=>setInput(e.target.value)}
                  onKeyDown={e=>e.key==="Enter"&&!e.shiftKey&&(e.preventDefault(),sendMessage())}
                  placeholder="Escreve para North..." rows={2} disabled={streaming}
                  style={{ flex:1, background:T.surface, border:`1px solid ${T.border}`, borderRadius:"10px", padding:"11px 15px", color:T.light, fontSize:"13px", fontFamily:"Inter,sans-serif", resize:"none", outline:"none", lineHeight:1.5, opacity:streaming?0.6:1, transition:"border-color 150ms ease" }}
                  onFocus={e=>(e.target.style.borderColor=T.blue+"55")}
                  onBlur={e=>(e.target.style.borderColor=T.border)}
                />
                <button onClick={sendMessage} disabled={streaming||!input.trim()}
                  style={{ padding:"11px 18px", background:input.trim()&&!streaming?T.blue:T.border, border:"none", borderRadius:"10px", color:T.light, fontSize:"14px", fontWeight:600, cursor:input.trim()&&!streaming?"pointer":"default", fontFamily:"Inter,sans-serif", transition:"background 150ms ease" }}>
                  →
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Modal Testemunha ────────────────────────────────────────────────── */}
      {showWitness && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.72)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:100, padding:"24px" }}>
          <div style={{ background:T.card, border:`1px solid ${T.border}`, borderRadius:"18px", padding:"28px", maxWidth:"380px", width:"100%", boxShadow:"0 24px 64px rgba(0,0,0,0.4)" }}>
            <p style={{ fontFamily:"'Playfair Display',serif", fontSize:"18px", margin:"0 0 6px" }}>Testemunha do Sonho</p>
            <p style={{ fontSize:"12px", color:T.silver, lineHeight:1.6, marginBottom:"20px" }}>A testemunha vê o seu progresso, mas não as conversas com North.</p>
            {!witnessUrl ? (
              <>
                <input value={witnessName} onChange={e=>setWitnessName(e.target.value)}
                  onKeyDown={e=>e.key==="Enter"&&createWitness()}
                  placeholder="Nome da testemunha"
                  style={{ width:"100%", background:T.surface, border:`1px solid ${T.border}`, borderRadius:"8px", padding:"11px", color:T.light, fontSize:"13px", fontFamily:"Inter,sans-serif", outline:"none", boxSizing:"border-box", marginBottom:"10px" }}
                />
                <button onClick={createWitness} disabled={!witnessName.trim()}
                  style={{ width:"100%", padding:"11px", background:witnessName.trim()?T.mauve:T.border, border:"none", borderRadius:"8px", color:T.light, fontSize:"13px", fontWeight:500, cursor:"pointer", fontFamily:"Inter,sans-serif" }}>
                  Criar link
                </button>
              </>
            ) : (
              <>
                <p style={{ fontSize:"12px", color:T.silver, marginBottom:"8px" }}>Partilha este link com a testemunha:</p>
                <div style={{ background:T.surface, border:`1px solid ${T.border}`, borderRadius:"8px", padding:"10px", fontSize:"11px", fontFamily:"monospace", color:T.light, wordBreak:"break-all", marginBottom:"10px" }}>{witnessUrl}</div>
                <button onClick={()=>navigator.clipboard.writeText(witnessUrl)}
                  style={{ width:"100%", padding:"10px", background:T.mauve, border:"none", borderRadius:"8px", color:T.light, fontSize:"13px", cursor:"pointer", fontFamily:"Inter,sans-serif" }}>
                  Copiar link
                </button>
              </>
            )}
            <button onClick={()=>{setShowWitness(false);setWitnessUrl("");setWitnessName("");}}
              style={{ width:"100%", marginTop:"8px", padding:"10px", background:"transparent", border:`1px solid ${T.border}`, borderRadius:"8px", color:T.silver, fontSize:"12px", cursor:"pointer", fontFamily:"Inter,sans-serif" }}>
              Fechar
            </button>
          </div>
        </div>
      )}

      {toast && <Toast msg={toast} onClose={()=>setToast(null)} />}
    </div>
  );
}

export default function DashboardPage() {
  return (
    <Suspense fallback={<div style={{ minHeight:"100vh", background:"#0D0D14" }} />}>
      <DashboardContent />
    </Suspense>
  );
}
