// @ts-nocheck
"use client";
import React, { useState, useEffect, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";

// ── Tokens ────────────────────────────────────────────────────────────────────
const T = {
  bg:"#0D0D14", card:"#1A1A2E", light:"#E8E4DC",
  silver:"#6B6B80", blue:"#4A6FA5", green:"#2D6A4F",
  amber:"#C9853A", border:"#252538", surface:"#141420",
};

// ── Helpers ───────────────────────────────────────────────────────────────────
function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

// Digita palavra a palavra (efeito typewriter suave)
function useTypewriter(text: string, speed = 28) {
  const [displayed, setDisplayed] = useState("");
  const [done, setDone] = useState(false);
  useEffect(() => {
    if (!text) return;
    setDisplayed(""); setDone(false);
    const words = text.split(" ");
    let i = 0;
    const iv = setInterval(() => {
      if (i >= words.length) { clearInterval(iv); setDone(true); return; }
      setDisplayed(prev => prev ? prev + " " + words[i] : words[i]);
      i++;
    }, speed);
    return () => clearInterval(iv);
  }, [text]);
  return { displayed, done };
}

// ── Componente NorthMessage — aparece palavra a palavra ─────────────────────
function NorthMsg({ text, onDone }: { text: string; onDone?: () => void }) {
  const { displayed, done } = useTypewriter(text, 32);
  useEffect(() => { if (done && onDone) onDone(); }, [done]);
  return (
    <div style={{ maxWidth:"76%", padding:"12px 16px", background:T.card, borderRadius:"12px 12px 12px 2px",
      border:`1px solid ${T.border}`, borderLeft:`2px solid ${T.silver}44`, alignSelf:"flex-start" }}>
      <p style={{ margin:0, fontSize:"14px", fontWeight:300, fontStyle:"italic", lineHeight:1.8, color:T.light, whiteSpace:"pre-wrap" }}>
        {displayed}{!done && <span style={{ opacity:0.3 }}>▊</span>}
      </p>
    </div>
  );
}

function UserMsg({ text }: { text: string }) {
  return (
    <div style={{ maxWidth:"72%", padding:"11px 16px", background:T.surface, borderRadius:"12px 12px 2px 12px",
      border:`1px solid ${T.border}`, alignSelf:"flex-end" }}>
      <p style={{ margin:0, fontSize:"14px", lineHeight:1.7, color:T.light }}>{text}</p>
    </div>
  );
}

// ── Onboarding principal ─────────────────────────────────────────────────────
function OnboardingContent() {
  const router     = useRouter();
  const params     = useSearchParams();
  const chatEndRef = useRef<HTMLDivElement>(null);
  const inputRef   = useRef<HTMLInputElement>(null);

  // Histórico de chat
  type Msg = { role:"north"|"user"|"choices"|"thinking"; text?:string; choices?: Array<{label:string;value:string}>; id?: string };
  const [msgs,       setMsgs]       = useState<Msg[]>([]);
  const [input,      setInput]      = useState("");
  const [thinking,   setThinking]   = useState(false);
  const [phase,      setPhase]      = useState<"dream"|"email"|"deepen"|"logistics"|"building"|"objectives"|"tone"|"done">("dream");
  const [isLoggedIn, setIsLoggedIn]  = useState(false);
  const [disabled,   setDisabled]   = useState(false);

  // Dados colectados
  const [dreamText,      setDreamText]      = useState("");
  const [dreamReflection,setDreamReflection]= useState("");
  const [email,          setEmail]          = useState("");
  const [answers,        setAnswers]        = useState<Record<string,string>>({});
  const [exploreHistory, setExploreHistory] = useState<Array<{role:string;content:string}>>([]);
  const [questionIdx,    setQuestionIdx]    = useState(0);
  const [objectives,     setObjectives]     = useState<any[]>([]);
  const [dreamId,        setDreamId]        = useState<string|null>(null);
  const [buildErr,       setBuildErr]       = useState<string|null>(null);

  const scrollChat = () => setTimeout(() => chatEndRef.current?.scrollIntoView({behavior:"smooth"}), 60);

  // ── Inicialização ─────────────────────────────────────────────────────────
  useEffect(() => {
    const prefill = params.get("dream") || "";
    (async () => {
      // Verificar se já está autenticado
      try {
        const { createClient } = await import("@/lib/supabase/client");
        const sb = createClient();
        const { data: { user } } = await sb.auth.getUser();
        if (user) {
          setIsLoggedIn(true);
        }
      } catch {}

      await sleep(400);
      await addNorth("Olá. Eu sou North.\n\nEstou aqui para te ajudar a transformar isso em algo real.\n\nNão tenho pressa.", 0);
      await sleep(1800);
      await addNorth("Qual é o sonho que você não para de adiar?", 0);
      if (prefill) {
        await sleep(600);
        setInput(prefill);
      }
    })();
  }, []);

  // ── Helpers de chat ────────────────────────────────────────────────────────
  async function addNorth(text: string, delay = 0) {
    if (delay) await sleep(delay);
    setMsgs(prev => [...prev, { role:"north", text, id: Math.random().toString() }]);
    scrollChat();
  }
  function addUser(text: string) {
    setMsgs(prev => [...prev, { role:"user", text }]);
    scrollChat();
  }
  function addChoices(choices: Array<{label:string;value:string}>) {
    setMsgs(prev => [...prev, { role:"choices", choices, id: Math.random().toString() }]);
    scrollChat();
  }
  function removeLastChoices() {
    setMsgs(prev => prev.filter((m,i) => !(m.role === "choices" && i === prev.length-1)));
  }

  function showThinking() { setThinking(true); scrollChat(); }
  function hideThinking() { setThinking(false); }

  // ── Fluxo principal ────────────────────────────────────────────────────────
  async function handleSend() {
    const val = input.trim();
    if (!val || disabled) return;
    setInput(""); setDisabled(true);

    if (phase === "dream") {
      setDreamText(val);
      addUser(val);
      // Se já logado, ir directo para reflexão sem pedir email
      setPhase(isLoggedIn ? "deepen_pending_reflect" as any : "email");
      await sleep(600);
      showThinking();
      await sleep(1200);
      hideThinking();
      const reflection = await reflectDream(val);
      setDreamReflection(reflection);
      await addNorth(reflection);
      await sleep(400);
      addChoices([
        { label:"Sim, é exatamente isso", value: isLoggedIn ? "yes_loggedin" : "yes" },
        { label:"Não exatamente...", value:"no" },
      ]);
      setDisabled(false);
      return;
    }

    if (phase === "email") {
      // Validar email
      if (!val.includes("@") || !val.includes(".")) {
        await addNorth("Esse email não parece válido. Pode tentar novamente?");
        setDisabled(false);
        return;
      }
      setEmail(val);
      addUser(val);
      await sleep(400);
      showThinking();
      // Criar conta
      const ok = await signUpOrIn(val);
      hideThinking();
      if (!ok) {
        await addNorth("Houve um problema com o email. Pode tentar novamente?");
        setDisabled(false);
        return;
      }
      setPhase("deepen");
      await addNorth("Perfeito.\n\nAgora quero entender melhor esse sonho antes de construir o plano.");
      await sleep(800);
      await askDeepen(0, val, { dream: dreamText });
      setDisabled(false);
      return;
    }

    if (phase === "deepen") {
      addUser(val);
      const newHistory = [...exploreHistory, { role:"user", content:val }];
      setExploreHistory(newHistory);
      const newAnswers = { ...answers, [`explore_${questionIdx}`]: val };
      setAnswers(newAnswers);
      const nextIdx = questionIdx + 1;
      setQuestionIdx(nextIdx);
      if (nextIdx < 4) {
        await askDeepen(nextIdx, email, newAnswers);
      } else {
        // Passar para logística
        setPhase("logistics");
        await addNorth("Obrigado por isso.\n\nAgora preciso de alguns dados práticos para montar o plano.");
        await sleep(600);
        await askLogistics(0, newAnswers);
      }
      setDisabled(false);
      return;
    }

    if (phase === "logistics") {
      addUser(val);
      const logKey = ["deadline","daily_time","best_time","current_level","constraints"][answers._logistics_step || 0];
      const newAnswers = { ...answers, [logKey]: val, _logistics_step: (answers._logistics_step || 0) + 1 };
      setAnswers(newAnswers);
      const nextStep = newAnswers._logistics_step;
      if (nextStep < 5) {
        await askLogistics(nextStep, newAnswers);
      } else {
        // Construir plano
        setPhase("building");
        await buildPlan(newAnswers);
      }
      setDisabled(false);
      return;
    }

    // Durante tone selection — input livre não usado (usa choices)
    setDisabled(false);
  }

  // ── Reflexo do sonho via IA ────────────────────────────────────────────────
  async function reflectDream(dream: string): Promise<string> {
    try {
      const res = await fetch("/api/north/chat", {
        method:"POST", headers:{"Content-Type":"application/json"},
        body:JSON.stringify({
          messages:[{ role:"user", content:`O utilizador disse que o seu sonho é: "${dream}". Reflecte este sonho de volta com mais precisão e profundidade emocional, numa frase de 1-2 linhas. Começa com "Você quer..." ou similar. Sê específico ao sonho deles. Responde em português.` }],
          conversationType:"extraction", dreamId:null,
        }),
      });
      const reader = res.body!.getReader(); const dec = new TextDecoder(); let full = "";
      while(true) {
        const {done,value} = await reader.read(); if(done)break;
        for(const line of dec.decode(value).split("\n")) {
          if(line.startsWith("data: ")){try{const d=JSON.parse(line.slice(6));if(d.text)full+=d.text;}catch{}}
        }
      }
      return full || `Você quer ${dream}. Isso faz sentido?`;
    } catch {
      return `Você quer ${dream}.\n\nIsso ressoa com você?`;
    }
  }

  // ── Perguntas de aprofundamento (4 perguntas com IA) ──────────────────────
  async function askDeepen(idx: number, _email: string, currentAnswers: Record<string,string>) {
    showThinking();
    try {
      const questions = [
        `Por que esse sonho importa para você agora — e não daqui a 5 anos?`,
        `O que te impediu de começar até hoje?`,
        `Se esse sonho se tornasse real amanhã, o que mudaria na sua vida?`,
        `Quanto tempo por dia você consegue dedicar a isso de forma honesta?`,
      ];
      // Para as primeiras perguntas usar IA contextual, para outras fixas
      if (idx === 0) {
        await sleep(1000);
        hideThinking();
        await addNorth(questions[0]);
      } else {
        // Gerar pergunta contextualizada com IA
        const context = Object.entries(currentAnswers)
          .filter(([k]) => k.startsWith("explore_"))
          .map(([,v]) => v).join(". ");
        const res = await fetch("/api/north/explore", {
          method:"POST", headers:{"Content-Type":"application/json"},
          body:JSON.stringify({
            dreamText: currentAnswers.dream || dreamText,
            history: exploreHistory,
            questionIndex: idx,
          }),
        }).catch(() => null);
        hideThinking();
        if (res?.ok) {
          const { question } = await res.json();
          await addNorth(question || questions[idx] || questions[3]);
        } else {
          await addNorth(questions[idx] || questions[3]);
        }
      }
    } catch {
      hideThinking();
      await addNorth("O que mais te motiva a perseguir esse sonho?");
    }
  }

  // ── Perguntas de logística (5 fixas, apresentadas com warmth) ─────────────
  async function askLogistics(step: number, _answers: Record<string,string>) {
    showThinking();
    await sleep(700);
    hideThinking();
    const questions = [
      { text:"Quando você gostaria de ter esse sonho realizado?", placeholder:"Ex: em 6 meses, até dezembro, em 1 ano..." },
      { text:"Quanto tempo por dia consegues dedicar de forma realista?", placeholder:"Ex: 30 minutos, 1 hora, 2 horas..." },
      { text:"Qual é o melhor horário para ti? Manhã, tarde ou noite?", placeholder:"Ex: manhã cedo, depois do trabalho..." },
      { text:"Como você descreveria seu nível atual nesse tema?", placeholder:"Ex: iniciante, tenho alguma base, intermediário..." },
      { text:"Há algo que pode dificultar — compromissos, viagens, limitações?", placeholder:"Ex: trabalho intenso às segundas, viagens mensais..." },
    ];
    const q = questions[step];
    if (q) {
      setAnswers(prev => ({ ...prev, _placeholder: q.placeholder }));
      await addNorth(q.text);
    }
  }

  // ── Auth ───────────────────────────────────────────────────────────────────
  async function signUpOrIn(emailVal: string): Promise<boolean> {
    try {
      const { createClient } = await import("@/lib/supabase/client");
      const sb = createClient();
      const { error } = await sb.auth.signInWithOtp({
        email: emailVal,
        options: { shouldCreateUser: true, emailRedirectTo: `${window.location.origin}/onboarding/callback` },
      });
      if (error) { console.error("Auth error:", error.message); return false; }
      return true;
    } catch (e) { console.error("Auth exception:", e); return false; }
  }

  // ── Construção do plano ────────────────────────────────────────────────────
  async function buildPlan(allAnswers: Record<string,string>) {
    setBuildErr(null);
    const exploreCtx = Object.entries(allAnswers).filter(([k])=>k.startsWith("explore_")).map(([,v])=>v).join(" | ");

    await addNorth("Tenho tudo o que preciso.\n\nVou analisar o que me contaste e construir os pilares do teu plano.\n\nIsso leva alguns segundos.");
    showThinking();

    try {
      // 1. Criar sonho via API server-side
      const dreamRes = await fetch("/api/dreams", {
        method:"POST", headers:{"Content-Type":"application/json"},
        body:JSON.stringify({
          title: dreamText,
          description: exploreCtx,
          declared_deadline: allAnswers.deadline,
          time_available: allAnswers.daily_time,
          status: "active",
          maturity_stage: 3,
        }),
      });

      if (!dreamRes.ok) {
        const err = await dreamRes.json().catch(() => ({}));
        throw new Error(err.error || `Dream API ${dreamRes.status}`);
      }

      const { dream } = await dreamRes.json();
      if (!dream?.id) throw new Error("No dream returned");
      setDreamId(dream.id);

      // 2. Actualizar memória com explore context + logística via API de memoria
      await fetch("/api/dreams", {
        method:"PUT",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({
          dreamId: dream.id,
          exploreContext: exploreCtx,
          bestTime: allAnswers.best_time,
          currentLevel: allAnswers.current_level,
          constraints: allAnswers.constraints,
        }),
      }).catch(() => {}); // não bloqueia se falhar

      // 3. Gerar objectivos
      const objRes = await fetch("/api/north/extract-objectives", {
        method:"POST", headers:{"Content-Type":"application/json"},
        body:JSON.stringify({
          dreamId: dream.id,
          dreamTitle: dreamText,
          dreamReflection,
          exploreContext: exploreCtx,
          deadline: allAnswers.deadline,
          dailyTime: allAnswers.daily_time,
          bestTime: allAnswers.best_time,
          currentLevel: allAnswers.current_level,
          constraints: allAnswers.constraints,
        }),
      });

      hideThinking();

      if (!objRes.ok) throw new Error(`Objectives API ${objRes.status}`);
      const { objectives: objs } = await objRes.json();
      if (!objs?.length) throw new Error("No objectives returned");

      setObjectives(objs);
      setPhase("objectives");
      await addNorth(`Criei ${objs.length} objetivos para transformar esse sonho em realidade.\n\nVerifica se fazem sentido para ti.`);
      await sleep(400);
      setMsgs(prev => [...prev, {
        role:"choices",
        choices:[{ label:"Fazem sentido, continuar →", value:"ok" }],
        id: Math.random().toString()
      }]);

    } catch (err: any) {
      hideThinking();
      console.error("buildPlan error:", err?.message);
      setBuildErr(err?.message || "Erro inesperado");
      await addNorth("Algo correu mal ao construir o plano. Podemos tentar de novo?");
      setMsgs(prev => [...prev, {
        role:"choices",
        choices:[
          { label:"Tentar novamente", value:"retry" },
          { label:"Voltar ao início", value:"restart" },
        ],
        id: Math.random().toString()
      }]);
    }
  }

  // ── Escolhas clicáveis ─────────────────────────────────────────────────────
  async function handleChoice(value: string) {
    removeLastChoices();
    setDisabled(true);

    // Confirmação do reflexo do sonho — utilizador JÁ LOGADO
    if (value === "yes_loggedin") {
      addUser("Sim, é exatamente isso.");
      setPhase("deepen");
      await addNorth("Perfeito.\n\nAgora quero entender melhor esse sonho antes de construir o plano.");
      await sleep(800);
      await askDeepen(0, "", { dream: dreamText });
      setDisabled(false);
      return;
    }

    // Confirmação do reflexo do sonho — utilizador NÃO logado
    if ((phase === "email" || phase === ("deepen_pending_reflect" as any)) && (value === "yes" || value === "no")) {
      if (value === "yes") {
        addUser("Sim, é exatamente isso.");
        await sleep(400);
        await addNorth("Para guardar o teu progresso, preciso de um email.");
        await sleep(300);
        await addNorth("Qual é o teu email?");
        setTimeout(() => inputRef.current?.focus(), 200);
      } else {
        addUser("Não exatamente...");
        setPhase("dream");
        await addNorth("Sem problema. Conta com as tuas próprias palavras — o que é que queres mesmo?");
      }
      setDisabled(false);
      return;
    }

    // Após email enviado — aguardar confirmação
    if (value === "email_sent_ok") {
      setPhase("deepen");
      await addNorth("Ótimo. Vou continuar aqui.\n\nPodes verificar o email a qualquer momento — o link fica válido.");
      await sleep(600);
      await askDeepen(0, email, answers);
      setDisabled(false);
      return;
    }

    // Objectivos ok
    if (value === "ok" && phase === "objectives") {
      setPhase("tone");
      await addNorth("Uma última coisa.\n\nComo preferes que eu esteja nos momentos difíceis da jornada?");
      await sleep(300);
      addChoices([
        { label:"Direto — objetivo e sem rodeios", value:"direct" },
        { label:"Gentil — acolhedor e paciente",   value:"gentle" },
        { label:"Provocador — que me desafie mais", value:"challenger" },
      ]);
      setDisabled(false);
      return;
    }

    // Tom escolhido
    if (["direct","gentle","challenger"].includes(value) && phase === "tone") {
      const toneLabel: Record<string,string> = { direct:"Direto", gentle:"Gentil", challenger:"Provocador" };
      addUser(toneLabel[value] || value);
      setPhase("done");
      await sleep(300);
      showThinking();
      // Gerar blocos em background
      if (dreamId) {
        fetch("/api/objectives", {
          method:"GET",
          headers:{"Content-Type":"application/json"},
        }).catch(() => {});
      }
      await sleep(1500);
      hideThinking();
      await addNorth(`Entendido.\n\nO teu plano está pronto.\n\nO primeiro bloco foi agendado para as próximas 24 horas.\n\nSó precisas aparecer.`);
      await sleep(1000);
      router.push(dreamId ? `/objectives?dreamId=${dreamId}` : "/dashboard");
      setDisabled(false);
      return;
    }

    // Retry / restart
    if (value === "retry") {
      setDisabled(false);
      setBuildErr(null);
      setPhase("building");
      const allAnswers = { ...answers };
      await buildPlan(allAnswers);
      return;
    }
    if (value === "restart") {
      router.push("/onboarding");
      return;
    }

    setDisabled(false);
  }

  // ── Email enviado — mostrar confirmação ───────────────────────────────────
  // Só disparado quando um utilizador novo submete o email
  const emailSentRef = React.useRef(false);
  useEffect(() => {
    if (phase === "email" && email && !isLoggedIn && !emailSentRef.current) {
      emailSentRef.current = true;
      setTimeout(async () => {
        removeLastChoices();
        await addNorth(`Link enviado para ${email}.\n\nPodes abrir o link noutra aba para entrar — ou continuar aqui mesmo, o teu progresso fica guardado.`);
        addChoices([{ label:"Continuar aqui", value:"email_sent_ok" }]);
      }, 400);
    }
  }, [email, phase]);

  // ── Render ─────────────────────────────────────────────────────────────────
  const logoProgress = { dream:1, email:2, deepen:3, logistics:4, building:5, objectives:5, tone:5, done:5 };
  const pct = ((logoProgress[phase] || 1) / 5) * 100;
  const placeholder = phase === "logistics" ? (answers._placeholder || "Escreve aqui...") :
                      phase === "dream"     ? "O que queres mesmo..." :
                      phase === "email"     ? "teu@email.com" :
                      phase === "deepen"    ? "Conta com as tuas palavras..." :
                      "Escreve aqui...";
  const showInput = !["building","objectives","tone","done"].includes(phase) && !disabled || phase === "deepen" || phase === "logistics";

  return (
    <div style={{ minHeight:"100vh", height:"100vh", background:T.bg, color:T.light,
      fontFamily:"Inter,sans-serif", display:"flex", flexDirection:"column", overflow:"hidden" }}>

      {/* Header minimalista */}
      <header style={{ padding:"14px 24px", display:"flex", alignItems:"center", justifyContent:"space-between", flexShrink:0 }}>
        <p style={{ fontFamily:"'Playfair Display',serif", fontSize:"18px", fontWeight:700, margin:0, letterSpacing:"0.04em" }}>DP.</p>
        {/* Barra de progresso */}
        <div style={{ width:"120px", height:"2px", background:T.border, borderRadius:"999px", overflow:"hidden" }}>
          <div style={{ height:"100%", width:`${pct}%`, background:T.blue, borderRadius:"999px", transition:"width 600ms ease" }} />
        </div>
        <button onClick={() => router.push("/dashboard")}
          style={{ background:"none", border:"none", color:T.silver, cursor:"pointer", fontSize:"11px", fontFamily:"Inter,sans-serif" }}>
          Sair
        </button>
      </header>

      {/* Chat area */}
      <div style={{ flex:1, overflowY:"auto", padding:"8px 0 16px", display:"flex", flexDirection:"column", gap:"10px", maxWidth:"640px", width:"100%", margin:"0 auto", boxSizing:"border-box", paddingLeft:"24px", paddingRight:"24px" }}>

        {msgs.map((m, i) => {
          if (m.role === "north") return (
            <NorthMsg key={m.id || i} text={m.text!}
              onDone={i === msgs.length-1 ? () => { if (!disabled && showInput) inputRef.current?.focus(); } : undefined}
            />
          );
          if (m.role === "user") return <UserMsg key={i} text={m.text!} />;
          if (m.role === "choices") return (
            <div key={m.id || i} style={{ display:"flex", flexDirection:"column", gap:"6px", alignSelf:"flex-start", maxWidth:"84%" }}>
              {m.choices!.map(c => (
                <button key={c.value} onClick={() => !disabled && handleChoice(c.value)}
                  style={{ padding:"10px 18px", background:c.value==="ok"||c.value==="yes"||c.value==="email_sent_ok"?`${T.blue}22`:T.surface,
                    border:`1px solid ${c.value==="ok"||c.value==="yes"||c.value==="email_sent_ok"?T.blue+"55":T.border}`,
                    borderRadius:"8px", color:c.value==="ok"||c.value==="yes"||c.value==="email_sent_ok"?T.blue:T.silver,
                    fontSize:"13px", cursor:disabled?"default":"pointer", fontFamily:"Inter,sans-serif",
                    textAlign:"left", transition:"all 150ms ease" }}>
                  {c.label}
                </button>
              ))}
            </div>
          );
          return null;
        })}

        {/* Thinking indicator */}
        {thinking && (
          <div style={{ padding:"10px 16px", background:T.card, borderRadius:"12px 12px 12px 2px",
            border:`1px solid ${T.border}`, borderLeft:`2px solid ${T.silver}44`, alignSelf:"flex-start" }}>
            <p style={{ margin:0, fontSize:"12px", color:T.silver, fontStyle:"italic" }}>North está a pensar...</p>
          </div>
        )}

        {/* Objectivos gerados */}
        {phase === "objectives" && objectives.length > 0 && (
          <div style={{ alignSelf:"flex-start", width:"100%", marginTop:"4px" }}>
            {objectives.map((obj: any, i: number) => (
              <div key={obj.id || i} style={{ display:"flex", gap:"10px", marginBottom:"8px", padding:"10px 14px",
                background:T.card, border:`1px solid ${T.border}`, borderRadius:"10px" }}>
                <span style={{ fontSize:"11px", color:T.blue, fontFamily:"monospace", fontWeight:700, minWidth:"20px" }}>
                  {String(i+1).padStart(2,"0")}
                </span>
                <div>
                  <p style={{ margin:"0 0 2px", fontSize:"13px", fontWeight:500, color:T.light }}>{obj.title}</p>
                  {obj.description && <p style={{ margin:0, fontSize:"11px", color:T.silver, lineHeight:1.4 }}>{obj.description}</p>}
                </div>
              </div>
            ))}
          </div>
        )}

        <div ref={chatEndRef} style={{ height:"4px" }} />
      </div>

      {/* Input area */}
      {!["building","objectives","tone","done"].includes(phase) && (
        <div style={{ padding:"12px 24px 20px", flexShrink:0, maxWidth:"640px", width:"100%", margin:"0 auto", boxSizing:"border-box" }}>
          <div style={{ display:"flex", gap:"8px" }}>
            <input ref={inputRef} value={input} onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key==="Enter" && handleSend()}
              placeholder={placeholder}
              type={phase==="email"?"email":"text"}
              disabled={disabled}
              style={{ flex:1, background:T.card, border:`1px solid ${T.border}`, borderRadius:"10px",
                padding:"12px 16px", color:T.light, fontSize:"14px", fontFamily:"Inter,sans-serif",
                outline:"none", opacity:disabled?0.5:1, transition:"border-color 150ms ease" }}
              onFocus={e => e.target.style.borderColor=T.blue+"55"}
              onBlur={e => e.target.style.borderColor=T.border}
            />
            <button onClick={handleSend} disabled={disabled || !input.trim()}
              style={{ padding:"12px 18px", background:input.trim()&&!disabled?T.blue:T.border,
                border:"none", borderRadius:"10px", color:T.light, fontSize:"14px",
                cursor:input.trim()&&!disabled?"pointer":"default", transition:"background 150ms ease" }}>
              →
            </button>
          </div>
        </div>
      )}
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
