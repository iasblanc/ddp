// @ts-nocheck
"use client";
import React, { useState, useEffect, useRef, useCallback, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";

const T = {
  bg:"#0D0D14", card:"#1A1A2E", light:"#E8E4DC",
  silver:"#6B6B80", blue:"#4A6FA5", green:"#2D6A4F",
  amber:"#C9853A", border:"#252538", surface:"#141420",
};

// ── tipos ─────────────────────────────────────────────────────────────────────
type Msg =
  | { kind:"north"; id:string; text:string }
  | { kind:"user";  id:string; text:string }
  | { kind:"choice";id:string; options:Array<{label:string;value:string}> }
  | { kind:"cards"; id:string; items:Array<{title:string;description?:string}> };

// ── NorthBubble com streaming palavra a palavra ───────────────────────────────
function NorthBubble({ text, onDone }: { text:string; onDone?:()=>void }) {
  const [shown, setShown] = useState("");
  const [finished, setFinished] = useState(false);
  const done = useRef(false);

  useEffect(() => {
    done.current = false;
    setShown(""); setFinished(false);
    const words = text.split(" ");
    let i = 0;
    const iv = setInterval(() => {
      if (i >= words.length) {
        clearInterval(iv);
        if (!done.current) { done.current = true; setFinished(true); }
        return;
      }
      setShown(p => p ? p + " " + words[i] : words[i]);
      i++;
    }, 30);
    return () => { clearInterval(iv); };
  }, [text]);

  useEffect(() => { if (finished && onDone) onDone(); }, [finished]);

  return (
    <div style={{ maxWidth:"80%", padding:"13px 17px", background:T.card,
      borderRadius:"14px 14px 14px 3px", border:`1px solid ${T.border}`,
      borderLeft:`2px solid ${T.silver}55`, alignSelf:"flex-start" }}>
      <p style={{ margin:0, fontSize:"14px", fontWeight:300, fontStyle:"italic",
        lineHeight:1.85, color:T.light, whiteSpace:"pre-wrap" }}>
        {shown}{!finished && <span style={{ opacity:0.25, animation:"blink 1s infinite" }}>▊</span>}
      </p>
    </div>
  );
}

function UserBubble({ text }: { text:string }) {
  return (
    <div style={{ maxWidth:"72%", padding:"12px 17px", background:T.surface,
      borderRadius:"14px 14px 3px 14px", border:`1px solid ${T.border}`, alignSelf:"flex-end" }}>
      <p style={{ margin:0, fontSize:"14px", lineHeight:1.7, color:T.light }}>{text}</p>
    </div>
  );
}

function ChoiceBubble({ options, onPick, disabled }: {
  options:Array<{label:string;value:string}>; onPick:(v:string)=>void; disabled:boolean
}) {
  return (
    <div style={{ display:"flex", flexDirection:"column", gap:"7px", alignSelf:"flex-start", maxWidth:"84%" }}>
      {options.map(o => {
        const isPrimary = o.value === "yes" || o.value === "ok" || o.value === "continue";
        return (
          <button key={o.value} onClick={() => !disabled && onPick(o.value)}
            disabled={disabled}
            style={{ padding:"11px 18px", textAlign:"left", fontFamily:"Inter,sans-serif",
              fontSize:"13px", cursor:disabled?"default":"pointer", borderRadius:"9px",
              background:isPrimary?`${T.blue}22`:T.surface,
              border:`1px solid ${isPrimary?T.blue+"55":T.border}`,
              color:isPrimary?T.blue:T.silver, transition:"all 140ms ease" }}>
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

function CardsBubble({ items }: { items:Array<{title:string;description?:string}> }) {
  return (
    <div style={{ alignSelf:"flex-start", width:"100%", display:"flex", flexDirection:"column", gap:"7px" }}>
      {items.map((item,i) => (
        <div key={i} style={{ display:"flex", gap:"12px", padding:"11px 15px",
          background:T.card, border:`1px solid ${T.border}`, borderRadius:"10px" }}>
          <span style={{ fontSize:"11px", color:T.blue, fontFamily:"monospace",
            fontWeight:700, minWidth:"22px", paddingTop:"1px" }}>
            {String(i+1).padStart(2,"0")}
          </span>
          <div>
            <p style={{ margin:"0 0 2px", fontSize:"13px", fontWeight:500, color:T.light }}>{item.title}</p>
            {item.description && <p style={{ margin:0, fontSize:"11px", color:T.silver, lineHeight:1.4 }}>{item.description}</p>}
          </div>
        </div>
      ))}
    </div>
  );
}

function ThinkingBubble() {
  return (
    <div style={{ alignSelf:"flex-start", padding:"12px 18px", background:T.card,
      border:`1px solid ${T.border}`, borderLeft:`2px solid ${T.silver}33`,
      borderRadius:"14px 14px 14px 3px" }}>
      <div style={{ display:"flex", gap:"5px", alignItems:"center" }}>
        {[0,1,2].map(i => (
          <div key={i} style={{ width:"6px", height:"6px", borderRadius:"50%",
            background:T.silver, opacity:0.5,
            animation:`pulse 1.4s ease-in-out ${i*0.2}s infinite` }} />
        ))}
      </div>
    </div>
  );
}

// ── Engine principal ─────────────────────────────────────────────────────────
function OnboardingContent() {
  const router   = useRouter();
  const params   = useSearchParams();
  const endRef   = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auth — ref para evitar stale closure
  const isLoggedInRef = useRef(false);
  const userRef       = useRef<any>(null);

  // State
  const [msgs,      setMsgs]      = useState<Msg[]>([]);
  const [input,     setInput]     = useState("");
  const [thinking,  setThinking]  = useState(false);
  const [inputMode, setInputMode] = useState<"text"|"email"|"none">("none");
  const [placeholder,setPlaceholder] = useState("Escreve aqui...");
  const [locked,    setLocked]    = useState(true);    // input bloqueado
  const [progress,  setProgress]  = useState(10);      // 10-100

  // Dados
  const dreamRef     = useRef("");
  const reflRef      = useRef("");
  const answersRef   = useRef<Record<string,string>>({});
  const exploreRef   = useRef<Array<{role:string;content:string}>>([]);
  const stepRef      = useRef(0);    // 0-3: perguntas deepen
  const logStepRef   = useRef(0);    // 0-4: perguntas logistica
  const dreamIdRef   = useRef<string|null>(null);

  const uid = () => Math.random().toString(36).slice(2);
  const scroll = () => setTimeout(() => endRef.current?.scrollIntoView({behavior:"smooth"}), 80);

  // ── Adicionar mensagens ─────────────────────────────────────────────────────
  // North: retorna promise que resolve quando o typewriter termina
  function northMsg(text:string): Promise<void> {
    return new Promise(resolve => {
      const id = uid();
      setMsgs(p => [...p, { kind:"north", id, text }]);
      scroll();
      // Calcula duração aproximada do typewriter (30ms por palavra)
      const words = text.split(" ").length;
      setTimeout(resolve, words * 32 + 300);
    });
  }

  function userMsg(text:string) {
    setMsgs(p => [...p, { kind:"user", id:uid(), text }]);
    scroll();
  }

  function showChoices(options:Array<{label:string;value:string}>) {
    setMsgs(p => [...p, { kind:"choice", id:uid(), options }]);
    scroll();
  }

  function removeChoices() {
    setMsgs(p => p.filter(m => m.kind !== "choice"));
  }

  function showCards(items:Array<{title:string;description?:string}>) {
    setMsgs(p => [...p, { kind:"cards", id:uid(), items }]);
    scroll();
  }

  function think() { setThinking(true); scroll(); }
  function unthink() { setThinking(false); }

  function openInput(mode:"text"|"email", ph:string) {
    setInputMode(mode); setPlaceholder(ph); setLocked(false);
    setTimeout(() => inputRef.current?.focus(), 100);
  }
  function closeInput() { setInputMode("none"); setLocked(true); }

  // ── Inicialização ──────────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      // 1. Check auth
      try {
        const { createClient } = await import("@/lib/supabase/client");
        const sb = createClient();
        const { data: { user } } = await sb.auth.getUser();
        if (user) { isLoggedInRef.current = true; userRef.current = user; }
      } catch {}

      // 2. Abertura de North
      await northMsg("Olá. Eu sou North.\n\nEstou aqui para te ajudar a transformar esse sonho em algo real.\n\nNão tenho pressa.");
      await northMsg("Qual é o sonho que você não para de adiar?");
      setProgress(15);

      // Pre-fill se vier da URL
      const prefill = params.get("dream") || "";
      if (prefill) setInput(prefill);

      openInput("text", "Escreve o seu sonho aqui...");
    })();
  }, []);

  // ── handleSend ──────────────────────────────────────────────────────────────
  async function handleSend() {
    const val = input.trim();
    if (!val || locked) return;
    setInput(""); closeInput();

    userMsg(val);
    await stepDream(val);
  }

  // ── STEP 1 — Reflexão do sonho ──────────────────────────────────────────────
  async function stepDream(dream:string) {
    dreamRef.current = dream;
    setProgress(25);
    think();

    // Reflexão via IA
    let reflection = "";
    try {
      const res = await fetch("/api/north/chat", {
        method:"POST", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({
          messages:[{ role:"user", content:
            `O utilizador disse que o seu sonho é: "${dream}". Reflecte em 1-2 frases, específico e emotivo. Começa com "Você quer..." e captura a essência real do que está por trás das palavras. Termina com uma pergunta curta como "É isso?" ou "Ressoa?". Responde em português.`
          }],
          conversationType:"extraction",
        }),
      });
      const reader = res.body!.getReader(); const dec = new TextDecoder();
      while(true) {
        const {done,value} = await reader.read(); if(done)break;
        for(const line of dec.decode(value).split("\n")) {
          if(line.startsWith("data: ")){try{const d=JSON.parse(line.slice(6));if(d.text)reflection+=d.text;}catch{}}
        }
      }
    } catch {}
    if (!reflection) reflection = `Você quer ${dream}.\n\nIsso ressoa?`;
    reflRef.current = reflection;

    unthink();
    await northMsg(reflection);
    showChoices([
      { label:"Sim, é exatamente isso.", value:"yes" },
      { label:"Não completamente...", value:"rephrase" },
    ]);
  }

  // ── STEP 2 — Email (só se não autenticado) ──────────────────────────────────
  async function stepEmail() {
    setProgress(35);
    await northMsg("Para guardar o seu progresso, preciso de um email.");
    openInput("email", "seuemail@exemplo.com");
  }

  async function handleEmail(email:string) {
    if (!email.includes("@") || !email.includes(".")) {
      await northMsg("Esse email não parece válido. Tenta de novo.");
      openInput("email", "seuemail@exemplo.com");
      return;
    }
    think();
    try {
      const { createClient } = await import("@/lib/supabase/client");
      const sb = createClient();
      await sb.auth.signInWithOtp({
        email, options:{ shouldCreateUser:true, emailRedirectTo:`${location.origin}/onboarding/callback` }
      });
    } catch {}
    unthink();
    await northMsg(`Enviei um link para ${email}.\n\nPode abrir numa outra aba — ou continuar aqui mesmo. O seu progresso fica guardado.`);
    showChoices([{ label:"Continuar aqui agora →", value:"continue" }]);
  }

  // ── STEP 3 — Aprofundamento (4 perguntas contextuais) ──────────────────────
  const deepenQuestions = [
    "Por que esse sonho importa para você agora — e não daqui a cinco anos?",
    "O que te impediu de começar até hoje?",
    "Se esse sonho se tornasse real amanhã, o que mudaria de concreto na sua vida?",
    "Quanto tempo por dia você consegue dedicar a isso — sendo honesto consigo mesmo?",
  ];

  async function stepDeepen(idx:number) {
    setProgress(40 + idx*5);
    if (idx < deepenQuestions.length) {
      await northMsg(deepenQuestions[idx]);
      openInput("text", "Conta com as suas palavras...");
    } else {
      await stepLogistics(0);
    }
  }

  // ── STEP 4 — Logística (5 perguntas) ───────────────────────────────────────
  const logisticsQ = [
    { text:"Quando você gostaria de ter esse sonho realizado?",          ph:"Ex: em 6 meses, até dezembro..." },
    { text:"Qual é o melhor horário do dia para trabalhar nisso?",        ph:"Ex: manhã cedo, noite..." },
    { text:"Como descreve seu nível atual nesse tema?",                  ph:"Ex: iniciante, tenho alguma base..." },
    { text:"Tem algum compromisso ou limitação que pode dificultar?",    ph:"Ex: trabalho intenso, viagens..." },
  ];

  async function stepLogistics(idx:number) {
    setProgress(60 + idx*5);
    if (idx < logisticsQ.length) {
      // Transição suave da fase de aprofundamento para logística
      if (idx === 0) {
        await northMsg("Obrigado por isso. Agora preciso de alguns dados práticos para montar o plano.");
      }
      logStepRef.current = idx;
      await northMsg(logisticsQ[idx].text);
      openInput("text", logisticsQ[idx].ph);
    } else {
      await stepBuild();
    }
  }

  // ── STEP 5 — Construir plano ────────────────────────────────────────────────
  async function stepBuild() {
    setProgress(85);
    await northMsg("Tenho tudo que preciso.\n\nVou analisar o que você me contou e construir os pilares do seu plano.\n\nIsso leva alguns segundos.");
    think();

    const a = answersRef.current;
    const exploreCtx = exploreRef.current.filter(m=>m.role==="user").map(m=>m.content).join(" | ");

    try {
      // Criar sonho via API server-side
      const dreamRes = await fetch("/api/dreams", {
        method:"POST", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({
          title: dreamRef.current,
          description: exploreCtx,
          declared_deadline: a.deadline,
          time_available: a.daily_time || "1 hora",
          status:"active", maturity_stage:3,
        }),
      });
      if (!dreamRes.ok) throw new Error(`Dream API ${dreamRes.status}`);
      const { dream } = await dreamRes.json();
      if (!dream?.id) throw new Error("No dream ID");
      dreamIdRef.current = dream.id;

      // Gerar objectivos
      const objRes = await fetch("/api/north/extract-objectives", {
        method:"POST", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({
          dreamId: dream.id,
          dreamTitle: dreamRef.current,
          dreamReflection: reflRef.current,
          exploreContext: exploreCtx,
          deadline: a.deadline,
          dailyTime: a.daily_time || "1 hora",
          bestTime: a.best_time,
          currentLevel: a.current_level,
          constraints: a.constraints,
        }),
      });
      if (!objRes.ok) throw new Error(`Obj API ${objRes.status}`);
      const { objectives } = await objRes.json();
      if (!objectives?.length) throw new Error("No objectives");

      unthink();
      setProgress(92);
      await northMsg(`Identifiquei ${objectives.length} objetivos para tornar esse sonho real.`);
      showCards(objectives.map((o:any) => ({ title:o.title, description:o.description })));
      await new Promise(r => setTimeout(r, 800));
      showChoices([{ label:"Faz sentido. Continuar →", value:"ok" }]);

    } catch (err:any) {
      unthink();
      console.error("buildPlan:", err?.message);
      await northMsg("Algo correu mal ao construir o plano. Vamos tentar de novo?");
      showChoices([
        { label:"Tentar novamente", value:"retry" },
        { label:"Voltar ao início", value:"restart" },
      ]);
    }
  }

  // ── STEP 6 — Tom de North ───────────────────────────────────────────────────
  async function stepTone() {
    setProgress(96);
    await northMsg("Uma última coisa.\n\nComo você quer que eu esteja nos momentos difíceis da jornada?");
    showChoices([
      { label:"Direto — objetivo, sem rodeios",      value:"direct" },
      { label:"Gentil — acolhedor e paciente",        value:"gentle" },
      { label:"Provocador — que me desafie mais",     value:"challenger" },
    ]);
  }

  // ── handleChoice ───────────────────────────────────────────────────────────
  async function handleChoice(value:string) {
    removeChoices();
    setLocked(true);

    // --- Reflexão ---
    if (value === "yes") {
      userMsg("Sim, é exatamente isso.");
      if (isLoggedInRef.current) {
        // Logado → ir directo para aprofundamento
        await northMsg("Perfeito.\n\nQuero entender melhor esse sonho antes de construir o plano.");
        await stepDeepen(0);
      } else {
        await stepEmail();
      }
      return;
    }

    if (value === "rephrase") {
      userMsg("Não completamente...");
      await northMsg("Sem problema. Conte com as suas próprias palavras — o que você quer mesmo?");
      openInput("text", "Escreve o seu sonho aqui...");
      return;
    }

    // --- Email enviado ---
    if (value === "continue") {
      userMsg("Continuar aqui agora.");
      await northMsg("Perfeito. Vou continuar com você.\n\nQuero entender melhor esse sonho antes de construir o plano.");
      stepRef.current = 0;
      await stepDeepen(0);
      return;
    }

    // --- Objectivos ok ---
    if (value === "ok") {
      userMsg("Faz sentido, continuar.");
      await stepTone();
      return;
    }

    // --- Tom escolhido ---
    if (["direct","gentle","challenger"].includes(value)) {
      const labels: Record<string,string> = { direct:"Direto", gentle:"Gentil", challenger:"Provocador" };
      userMsg(labels[value]);
      setProgress(100);
      think();
      await new Promise(r => setTimeout(r, 1200));
      unthink();
      await northMsg("Entendido.\n\nO seu plano está pronto.\n\nO primeiro bloco foi agendado para as próximas 24 horas.\n\nSó precisas aparecer.");
      await new Promise(r => setTimeout(r, 1800));
      router.push(dreamIdRef.current ? `/objectives?dreamId=${dreamIdRef.current}` : "/dashboard");
      return;
    }

    // --- Retry / Restart ---
    if (value === "retry") { await stepBuild(); return; }
    if (value === "restart") { router.push("/onboarding"); return; }
  }

  // ── handleInput (submit do campo de texto) ─────────────────────────────────
  async function handleInput() {
    const val = input.trim();
    if (!val || locked) return;
    setInput(""); closeInput();
    userMsg(val);

    // Determinar em que fase estamos pelo inputMode + stepRefs
    const curLogStep = logStepRef.current;
    const curDStep   = stepRef.current;

    // Fase de email
    if (inputMode === "email") {
      await handleEmail(val);
      return;
    }

    // Fase de sonho (só tem input aberto na fase inicial)
    if (msgs.filter(m=>m.kind==="user").length === 1 && dreamRef.current === "") {
      await stepDream(val);
      return;
    }
    // Re-rephrase
    if (msgs.filter(m=>m.kind==="user").length >= 1 && dreamRef.current === "") {
      dreamRef.current = val;
      await stepDream(val);
      return;
    }

    // Determinar contexto: estamos em deepen ou logistics?
    const totalUserMsgs = msgs.filter(m=>m.kind==="user").length;
    // Deepen: após "Sim, é exatamente isso" (1 user msg) + 4 perguntas
    // A lógica: exploramos 4 questões antes da logística
    const deepenAnswers = exploreRef.current.filter(m=>m.role==="user").length;
    const logAnswers    = Object.keys(answersRef.current).filter(k=>["deadline","best_time","current_level","constraints"].includes(k)).length;

    if (deepenAnswers < deepenQuestions.length && stepRef.current > 0) {
      // Ainda em deepen
      exploreRef.current.push({ role:"user", content:val });
      const next = exploreRef.current.filter(m=>m.role==="user").length;
      if (next < deepenQuestions.length) {
        await stepDeepen(next);
      } else {
        await stepLogistics(0);
      }
      return;
    }

    if (logAnswers < logisticsQ.length) {
      // Em logística
      const logKeys = ["deadline","best_time","current_level","constraints"];
      const keyIdx  = logAnswers;
      if (keyIdx < logKeys.length) {
        answersRef.current[logKeys[keyIdx]] = val;
        if (keyIdx + 1 < logisticsQ.length) {
          await stepLogistics(keyIdx + 1);
        } else {
          await stepBuild();
        }
      }
      return;
    }
  }

  // ── Lógica: detectar fase actual para routing do input ─────────────────────
  // Simplificado: usar um stepName ref
  const stepNameRef = useRef<"dream"|"rephrase"|"email"|"deepen"|"logistics"|"done">("dream");

  // Reconstruir com stepNameRef para routing limpo
  // Vou usar uma abordagem mais simples: um único "stage" que avança linearmente
  const stageRef = useRef(0);
  // 0: dream, 1: email (se não logado), 2: deepen[0-3], 6: logistics[0-3], 10: build, 11: tone, 12: done

  async function routeInput(val:string) {
    const s = stageRef.current;

    if (s === 0) {
      // Sonho
      dreamRef.current = val;
      await stepDream(val);
      return;
    }
    if (s === 0.5) {
      // Rephrase do sonho
      dreamRef.current = val;
      stageRef.current = 0;
      await stepDream(val);
      return;
    }
    if (s === 1) {
      // Email
      await handleEmail(val);
      return;
    }
    if (s >= 2 && s <= 5) {
      // Deepen q0-q3
      const qIdx = s - 2;
      exploreRef.current.push({ role:"user", content:val });
      if (qIdx + 1 < deepenQuestions.length) {
        stageRef.current = s + 1;
        await stepDeepen(qIdx + 1);
      } else {
        stageRef.current = 6;
        await stepLogistics(0);
      }
      return;
    }
    if (s >= 6 && s <= 9) {
      // Logistics q0-q3
      const qIdx = s - 6;
      const logKeys = ["deadline","best_time","current_level","constraints"];
      answersRef.current[logKeys[qIdx]] = val;
      if (qIdx + 1 < logisticsQ.length) {
        stageRef.current = s + 1;
        await stepLogistics(qIdx + 1);
      } else {
        stageRef.current = 10;
        await stepBuild();
      }
      return;
    }
  }

  // ── handleSend (limpo) ─────────────────────────────────────────────────────
  async function handleSendClean() {
    const val = input.trim();
    if (!val || locked) return;
    setInput(""); closeInput();
    userMsg(val);
    await routeInput(val);
  }

  // Override handleChoice para avançar stages
  async function handleChoiceClean(value:string) {
    removeChoices();

    if (value === "yes") {
      userMsg("Sim, é exatamente isso.");
      if (isLoggedInRef.current) {
        stageRef.current = 2; // deepen[0]
        await northMsg("Perfeito.\n\nQuero entender melhor esse sonho antes de montar o plano.");
        await stepDeepen(0);
      } else {
        stageRef.current = 1; // email
        await stepEmail();
      }
      return;
    }
    if (value === "rephrase") {
      userMsg("Não completamente...");
      stageRef.current = 0.5;
      await northMsg("Sem problema. Conta com as tuas próprias palavras — o que você quer mesmo?");
      openInput("text", "Escreve o seu sonho...");
      return;
    }
    if (value === "continue") {
      userMsg("Continuar aqui agora.");
      stageRef.current = 2;
      await northMsg("Perfeito.\n\nQuero entender melhor esse sonho antes de montar o plano.");
      await stepDeepen(0);
      return;
    }
    if (value === "ok") {
      userMsg("Faz sentido, continuar.");
      stageRef.current = 11;
      await stepTone();
      return;
    }
    if (["direct","gentle","challenger"].includes(value)) {
      const labels: Record<string,string> = { direct:"Direto", gentle:"Gentil", challenger:"Provocador" };
      userMsg(labels[value]);
      stageRef.current = 12;
      setProgress(100);
      think();
      await new Promise(r => setTimeout(r, 1200));
      unthink();
      await northMsg("Entendido.\n\nO seu plano está pronto.\n\nO primeiro bloco foi agendado para as próximas 24 horas.\n\nSó precisas aparecer.");
      await new Promise(r => setTimeout(r, 1600));
      router.push(dreamIdRef.current ? `/objectives?dreamId=${dreamIdRef.current}` : "/dashboard");
      return;
    }
    if (value === "retry") {
      stageRef.current = 10;
      await stepBuild();
      return;
    }
    if (value === "restart") {
      router.push("/onboarding");
      return;
    }
  }

  // Overrides limpos para o stepDream usar handleChoiceClean e stepEmail avançar stage
  const origStepEmail = stepEmail;
  const cleanStepEmail = async () => {
    setProgress(35);
    await northMsg("Para guardar o seu progresso, preciso de um email.");
    openInput("email", "seuemail@exemplo.com");
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight:"100vh", height:"100vh", background:T.bg, color:T.light,
      fontFamily:"Inter,sans-serif", display:"flex", flexDirection:"column", overflow:"hidden" }}>

      <style>{`
        @keyframes pulse { 0%,80%,100%{opacity:.25} 40%{opacity:1} }
        @keyframes blink  { 0%,100%{opacity:.25} 50%{opacity:.7} }
      `}</style>

      {/* Header */}
      <header style={{ padding:"13px 24px", display:"flex", alignItems:"center",
        justifyContent:"space-between", flexShrink:0, borderBottom:`1px solid ${T.border}22` }}>
        <p style={{ fontFamily:"'Playfair Display',serif", fontSize:"18px", fontWeight:700,
          margin:0, letterSpacing:"0.04em", color:T.light }}>DP.</p>
        <div style={{ flex:1, maxWidth:"160px", margin:"0 24px" }}>
          <div style={{ height:"2px", background:T.border, borderRadius:"999px", overflow:"hidden" }}>
            <div style={{ height:"100%", width:`${progress}%`, background:`linear-gradient(90deg,${T.blue},${T.green})`,
              borderRadius:"999px", transition:"width 700ms ease" }} />
          </div>
        </div>
        <button onClick={() => router.push("/dashboard")}
          style={{ background:"none", border:"none", color:T.silver, cursor:"pointer",
            fontSize:"11px", fontFamily:"Inter,sans-serif", opacity:0.7 }}>
          Sair
        </button>
      </header>

      {/* Chat */}
      <div style={{ flex:1, overflowY:"auto", display:"flex", flexDirection:"column",
        gap:"12px", maxWidth:"640px", width:"100%", margin:"0 auto", padding:"20px 24px 16px",
        boxSizing:"border-box" }}>
        {msgs.map(m => {
          if (m.kind === "north")  return <NorthBubble  key={m.id} text={m.text} />;
          if (m.kind === "user")   return <UserBubble   key={m.id} text={m.text} />;
          if (m.kind === "choice") return <ChoiceBubble key={m.id} options={m.options} disabled={locked&&inputMode==="none"} onPick={handleChoiceClean} />;
          if (m.kind === "cards")  return <CardsBubble  key={m.id} items={m.items} />;
          return null;
        })}
        {thinking && <ThinkingBubble />}
        <div ref={endRef} style={{ height:"8px" }} />
      </div>

      {/* Input */}
      <div style={{ padding:"10px 24px 22px", flexShrink:0, maxWidth:"640px",
        width:"100%", margin:"0 auto", boxSizing:"border-box" }}>
        {inputMode !== "none" && (
          <div style={{ display:"flex", gap:"8px" }}>
            <input ref={inputRef} value={input} onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key==="Enter" && handleSendClean()}
              placeholder={placeholder}
              type={inputMode === "email" ? "email" : "text"}
              style={{ flex:1, background:T.card, border:`1px solid ${T.border}`,
                borderRadius:"10px", padding:"13px 16px", color:T.light, fontSize:"14px",
                fontFamily:"Inter,sans-serif", outline:"none", transition:"border-color 150ms ease" }}
              onFocus={e => e.target.style.borderColor = T.blue+"66"}
              onBlur={e  => e.target.style.borderColor = T.border}
            />
            <button onClick={handleSendClean} disabled={!input.trim()}
              style={{ padding:"13px 20px", background:input.trim()?T.blue:T.border,
                border:"none", borderRadius:"10px", color:T.light, fontSize:"15px",
                cursor:input.trim()?"pointer":"default", transition:"background 150ms ease" }}>
              →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function OnboardingPage() {
  return (
    <Suspense fallback={<div style={{ minHeight:"100vh", background:"#0D0D14" }} />}>
      <OnboardingContent />
    </Suspense>
  );
}
