// @ts-nocheck
"use client";
import React, { useState, useEffect, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";

const T = {
  bg:"#0D0D14", card:"#1A1A2E", light:"#E8E4DC",
  silver:"#6B6B80", blue:"#4A6FA5", green:"#2D6A4F",
  amber:"#C9853A", border:"#252538", surface:"#141420",
};

// ─── Tipos de mensagem ────────────────────────────────────────────────────────
type Msg =
  | { k:"north";  id:string; text:string }
  | { k:"user";   id:string; text:string }
  | { k:"opts";   id:string; opts:Array<{label:string; val:string}> }
  | { k:"cards";  id:string; items:Array<{title:string; desc?:string}> }
  | { k:"think" };

// ─── Componentes de bubble ────────────────────────────────────────────────────
function North({ text }: { text:string }) {
  const [words, setWords] = useState<string[]>([]);
  useEffect(() => {
    setWords([]);
    const arr = text.split(" ");
    let i = 0;
    const iv = setInterval(() => {
      if (i >= arr.length) { clearInterval(iv); return; }
      setWords(p => [...p, arr[i++]]);
    }, 30);
    return () => clearInterval(iv);
  }, [text]);
  return (
    <div style={{ maxWidth:"80%", padding:"13px 17px", background:T.card,
      borderRadius:"14px 14px 14px 3px", border:`1px solid ${T.border}`,
      borderLeft:`2px solid ${T.silver}44`, alignSelf:"flex-start" }}>
      <p style={{ margin:0, fontSize:"14px", fontWeight:300, fontStyle:"italic",
        lineHeight:1.85, color:T.light, whiteSpace:"pre-wrap" }}>
        {words.join(" ")}
      </p>
    </div>
  );
}

function User({ text }: { text:string }) {
  return (
    <div style={{ maxWidth:"72%", padding:"12px 17px", background:T.surface,
      borderRadius:"14px 14px 3px 14px", border:`1px solid ${T.border}`, alignSelf:"flex-end" }}>
      <p style={{ margin:0, fontSize:"14px", lineHeight:1.7, color:T.light }}>{text}</p>
    </div>
  );
}

function Opts({ opts, onPick }: { opts:Array<{label:string;val:string}>; onPick:(v:string)=>void }) {
  const [picked, setPicked] = useState(false);
  return (
    <div style={{ display:"flex", flexDirection:"column", gap:"7px",
      alignSelf:"flex-start", maxWidth:"84%" }}>
      {opts.map(o => {
        const primary = o.val === "yes" || o.val === "ok" || o.val === "cont";
        return (
          <button key={o.val}
            onClick={() => { if (picked) return; setPicked(true); onPick(o.val); }}
            style={{ padding:"11px 18px", textAlign:"left", fontFamily:"Inter,sans-serif",
              fontSize:"13px", cursor:picked?"default":"pointer", borderRadius:"9px",
              background:primary?`${T.blue}22`:T.surface,
              border:`1px solid ${primary?T.blue+"55":T.border}`,
              color:primary?T.blue:T.silver,
              opacity:picked?0.5:1, transition:"all 140ms ease" }}>
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

function Cards({ items }: { items:Array<{title:string;desc?:string}> }) {
  return (
    <div style={{ alignSelf:"flex-start", width:"100%", display:"flex", flexDirection:"column", gap:"7px" }}>
      {items.map((it,i) => (
        <div key={i} style={{ display:"flex", gap:"12px", padding:"11px 15px",
          background:T.card, border:`1px solid ${T.border}`, borderRadius:"10px" }}>
          <span style={{ fontSize:"11px", color:T.blue, fontFamily:"monospace",
            fontWeight:700, minWidth:"22px", paddingTop:"2px" }}>
            {String(i+1).padStart(2,"0")}
          </span>
          <div>
            <p style={{ margin:"0 0 2px", fontSize:"13px", fontWeight:500, color:T.light }}>{it.title}</p>
            {it.desc && <p style={{ margin:0, fontSize:"11px", color:T.silver, lineHeight:1.4 }}>{it.desc}</p>}
          </div>
        </div>
      ))}
    </div>
  );
}

function Think() {
  return (
    <div style={{ alignSelf:"flex-start", padding:"12px 18px", background:T.card,
      border:`1px solid ${T.border}`, borderLeft:`2px solid ${T.silver}33`,
      borderRadius:"14px 14px 14px 3px" }}>
      <div style={{ display:"flex", gap:"5px" }}>
        {[0,1,2].map(i => (
          <div key={i} style={{ width:"6px", height:"6px", borderRadius:"50%",
            background:T.silver, animation:`dp-dot 1.2s ease-in-out ${i*0.2}s infinite` }} />
        ))}
      </div>
    </div>
  );
}

// ─── Motor de conversa ────────────────────────────────────────────────────────
function OnboardingContent() {
  const router = useRouter();
  const params = useSearchParams();
  const endRef  = useRef<HTMLDivElement>(null);
  const inpRef  = useRef<HTMLInputElement>(null);

  // Auth — ref para nunca ter stale closure
  const loggedIn = useRef(false);

  // Mensagens
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const push = (m: Msg) => { setMsgs(p => [...p, m]); setTimeout(() => endRef.current?.scrollIntoView({behavior:"smooth"}), 80); };
  const uid  = () => Math.random().toString(36).slice(2);

  // Input
  const [inp,  setInp]  = useState("");
  const [show, setShow] = useState(false);        // mostrar input
  const [ph,   setPh]   = useState("");
  const [type, setType] = useState<"text"|"email">("text");

  // Progresso
  const [pct, setPct] = useState(10);

  // Stage — useRef para nunca ser stale
  // 0=dream 1=email 2=deepen0 3=deepen1 4=deepen2 5=deepen3
  // 6=log0 7=log1 8=log2 9=log3 10=build 11=tone 12=done
  const stage = useRef(0);

  // Dados
  const dream   = useRef("");
  const refl    = useRef("");
  const answers = useRef<Record<string,string>>({});
  const explore = useRef<string[]>([]);
  const dreamId = useRef<string|null>(null);

  // ── helpers ────────────────────────────────────────────────────────────────
  function north(text:string) {
    // Remove "thinking" se estiver no final
    setMsgs(p => {
      const last = p[p.length-1];
      if (last?.k === "think") return [...p.slice(0,-1), { k:"north", id:uid(), text }];
      return [...p, { k:"north", id:uid(), text }];
    });
    setTimeout(() => endRef.current?.scrollIntoView({behavior:"smooth"}), 80);
    // Retorna promise que resolve após typewriter (approx)
    const ms = text.split(" ").length * 32 + 400;
    return new Promise<void>(r => setTimeout(r, ms));
  }
  function user(text:string) { push({ k:"user", id:uid(), text }); }
  function opts(o:Array<{label:string;val:string}>) { push({ k:"opts", id:uid(), opts:o }); }
  function cards(items:Array<{title:string;desc?:string}>) { push({ k:"cards", id:uid(), items }); }
  function think() { setMsgs(p => [...p, { k:"think" }]); setTimeout(() => endRef.current?.scrollIntoView({behavior:"smooth"}), 80); }
  function unthink() { setMsgs(p => p[p.length-1]?.k==="think" ? p.slice(0,-1) : p); }

  function openInput(placeholder:string, t:"text"|"email"="text") {
    setPh(placeholder); setType(t); setShow(true);
    setTimeout(() => inpRef.current?.focus(), 120);
  }
  function closeInput() { setShow(false); setInp(""); }

  // ── Inicialização ──────────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      // Verificar auth
      try {
        const { createClient } = await import("@/lib/supabase/client");
        const { data:{ user:u } } = await createClient().auth.getUser();
        if (u) loggedIn.current = true;
      } catch {}

      await north("Olá. Eu sou North.\n\nEstou aqui para transformar esse sonho em algo real.\n\nNão tenho pressa.");
      await north("Qual é o sonho que você não para de adiar?");
      setPct(15);

      const prefill = params.get("dream") || "";
      if (prefill) setInp(prefill);
      openInput("Escreve o seu sonho aqui...");
    })();
  }, []);

  // ── Submissão do input ─────────────────────────────────────────────────────
  async function submit() {
    const val = inp.trim();
    if (!val) return;
    closeInput();
    user(val);

    const s = stage.current;

    // Sonho
    if (s === 0) {
      dream.current = val;
      think();
      let ref = "";
      try {
        const res = await fetch("/api/north/chat", {
          method:"POST", headers:{"Content-Type":"application/json"},
          body: JSON.stringify({ messages:[{ role:"user", content:
            `O utilizador descreveu o sonho: "${val}". Escreve 1-2 frases que reflectem o que há de mais profundo por trás dessas palavras. Começa com "Você quer..." e captura a emoção real. Termina com "Isso ressoa?" Responde em português.`
          }], conversationType:"extraction" }),
        });
        const reader = res.body!.getReader(); const dec = new TextDecoder();
        while(true){ const{done,value}=await reader.read(); if(done)break;
          for(const l of dec.decode(value).split("\n")){
            if(l.startsWith("data: ")){try{const d=JSON.parse(l.slice(6));if(d.text)ref+=d.text;}catch{}}
          }
        }
      } catch {}
      refl.current = ref || `Você quer ${val}.\n\nIsso ressoa?`;
      await north(refl.current);
      opts([
        { label:"Sim, é exatamente isso.", val:"yes" },
        { label:"Não completamente...",    val:"no"  },
      ]);
      return;
    }

    // Email
    if (s === 1) {
      if (!val.includes("@")||!val.includes(".")) {
        await north("Esse email não parece válido. Tenta de novo.");
        openInput("seuemail@exemplo.com","email");
        return;
      }
      think();
      try {
        const { createClient } = await import("@/lib/supabase/client");
        await createClient().auth.signInWithOtp({
          email:val, options:{ shouldCreateUser:true,
            emailRedirectTo:`${location.origin}/onboarding/callback` }
        });
      } catch {}
      await north(`Link enviado para ${val}.\n\nPode continuar aqui — o seu progresso fica guardado.`);
      opts([{ label:"Continuar aqui →", val:"cont" }]);
      return;
    }

    // Deepen 0-3
    if (s >= 2 && s <= 5) {
      explore.current.push(val);
      stage.current++;
      setPct(35 + (s-2)*7);
      if (stage.current <= 5) {
        await north(deepQ[stage.current - 2]);
        openInput("Conta com as suas palavras...");
      } else {
        stage.current = 6;
        setPct(60);
        await north("Obrigado por partilhar isso.\n\nPreciso de alguns dados práticos para montar o plano.");
        await north(logQ[0].q);
        openInput(logQ[0].ph);
      }
      return;
    }

    // Logistics 0-3
    if (s >= 6 && s <= 9) {
      const idx = s - 6;
      answers.current[logQ[idx].key] = val;
      stage.current++;
      setPct(65 + idx*5);
      if (stage.current <= 9) {
        const next = stage.current - 6;
        await north(logQ[next].q);
        openInput(logQ[next].ph);
      } else {
        stage.current = 10;
        await doBuild();
      }
      return;
    }
  }

  // ── Perguntas ──────────────────────────────────────────────────────────────
  const deepQ = [
    "Por que esse sonho importa para você agora — e não daqui a cinco anos?",
    "O que te impediu de começar até hoje?",
    "Se esse sonho se tornasse real amanhã, o que mudaria de concreto na sua vida?",
    "Quanto tempo por dia você consegue dedicar a isso — sendo honesto consigo mesmo?",
  ];
  const logQ = [
    { key:"deadline",      q:"Quando você quer ter esse sonho realizado?",             ph:"Ex: em 6 meses, até dezembro..." },
    { key:"best_time",     q:"Qual o melhor horário do dia para trabalhar nisso?",     ph:"Ex: manhã cedo, noite..." },
    { key:"current_level", q:"Como descreve seu nível atual nesse tema?",              ph:"Ex: iniciante, tenho alguma base..." },
    { key:"constraints",   q:"Tem algum compromisso que pode dificultar a jornada?",   ph:"Ex: trabalho intenso, viagens..." },
  ];

  // ── Build do plano ─────────────────────────────────────────────────────────
  async function doBuild() {
    setPct(85);
    think();
    await new Promise(r => setTimeout(r, 400));
    setMsgs(p => {
      const last = p[p.length-1];
      if (last?.k === "think") {
        return [...p.slice(0,-1), { k:"north", id:uid(), text:"Tenho tudo que preciso.\n\nVou analisar o que você me contou e construir os pilares do seu plano.\n\nIsso leva alguns segundos." }];
      }
      return [...p, { k:"north", id:uid(), text:"Tenho tudo que preciso.\n\nVou analisar o que você me contou e construir os pilares do seu plano.\n\nIsso leva alguns segundos." }];
    });
    setTimeout(() => endRef.current?.scrollIntoView({behavior:"smooth"}), 80);
    think();

    const exploreCtx = explore.current.join(" | ");
    const a = answers.current;

    try {
      const dr = await fetch("/api/dreams", {
        method:"POST", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({ title:dream.current, description:exploreCtx,
          declared_deadline:a.deadline, time_available:a.daily_time||"1 hora",
          status:"active", maturity_stage:3 }),
      });
      if (!dr.ok) throw new Error(`Dream ${dr.status}`);
      const { dream: d } = await dr.json();
      if (!d?.id) throw new Error("no id");
      dreamId.current = d.id;

      const or = await fetch("/api/north/extract-objectives", {
        method:"POST", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({ dreamId:d.id, dreamTitle:dream.current,
          dreamReflection:refl.current, exploreContext:exploreCtx,
          deadline:a.deadline, dailyTime:a.daily_time||"1 hora",
          bestTime:a.best_time, currentLevel:a.current_level,
          constraints:a.constraints }),
      });
      if (!or.ok) throw new Error(`Objectives ${or.status}`);
      const { objectives:objs } = await or.json();
      if (!objs?.length) throw new Error("no objectives");

      unthink();
      setPct(92);
      await north(`Identifiquei ${objs.length} objetivos para tornar esse sonho real.`);
      cards(objs.map((o:any) => ({ title:o.title, desc:o.description })));
      await new Promise(r => setTimeout(r, 600));
      stage.current = 11;
      opts([{ label:"Faz sentido. Continuar →", val:"ok" }]);

    } catch (e:any) {
      unthink();
      console.error("build:", e?.message);
      await north("Algo correu mal ao construir o plano. Vamos tentar de novo?");
      opts([
        { label:"Tentar novamente", val:"retry"   },
        { label:"Recomeçar",        val:"restart" },
      ]);
    }
  }

  // ── Escolhas ──────────────────────────────────────────────────────────────
  async function pick(val:string) {
    // Confirmar sonho
    if (val === "yes") {
      user("Sim, é exatamente isso.");
      if (loggedIn.current) {
        stage.current = 2;
        setPct(30);
        await north("Perfeito.\n\nQuero entender melhor esse sonho antes de montar o plano.");
        await north(deepQ[0]);
        openInput("Conta com as suas palavras...");
      } else {
        stage.current = 1;
        setPct(22);
        await north("Para guardar o seu progresso, preciso de um email.");
        openInput("seuemail@exemplo.com","email");
      }
      return;
    }
    if (val === "no") {
      user("Não completamente...");
      await north("Sem problema. Conta com as tuas próprias palavras — o que você quer mesmo?");
      dream.current = "";
      stage.current = 0;
      openInput("Escreve o seu sonho aqui...");
      return;
    }
    if (val === "cont") {
      user("Continuar aqui agora.");
      stage.current = 2;
      setPct(30);
      await north("Ótimo.\n\nQuero entender melhor esse sonho antes de montar o plano.");
      await north(deepQ[0]);
      openInput("Conta com as suas palavras...");
      return;
    }
    if (val === "ok") {
      user("Faz sentido, continuar.");
      stage.current = 11;
      setPct(96);
      await north("Uma última coisa.\n\nComo você quer que eu esteja nos momentos difíceis da jornada?");
      opts([
        { label:"Direto — objetivo, sem rodeios",      val:"direct"     },
        { label:"Gentil — acolhedor e paciente",        val:"gentle"     },
        { label:"Provocador — que me desafie mais",     val:"challenger" },
      ]);
      return;
    }
    if (["direct","gentle","challenger"].includes(val)) {
      const labels:Record<string,string> = { direct:"Direto", gentle:"Gentil", challenger:"Provocador" };
      user(labels[val]);
      stage.current = 12;
      setPct(100);
      think();
      await new Promise(r => setTimeout(r, 1200));
      await north("Entendido.\n\nO seu plano está pronto.\n\nO primeiro bloco foi agendado para as próximas 24 horas.\n\nSó precisas aparecer.");
      await new Promise(r => setTimeout(r, 1800));
      router.push(dreamId.current ? `/objectives?dreamId=${dreamId.current}` : "/dashboard");
      return;
    }
    if (val === "retry") {
      stage.current = 10;
      await doBuild();
      return;
    }
    if (val === "restart") {
      router.push("/onboarding");
      return;
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight:"100vh", height:"100vh", background:T.bg, color:T.light,
      fontFamily:"Inter,sans-serif", display:"flex", flexDirection:"column", overflow:"hidden" }}>

      <style>{`@keyframes dp-dot{0%,80%,100%{opacity:.2}40%{opacity:.9}}`}</style>

      <header style={{ padding:"13px 24px", display:"flex", alignItems:"center",
        justifyContent:"space-between", flexShrink:0, borderBottom:`1px solid ${T.border}22` }}>
        <p style={{ fontFamily:"'Playfair Display',serif", fontSize:"18px", fontWeight:700, margin:0, color:T.light }}>DP.</p>
        <div style={{ flex:1, maxWidth:"150px", margin:"0 20px", height:"2px", background:T.border, borderRadius:"999px", overflow:"hidden" }}>
          <div style={{ height:"100%", width:`${pct}%`, background:`linear-gradient(90deg,${T.blue},${T.green})`,
            borderRadius:"999px", transition:"width 700ms ease" }} />
        </div>
        <button onClick={() => router.push("/dashboard")}
          style={{ background:"none", border:"none", color:T.silver, cursor:"pointer", fontSize:"11px", fontFamily:"Inter,sans-serif" }}>
          Sair
        </button>
      </header>

      <div style={{ flex:1, overflowY:"auto", display:"flex", flexDirection:"column", gap:"12px",
        maxWidth:"640px", width:"100%", margin:"0 auto", padding:"20px 24px 16px", boxSizing:"border-box" }}>
        {msgs.map((m, i) => {
          if (m.k === "north")  return <North key={(m as any).id} text={(m as any).text} />;
          if (m.k === "user")   return <User  key={(m as any).id} text={(m as any).text} />;
          if (m.k === "opts")   return <Opts  key={(m as any).id} opts={(m as any).opts} onPick={pick} />;
          if (m.k === "cards")  return <Cards key={(m as any).id} items={(m as any).items} />;
          if (m.k === "think")  return <Think key={i} />;
          return null;
        })}
        <div ref={endRef} style={{ height:"8px" }} />
      </div>

      {show && (
        <div style={{ padding:"10px 24px 22px", flexShrink:0, maxWidth:"640px",
          width:"100%", margin:"0 auto", boxSizing:"border-box" }}>
          <div style={{ display:"flex", gap:"8px" }}>
            <input ref={inpRef} value={inp} onChange={e => setInp(e.target.value)}
              onKeyDown={e => e.key==="Enter" && submit()}
              placeholder={ph} type={type}
              style={{ flex:1, background:T.card, border:`1px solid ${T.border}`,
                borderRadius:"10px", padding:"13px 16px", color:T.light, fontSize:"14px",
                fontFamily:"Inter,sans-serif", outline:"none", transition:"border-color 150ms ease" }}
              onFocus={e => e.target.style.borderColor=T.blue+"66"}
              onBlur={e => e.target.style.borderColor=T.border}
            />
            <button onClick={submit} disabled={!inp.trim()}
              style={{ padding:"13px 20px", background:inp.trim()?T.blue:T.border,
                border:"none", borderRadius:"10px", color:T.light, fontSize:"15px",
                cursor:inp.trim()?"pointer":"default", transition:"background 150ms ease" }}>→</button>
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
