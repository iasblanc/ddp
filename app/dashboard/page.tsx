// @ts-nocheck
"use client";
import { useAuthGuard } from "@/lib/auth-guard";
import { useEffect, useState, useRef, Suspense } from "react";
import { useRouter } from "next/navigation";

const T = {
  bg:"#0D0D14", surface:"#141420", card:"#1A1A2E", light:"#E8E4DC",
  silver:"#6B6B80", blue:"#4A6FA5", green:"#2D6A4F", amber:"#C9853A",
  mauve:"#7B5EA7", border:"#252538", dim:"#252535",
};

// ── helpers ──────────────────────────────────────────────────────────────────
function fmtTime(iso: string) {
  const d = new Date(iso);
  const local = new Date(d.getTime() - 3*3600000);
  const days=["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"];
  return `${days[local.getUTCDay()]} · ${String(local.getUTCHours()).padStart(2,"0")}h${String(local.getUTCMinutes()).padStart(2,"0")}`;
}
function daysSince(iso: string) {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
}
function hoursInvested(blocksDone: number) {
  return (blocksDone * 0.5).toFixed(1);
}
function projectedDays(done: number, total: number, daysActive: number) {
  if (done === 0 || total === 0) return null;
  const rate = done / Math.max(1, daysActive); // blocos por dia
  const remaining = total - done;
  return Math.ceil(remaining / rate);
}

// ── Toast ─────────────────────────────────────────────────────────────────
function Toast({ msg, onClose }: { msg:string; onClose:()=>void }) {
  useEffect(()=>{ const t=setTimeout(onClose,4000); return ()=>clearTimeout(t); },[]);
  return (
    <div style={{ position:"fixed", bottom:"24px", left:"50%", transform:"translateX(-50%)", background:T.card, border:`1px solid ${T.border}`, borderRadius:"12px", padding:"14px 20px", maxWidth:"440px", width:"90%", zIndex:200, boxShadow:"0 16px 48px rgba(0,0,0,0.5)", fontFamily:"Inter,sans-serif" }}>
      <p style={{ margin:0, fontSize:"13px", color:T.light, lineHeight:1.6, whiteSpace:"pre-wrap" }}>{msg}</p>
    </div>
  );
}

// ── Circular progress ─────────────────────────────────────────────────────
function CircleProgress({ pct, size=72, stroke=5, color=T.blue }: any) {
  const r = (size-stroke*2)/2;
  const circ = 2*Math.PI*r;
  const offset = circ - (pct/100)*circ;
  return (
    <svg width={size} height={size} style={{ transform:"rotate(-90deg)" }}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={T.border} strokeWidth={stroke} />
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={stroke}
        strokeDasharray={circ} strokeDashoffset={offset}
        strokeLinecap="round" style={{ transition:"stroke-dashoffset 800ms ease" }} />
    </svg>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────
function DashboardContent() {
  const router = useRouter();
  useAuthGuard();
  const chatEndRef = useRef<HTMLDivElement>(null);

  const [activeDream,    setActiveDream]    = useState<any>(null);
  const [nextBlock,      setNextBlock]      = useState<any>(null);
  const [allBlocks,      setAllBlocks]      = useState<any[]>([]);
  const [objectives,     setObjectives]     = useState<any[]>([]);
  const [messages,       setMessages]       = useState<any[]>([]);
  const [input,          setInput]          = useState("");
  const [streaming,      setStreaming]      = useState(false);
  const [streamText,     setStreamText]     = useState("");
  const [convType,       setConvType]       = useState("checkin");
  const [loading,        setLoading]        = useState(true);
  const [calConnected,   setCalConnected]   = useState(false);
  const [generatingPlan, setGeneratingPlan] = useState(false);
  const [toast,          setToast]          = useState<string|null>(null);
  const [witnesses,      setWitnesses]      = useState<any[]>([]);
  const [witnessMsg,     setWitnessMsg]     = useState<string|null>(null);
  const [showWitness,    setShowWitness]    = useState(false);
  const [witnessName,    setWitnessName]    = useState("");
  const [witnessUrl,     setWitnessUrl]     = useState("");
  const [newDreamStep,   setNewDreamStep]   = useState<"idle"|"input"|"synergy">("idle");
  const [newDreamText,   setNewDreamText]   = useState("");
  const [newDreamInput,  setNewDreamInput]  = useState("");
  const [expandStats,    setExpandStats]    = useState(false);

  const scrollChat = () => setTimeout(()=>chatEndRef.current?.scrollIntoView({behavior:"smooth"}),60);

  // ── Load ─────────────────────────────────────────────────────────────────
  useEffect(()=>{ loadData(); },[]);

  async function loadData() {
    setLoading(true);
    const [dreamsRes, calRes, retRes] = await Promise.all([
      fetch("/api/dreams"),
      fetch("/api/calendar/sync"),
      fetch("/api/retention"),
    ]);

    if (dreamsRes.ok) {
      const { dreams } = await dreamsRes.json();
      const active = dreams?.find((d:any)=>d.status==="active");
      if (active) {
        setActiveDream(active);
        const [blocksRes, objRes, wRes] = await Promise.all([
          fetch(`/api/blocks?dreamId=${active.id}&includeAll=true`),
          fetch(`/api/objectives?dreamId=${active.id}`),
          fetch(`/api/witnesses?dreamId=${active.id}`),
        ]);
        if (blocksRes.ok) {
          const { blocks } = await blocksRes.json();
          setAllBlocks(blocks||[]);
          setNextBlock((blocks||[]).find((b:any)=>b.status==="scheduled")||null);
        }
        if (objRes.ok) {
          const { objectives: objs } = await objRes.json();
          setObjectives(objs||[]);
        }
        if (wRes.ok) {
          const { witnesses:ws } = await wRes.json();
          setWitnesses(ws||[]);
          const latest = (ws||[]).flatMap((w:any)=>w.messages||[])
            .sort((a:any,b:any)=>new Date(b.timestamp).getTime()-new Date(a.timestamp).getTime())[0];
          if (latest) setWitnessMsg(`${latest.from}: "${latest.content}"`);
        }
      } else if (!dreams?.length) { router.push("/onboarding"); return; }
    }

    if (calRes.ok) { const { connected }=await calRes.json(); setCalConnected(connected); }

    let hasRet=false;
    if (retRes.ok) {
      const { north_message }=await retRes.json();
      if (north_message) { hasRet=true; setMessages([{role:"assistant",content:north_message}]); }
    }
    if (!hasRet) {
      const h=new Date().getHours();
      const gr=h<12?"Bom dia.":h<18?"Boa tarde.":"Boa noite.";
      setMessages([{role:"assistant",content:`${gr}\n\nEstou aqui.`}]);
    }
    setLoading(false);
    fetch("/api/calendar/webhook").catch(()=>{});
  }

  // ── Stats derivados ───────────────────────────────────────────────────────
  const blocksDone  = allBlocks.filter(b=>b.status==="completed").length;
  const blocksTotal = allBlocks.length;
  const pct         = blocksTotal ? Math.round(blocksDone/blocksTotal*100) : 0;
  const daysActive  = activeDream?.activated_at ? daysSince(activeDream.activated_at) : 0;
  const invested    = hoursInvested(blocksDone);
  const projected   = projectedDays(blocksDone, blocksTotal, daysActive);

  // Streak: dias consecutivos com pelo menos 1 bloco concluído
  const streak = (() => {
    const doneByDay = new Set(
      allBlocks.filter(b=>b.status==="completed")
        .map(b=>new Date(b.updated_at||b.scheduled_at).toISOString().slice(0,10))
    );
    let s=0, d=new Date();
    while (true) {
      const key = new Date(d.getTime()-s*86400000).toISOString().slice(0,10);
      if (!doneByDay.has(key)) break;
      s++;
    }
    return s;
  })();

  // Semana actual
  const weekAgo = new Date(Date.now()-7*86400000);
  const doneThisWeek = allBlocks.filter(b=>b.status==="completed"&&new Date(b.updated_at||b.scheduled_at)>=weekAgo).length;
  const scheduledThisWeek = allBlocks.filter(b=>["scheduled","active"].includes(b.status)&&new Date(b.scheduled_at)<=new Date(Date.now()+7*86400000)&&new Date(b.scheduled_at)>=new Date()).length;

  // Próximo objectivo incompleto
  const nextObjective = objectives.find(o=>o.status!=="completed");
  const nextObjPct = nextObjective
    ? Math.round(((nextObjective.blocks_completed||0)/Math.max(1,nextObjective.blocks_count||1))*100)
    : 0;

  // ── Conversation types ────────────────────────────────────────────────────
  function selectConvType(type:string) {
    if (streaming) return;
    setConvType(type); setNewDreamStep("idle"); setNewDreamInput(""); setInput("");
    const openers: Record<string,string> = {
      checkin:     "Como está indo essa semana?\n\nConta o que aconteceu desde a última vez.",
      pre_block:   nextBlock
        ? `Seu próximo bloco é:\n"${nextBlock.title}"\n\nHá algo que precisa esclarecer antes de começar?`
        : "Para qual bloco você quer se preparar?\nMe diz o que tem agendado.",
      post_block:  "Como foi o último bloco?\n\nO que você concluiu — e o que ficou por fazer?",
      crisis:      "O que está acontecendo?\n\nNão tenho pressa. Conta.",
      revaluation: "O que te fez questionar o plano?\n\nAlgo mudou, ou é uma dúvida que já existia?",
    };
    if (type==="extraction") {
      setNewDreamStep("input");
      setMessages([{role:"assistant",content:activeDream
        ?`Você tem um sonho ativo: "${activeDream.title}"\n\nAntes de avançar, vou verificar a sinergia.\n\nQual é o novo sonho?`
        :"Qual é o novo sonho que você quer trabalhar?"}]);
      scrollChat(); return;
    }
    if (openers[type]) { setMessages([{role:"assistant",content:openers[type]}]); scrollChat(); }
  }

  async function sendMessage() {
    if (!input.trim()||streaming) return;
    const userMsg={role:"user",content:input.trim()};
    const newMsgs=[...messages,userMsg];
    setMessages(newMsgs); setInput(""); setStreaming(true); setStreamText(""); scrollChat();
    try {
      const res=await fetch("/api/north/chat",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({messages:newMsgs,conversationType:convType,dreamId:activeDream?.id})});
      if (res.status===503){setMessages(p=>[...p,{role:"assistant",content:"North está temporariamente indisponível."}]);setStreaming(false);return;}
      if (res.status===402){router.push("/upgrade?trigger=blocks");setStreaming(false);return;}
      const reader=res.body!.getReader(); const dec=new TextDecoder(); let full="";
      while(true){
        const{done,value}=await reader.read(); if(done)break;
        for(const line of dec.decode(value).split("\n")){
          if(line.startsWith("data: ")){try{const d=JSON.parse(line.slice(6));if(d.text){full+=d.text;setStreamText(full);scrollChat();}if(d.done){setMessages(p=>[...p,{role:"assistant",content:full}]);setStreamText("");scrollChat();}}catch{}}
        }
      }
    } catch{setMessages(p=>[...p,{role:"assistant",content:"Algo deu errado."}]);}
    finally{setStreaming(false);}
  }

  async function handleNewDreamSubmit() {
    if (!newDreamInput.trim()||streaming) return;
    const dream=newDreamInput.trim(); setNewDreamText(dream); setNewDreamInput("");
    setMessages(p=>[...p,{role:"user",content:dream}]);
    if (activeDream) {
      setNewDreamStep("synergy");
      const r=await fetch(`/api/blocks?dreamId=${activeDream.id}&days=30`).then(r=>r.json()).catch(()=>({}));
      const scheduled=Array.isArray(r.blocks)?r.blocks.length:0;
      setMessages(p=>[...p,{role:"assistant",content:`Analisei seu plano atual.\n\nVocê tem ${scheduled} blocos agendados nas próximas 4 semanas para "${activeDream.title}".\n\nPosso encaixar um novo sonho em paralelo — mas dependendo do tempo disponível, isso pode estender os prazos.\n\nComo prefere?`}]);
    } else { router.push(`/onboarding?dream=${encodeURIComponent(dream)}`); }
    scrollChat();
  }

  async function confirmNewDream(parallel:boolean) {
    if (parallel){router.push(`/onboarding?dream=${encodeURIComponent(newDreamText)}`);}
    else{
      setMessages(p=>[...p,{role:"assistant",content:`Entendido. O sonho "${newDreamText}" fica na fila.\n\nVou te lembrar dele quando o sonho atual estiver concluído.`}]);
      await fetch("/api/dreams",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({title:newDreamText})});
      setNewDreamStep("idle"); scrollChat();
    }
  }

  async function generatePlan() {
    if (!activeDream||generatingPlan) return;
    setGeneratingPlan(true);
    try{const res=await fetch("/api/plan/generate",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({dreamId:activeDream.id})});if(res.ok){await loadData();router.push(`/objectives?dreamId=${activeDream.id}`);}}catch{}
    setGeneratingPlan(false);
  }

  async function generateShareCard() {
    if (!activeDream) return;
    const res=await fetch("/api/share",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({dreamId:activeDream.id})});
    if (res.ok){const{card}=await res.json();setToast(`Card de progresso gerado:\n\n"Investi ${card.hours_invested}h em ${card.days_working} dias construindo meu sonho. ${card.hashtag}"`);}
  }

  async function createWitness() {
    if (!activeDream||!witnessName.trim()) return;
    const res=await fetch("/api/witnesses",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({dreamId:activeDream.id,witnessName})});
    if (res.ok){const{url}=await res.json();setWitnessUrl(url);setWitnessName("");}
  }

  const isNewDreamFlow = newDreamStep!=="idle";

  if (loading) return (
    <div style={{minHeight:"100vh",background:T.bg,display:"flex",alignItems:"center",justifyContent:"center"}}>
      <p style={{fontFamily:"'Playfair Display',serif",fontSize:"18px",color:T.silver}}>A carregar...</p>
    </div>
  );

  return (
    <div style={{minHeight:"100vh",background:T.bg,color:T.light,fontFamily:"Inter,sans-serif",display:"flex",flexDirection:"column"}}>

      {/* ── HEADER ─────────────────────────────────────────────────────────── */}
      <header style={{borderBottom:`1px solid ${T.border}`,padding:"12px 24px",display:"flex",alignItems:"center",justifyContent:"space-between",position:"sticky",top:0,background:`${T.bg}F2`,backdropFilter:"blur(16px)",zIndex:60,flexWrap:"wrap",gap:"8px"}}>
        <p style={{fontFamily:"'Playfair Display',serif",fontSize:"20px",fontWeight:700,margin:0,letterSpacing:"0.04em"}}>DP.</p>
        <div style={{display:"flex",gap:"5px",flexWrap:"wrap"}}>
          {activeDream&&[
            {label:"Agenda",    path:`/schedule?dreamId=${activeDream.id}`,    hi:true},
            {label:"Objetivos", path:`/objectives?dreamId=${activeDream.id}`,  hi:false},
            {label:"Timeline",  path:`/timeline?dreamId=${activeDream.id}`,    hi:false},
            {label:"Sonhos",    path:"/dreams",                                 hi:false},
          ].map(n=>(
            <button key={n.label} onClick={()=>router.push(n.path)}
              style={{padding:"6px 13px",background:n.hi?T.blue:"transparent",border:`1px solid ${n.hi?T.blue:T.border}`,borderRadius:"7px",color:n.hi?T.light:T.silver,fontSize:"12px",fontWeight:n.hi?500:400,cursor:"pointer",fontFamily:"Inter,sans-serif"}}>
              {n.label}
            </button>
          ))}
          <button onClick={()=>router.push("/account")}
            style={{padding:"6px 13px",background:"transparent",border:`1px solid ${T.border}`,borderRadius:"7px",color:T.silver,fontSize:"12px",cursor:"pointer",fontFamily:"Inter,sans-serif"}}>
            Conta
          </button>
        </div>
      </header>

      <div style={{flex:1,display:"flex",overflow:"hidden"}}>

        {/* ── SIDEBAR ────────────────────────────────────────────────────────── */}
        <aside style={{width:"284px",flexShrink:0,borderRight:`1px solid ${T.border}`,overflowY:"auto",display:"flex",flexDirection:"column",gap:0}}>

          {activeDream ? (<>

            {/* Hero do sonho */}
            <div style={{padding:"20px 18px 16px",borderBottom:`1px solid ${T.border}`}}>
              <p style={{margin:"0 0 4px",fontSize:"9px",color:T.silver,textTransform:"uppercase",letterSpacing:"0.1em"}}>Sonho ativo · dia {daysActive+1}</p>
              <p onClick={()=>router.push(`/objectives?dreamId=${activeDream.id}`)}
                style={{margin:"0 0 14px",fontFamily:"'Playfair Display',serif",fontSize:"14px",lineHeight:1.4,color:T.light,cursor:"pointer"}}>
                {activeDream.title}
              </p>

              {/* Progresso circular + horas */}
              <div style={{display:"flex",alignItems:"center",gap:"14px",marginBottom:"12px"}}>
                <div style={{position:"relative",flexShrink:0}}>
                  <CircleProgress pct={pct} size={68} stroke={5} color={pct>0?T.blue:T.dim} />
                  <div style={{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center"}}>
                    <span style={{fontSize:"13px",fontWeight:700,color:pct>0?T.blue:T.silver,fontFamily:"monospace"}}>{pct}%</span>
                  </div>
                </div>
                <div style={{flex:1}}>
                  <div style={{marginBottom:"8px"}}>
                    <p style={{margin:"0 0 1px",fontSize:"22px",fontWeight:700,color:T.light,fontFamily:"monospace",lineHeight:1}}>{invested}<span style={{fontSize:"12px",fontWeight:400,color:T.silver}}> h</span></p>
                    <p style={{margin:0,fontSize:"10px",color:T.silver}}>horas investidas</p>
                  </div>
                  <div>
                    <p style={{margin:"0 0 1px",fontSize:"16px",fontWeight:600,color:streak>0?T.amber:T.silver,fontFamily:"monospace",lineHeight:1}}>{streak}<span style={{fontSize:"10px",fontWeight:400,color:T.silver}}> dias</span></p>
                    <p style={{margin:0,fontSize:"10px",color:T.silver}}>sequência atual</p>
                  </div>
                </div>
              </div>

              {/* Barra de progresso */}
              <div style={{height:"3px",background:T.dim,borderRadius:"999px",marginBottom:"6px"}}>
                <div style={{height:"100%",width:`${pct}%`,background:`linear-gradient(90deg,${T.blue},#5580BA)`,borderRadius:"999px",transition:"width 600ms ease"}} />
              </div>
              <p style={{margin:0,fontSize:"10px",color:T.silver}}>{blocksDone} de {blocksTotal} blocos concluídos</p>
            </div>

            {/* Stats da semana */}
            <div style={{padding:"14px 18px",borderBottom:`1px solid ${T.border}`}}>
              <p style={{margin:"0 0 10px",fontSize:"9px",color:T.silver,textTransform:"uppercase",letterSpacing:"0.1em"}}>Esta semana</p>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"8px"}}>
                {[
                  {val:doneThisWeek,       label:"feitos",       color:T.green},
                  {val:scheduledThisWeek,  label:"agendados",    color:T.blue},
                  {val:`${(doneThisWeek*0.5).toFixed(1)}h`, label:"investidas", color:T.light},
                  {val:projected?`~${projected}d`:"—",          label:"p/ concluir",  color:T.amber},
                ].map((s,i)=>(
                  <div key={i} style={{padding:"8px 10px",background:T.surface,borderRadius:"8px"}}>
                    <p style={{margin:"0 0 1px",fontSize:"18px",fontWeight:700,color:s.color,fontFamily:"monospace",lineHeight:1}}>{s.val}</p>
                    <p style={{margin:0,fontSize:"9px",color:T.silver,textTransform:"uppercase",letterSpacing:"0.06em"}}>{s.label}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Próxima tarefa */}
            {nextBlock ? (
              <div style={{padding:"14px 18px",borderBottom:`1px solid ${T.border}`}}>
                <p style={{margin:"0 0 8px",fontSize:"9px",color:T.silver,textTransform:"uppercase",letterSpacing:"0.1em"}}>Próxima tarefa</p>
                <div onClick={()=>router.push(`/block/${nextBlock.id}`)}
                  style={{padding:"10px 12px",background:T.surface,border:`1px solid ${T.amber}33`,borderRadius:"10px",cursor:"pointer"}}>
                  <p style={{margin:"0 0 3px",fontSize:"12px",fontWeight:500,lineHeight:1.3,overflow:"hidden",display:"-webkit-box",WebkitLineClamp:2,WebkitBoxOrient:"vertical"}}>{nextBlock.title}</p>
                  <p style={{margin:"0 0 8px",fontSize:"10px",color:T.silver}}>{fmtTime(nextBlock.scheduled_at)}</p>
                  <button onClick={e=>{e.stopPropagation();router.push(`/block/${nextBlock.id}`)}}
                    style={{width:"100%",padding:"6px",background:T.blue,border:"none",borderRadius:"6px",color:T.light,fontSize:"11px",fontWeight:600,cursor:"pointer",fontFamily:"Inter,sans-serif"}}>
                    Executar →
                  </button>
                </div>
              </div>
            ) : (
              <div style={{padding:"14px 18px",borderBottom:`1px solid ${T.border}`}}>
                <button onClick={generatePlan} disabled={generatingPlan}
                  style={{width:"100%",padding:"10px",background:generatingPlan?T.border:`${T.blue}22`,border:`1px solid ${T.blue}44`,borderRadius:"8px",color:T.blue,fontSize:"12px",cursor:"pointer",fontFamily:"Inter,sans-serif",textAlign:"left"}}>
                  {generatingPlan?"A gerar plano...":"Gerar plano com North →"}
                </button>
              </div>
            )}

            {/* Próximo objectivo */}
            {nextObjective && (
              <div style={{padding:"14px 18px",borderBottom:`1px solid ${T.border}`}}>
                <p style={{margin:"0 0 8px",fontSize:"9px",color:T.silver,textTransform:"uppercase",letterSpacing:"0.1em"}}>Objetivo em curso</p>
                <p style={{margin:"0 0 6px",fontSize:"12px",lineHeight:1.4,color:T.light}}>{nextObjective.title}</p>
                <div style={{height:"2px",background:T.dim,borderRadius:"999px",marginBottom:"4px"}}>
                  <div style={{height:"100%",width:`${nextObjPct}%`,background:T.green,borderRadius:"999px",transition:"width 600ms ease"}} />
                </div>
                <p style={{margin:0,fontSize:"10px",color:T.silver}}>{nextObjective.blocks_completed||0}/{nextObjective.blocks_count||0} blocos · {nextObjPct}%</p>
              </div>
            )}

            {/* Testemunha */}
            {witnessMsg && (
              <div style={{padding:"12px 18px",borderBottom:`1px solid ${T.border}`,background:`${T.mauve}08`}}>
                <p style={{margin:"0 0 4px",fontSize:"9px",color:T.mauve,textTransform:"uppercase",letterSpacing:"0.1em"}}>Testemunha</p>
                <p style={{margin:0,fontSize:"11px",fontStyle:"italic",lineHeight:1.5,color:T.light}}>{witnessMsg}</p>
              </div>
            )}

            {/* Conversa com North */}
            <div style={{padding:"14px 18px",borderBottom:`1px solid ${T.border}`}}>
              <p style={{margin:"0 0 8px",fontSize:"9px",color:T.silver,textTransform:"uppercase",letterSpacing:"0.1em"}}>Conversa com North</p>
              {[
                {key:"checkin",     label:"Check-in"},
                {key:"extraction",  label:"Novo sonho"},
                {key:"pre_block",   label:"Pré-bloco"},
                {key:"post_block",  label:"Pós-bloco"},
                {key:"crisis",      label:"Momento difícil"},
                {key:"revaluation", label:"Reavaliar"},
              ].map(c=>(
                <button key={c.key} onClick={()=>selectConvType(c.key)}
                  style={{display:"block",width:"100%",padding:"7px 10px",marginBottom:"2px",background:convType===c.key&&!isNewDreamFlow?`${T.blue}22`:"transparent",border:`1px solid ${convType===c.key&&!isNewDreamFlow?T.blue+"44":"transparent"}`,borderRadius:"6px",color:convType===c.key&&!isNewDreamFlow?T.blue:T.silver,fontSize:"12px",cursor:"pointer",textAlign:"left",fontFamily:"Inter,sans-serif"}}>
                  {c.label}
                </button>
              ))}
            </div>

            {/* Partilhar */}
            <div style={{padding:"14px 18px",borderBottom:`1px solid ${T.border}`}}>
              <p style={{margin:"0 0 8px",fontSize:"9px",color:T.silver,textTransform:"uppercase",letterSpacing:"0.1em"}}>Partilhar</p>
              <button onClick={()=>setShowWitness(true)}
                style={{display:"block",width:"100%",padding:"7px 10px",marginBottom:"4px",background:`${T.mauve}18`,border:`1px solid ${T.mauve}44`,borderRadius:"6px",color:T.mauve,fontSize:"11px",cursor:"pointer",textAlign:"left",fontFamily:"Inter,sans-serif"}}>
                + Convidar Testemunha {witnesses.length>0?`(${witnesses.length})`:""}
              </button>
              <button onClick={generateShareCard}
                style={{display:"block",width:"100%",padding:"7px 10px",background:"transparent",border:`1px solid ${T.border}`,borderRadius:"6px",color:T.silver,fontSize:"11px",cursor:"pointer",textAlign:"left",fontFamily:"Inter,sans-serif"}}>
                Gerar card de progresso
              </button>
            </div>

          </>) : (
            <div style={{padding:"24px 18px"}}>
              <button onClick={()=>router.push("/onboarding")}
                style={{width:"100%",padding:"12px",background:T.blue,border:"none",borderRadius:"8px",color:T.light,fontSize:"13px",cursor:"pointer",fontFamily:"Inter,sans-serif"}}>
                + Começar novo sonho
              </button>
            </div>
          )}

          {/* Status calendário */}
          <div style={{marginTop:"auto",padding:"12px 18px",borderTop:`1px solid ${T.border}`,display:"flex",alignItems:"center",gap:"6px"}}>
            <div style={{width:"6px",height:"6px",borderRadius:"50%",background:calConnected?T.green:T.silver}} />
            <span style={{fontSize:"10px",color:T.silver}}>{calConnected?"Calendar ativo":"Calendar inativo"}</span>
          </div>
        </aside>

        {/* ── CHAT AREA ──────────────────────────────────────────────────────── */}
        <div style={{flex:1,display:"flex",flexDirection:"column",minWidth:0}}>

          {/* Mensagens */}
          <div style={{flex:1,padding:"28px 36px",overflowY:"auto",display:"flex",flexDirection:"column",gap:"12px"}}>
            {messages.length===0 && (
              <div style={{margin:"auto",textAlign:"center",maxWidth:"320px"}}>
                <p style={{fontFamily:"'Playfair Display',serif",fontSize:"48px",fontWeight:300,color:`${T.light}14`,margin:"0 0 16px"}}>N</p>
                <p style={{fontSize:"14px",fontWeight:300,fontStyle:"italic",color:T.light,lineHeight:1.8,margin:"0 0 6px"}}>Olá. Eu sou North.<br/>Estou aqui.</p>
                <p style={{fontSize:"12px",color:T.silver}}>Escreve o que tens em mente.</p>
              </div>
            )}
            {messages.map((m:any,i:number)=>(
              <div key={i} style={{maxWidth:m.role==="user"?"72%":"82%",alignSelf:m.role==="user"?"flex-end":"flex-start",padding:"11px 15px",borderRadius:"12px",background:m.role==="user"?T.surface:T.card,border:`1px solid ${T.border}`,borderLeft:m.role==="assistant"?`2px solid ${T.silver}44`:undefined}}>
                <p style={{margin:0,fontSize:"13px",lineHeight:1.75,fontWeight:m.role==="assistant"?300:400,fontStyle:m.role==="assistant"?"italic":"normal",whiteSpace:"pre-wrap"}}>{m.content}</p>
              </div>
            ))}
            {streaming&&streamText&&(
              <div style={{maxWidth:"82%",padding:"11px 15px",background:T.card,borderRadius:"12px",border:`1px solid ${T.border}`,borderLeft:`2px solid ${T.silver}44`}}>
                <p style={{margin:0,fontSize:"13px",fontWeight:300,fontStyle:"italic",lineHeight:1.75}}>{streamText}<span style={{opacity:0.3}}>▊</span></p>
              </div>
            )}
            {streaming&&!streamText&&(
              <div style={{padding:"11px 15px",background:T.card,borderRadius:"12px",border:`1px solid ${T.border}`,alignSelf:"flex-start"}}>
                <p style={{margin:0,fontSize:"12px",color:T.silver,fontStyle:"italic"}}>North está pensando...</p>
              </div>
            )}
            <div ref={chatEndRef} style={{height:"1px"}} />
          </div>

          {/* Input */}
          <div style={{borderTop:`1px solid ${T.border}`,padding:"14px 36px 24px"}}>
            {isNewDreamFlow ? (
              newDreamStep==="input" ? (
                <div style={{display:"flex",gap:"8px"}}>
                  <input value={newDreamInput} onChange={e=>setNewDreamInput(e.target.value)}
                    onKeyDown={e=>e.key==="Enter"&&handleNewDreamSubmit()} placeholder="Descreve o novo sonho..." autoFocus
                    style={{flex:1,background:T.card,border:`1px solid ${T.blue}55`,borderRadius:"10px",padding:"11px 15px",color:T.light,fontSize:"13px",fontFamily:"Inter,sans-serif",outline:"none"}}
                  />
                  <button onClick={handleNewDreamSubmit} disabled={!newDreamInput.trim()}
                    style={{padding:"11px 16px",background:newDreamInput.trim()?T.blue:T.border,border:"none",borderRadius:"10px",color:T.light,fontSize:"13px",cursor:"pointer",fontFamily:"Inter,sans-serif"}}>→</button>
                </div>
              ) : (
                <div style={{display:"flex",gap:"8px"}}>
                  <button onClick={()=>confirmNewDream(true)}
                    style={{flex:1,padding:"11px",background:`${T.blue}22`,border:`1px solid ${T.blue}44`,borderRadius:"8px",color:T.blue,fontSize:"12px",fontWeight:500,cursor:"pointer",fontFamily:"Inter,sans-serif"}}>Os dois em paralelo</button>
                  <button onClick={()=>confirmNewDream(false)}
                    style={{flex:1,padding:"11px",background:"transparent",border:`1px solid ${T.border}`,borderRadius:"8px",color:T.silver,fontSize:"12px",cursor:"pointer",fontFamily:"Inter,sans-serif"}}>Terminar o atual primeiro</button>
                </div>
              )
            ) : (
              <div style={{display:"flex",gap:"8px",alignItems:"flex-end"}}>
                <textarea value={input} onChange={e=>setInput(e.target.value)}
                  onKeyDown={e=>e.key==="Enter"&&!e.shiftKey&&(e.preventDefault(),sendMessage())}
                  placeholder="Escreve para North..." rows={2} disabled={streaming}
                  style={{flex:1,background:T.card,border:`1px solid ${T.border}`,borderRadius:"10px",padding:"11px 15px",color:T.light,fontSize:"13px",fontFamily:"Inter,sans-serif",resize:"none",outline:"none",lineHeight:1.5,opacity:streaming?0.6:1}}
                />
                <button onClick={sendMessage} disabled={streaming||!input.trim()}
                  style={{padding:"11px 16px",background:input.trim()&&!streaming?T.blue:T.border,border:"none",borderRadius:"10px",color:T.light,fontSize:"13px",fontWeight:500,cursor:"pointer",fontFamily:"Inter,sans-serif"}}>→</button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Modal Testemunha ────────────────────────────────────────────────── */}
      {showWitness&&(
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.72)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:100,padding:"24px"}}>
          <div style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:"18px",padding:"28px",maxWidth:"380px",width:"100%",boxShadow:"0 24px 64px rgba(0,0,0,0.4)"}}>
            <p style={{fontFamily:"'Playfair Display',serif",fontSize:"18px",margin:"0 0 6px"}}>Testemunha do Sonho</p>
            <p style={{fontSize:"12px",color:T.silver,lineHeight:1.6,marginBottom:"20px"}}>A testemunha vê o seu progresso, mas não as conversas com North.</p>
            {!witnessUrl ? (<>
              <input value={witnessName} onChange={e=>setWitnessName(e.target.value)}
                onKeyDown={e=>e.key==="Enter"&&createWitness()} placeholder="Nome da testemunha"
                style={{width:"100%",background:T.surface,border:`1px solid ${T.border}`,borderRadius:"8px",padding:"11px",color:T.light,fontSize:"13px",fontFamily:"Inter,sans-serif",outline:"none",boxSizing:"border-box",marginBottom:"10px"}}
              />
              <button onClick={createWitness} disabled={!witnessName.trim()}
                style={{width:"100%",padding:"11px",background:witnessName.trim()?T.mauve:T.border,border:"none",borderRadius:"8px",color:T.light,fontSize:"13px",fontWeight:500,cursor:"pointer",fontFamily:"Inter,sans-serif"}}>Criar link</button>
            </>) : (<>
              <p style={{fontSize:"12px",color:T.silver,marginBottom:"8px"}}>Partilha este link com a testemunha:</p>
              <div style={{background:T.surface,border:`1px solid ${T.border}`,borderRadius:"8px",padding:"10px",fontSize:"11px",fontFamily:"monospace",color:T.light,wordBreak:"break-all",marginBottom:"10px"}}>{witnessUrl}</div>
              <button onClick={()=>navigator.clipboard.writeText(witnessUrl)}
                style={{width:"100%",padding:"10px",background:T.mauve,border:"none",borderRadius:"8px",color:T.light,fontSize:"13px",cursor:"pointer",fontFamily:"Inter,sans-serif"}}>Copiar link</button>
            </>)}
            <button onClick={()=>{setShowWitness(false);setWitnessUrl("");setWitnessName("");}}
              style={{width:"100%",marginTop:"8px",padding:"10px",background:"transparent",border:`1px solid ${T.border}`,borderRadius:"8px",color:T.silver,fontSize:"12px",cursor:"pointer",fontFamily:"Inter,sans-serif"}}>Fechar</button>
          </div>
        </div>
      )}

      {toast&&<Toast msg={toast} onClose={()=>setToast(null)} />}
    </div>
  );
}

export default function DashboardPage() {
  return (
    <Suspense fallback={<div style={{minHeight:"100vh",background:"#0D0D14"}} />}>
      <DashboardContent />
    </Suspense>
  );
}
