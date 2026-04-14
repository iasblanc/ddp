// @ts-nocheck
"use client";
import { useState, useEffect, useRef, useCallback, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const T = {
  bg: "#0D0D14", card: "#1A1A2E", light: "#E8E4DC", silver: "#6B6B80",
  blue: "#4A6FA5", green: "#2D6A4F", amber: "#C9853A", border: "#252538",
  surface: "#141420",
};

// Fases do onboarding
type Phase =
  | "intro"          // North se apresenta
  | "dream"          // Utilizador escreve o sonho
  | "reflection"     // North devolve reflexo → sim/não
  | "explore"        // North faz perguntas livres (4-6 trocas)
  | "logistics"      // 7 perguntas logísticas
  | "building"       // North constrói objectivos
  | "review"         // Utilizador valida objectivos
  | "tone"           // Escolha do tom
  | "complete";      // Fim

// Perguntas logísticas — após a exploração
const LOGISTICS = [
  { id: "deadline",      text: "Em quanto tempo você quer que esse sonho seja realidade?", placeholder: "Ex: em 6 meses, até dezembro de 2026..." },
  { id: "daily_time",    text: "Quanto tempo por dia você consegue dedicar a isso — sendo honesto?", placeholder: "Ex: 1 hora por dia, 30 minutos de manhã..." },
  { id: "best_time",     text: "Em que horário do dia você tem mais foco e energia?", placeholder: "Ex: manhã cedo, depois do almoço, à noite..." },
  { id: "current_level", text: "Qual é o seu ponto de partida hoje em relação a esse sonho?", placeholder: "Ex: nunca comecei, já tentei, tenho alguma base..." },
  { id: "constraints",   text: "Há dias ou períodos em que você definitivamente não consegue trabalhar nisso?", placeholder: "Ex: fins de semana, às terças à noite, dezembro..." },
  { id: "success_metric",text: "Como você vai saber que conseguiu? O que vai ser concretamente diferente?", placeholder: "Ex: vou ter X, conseguirei Y, vou sentir Z..." },
];

const LOGISTICS_ACK: Record<string, string> = {
  deadline: "Entendido.",
  daily_time: "Esse é o número real que importa.",
  best_time: "Faz sentido.",
  current_level: "Boa. Agora sei de onde partimos.",
  constraints: "Anotado no plano.",
};

function OnboardingContent() {
  const router = useRouter();
  const supabase = createClient();
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const searchParams = useSearchParams();
  const initialDream = searchParams.get("dream") || "";

  const [phase, setPhase] = useState<Phase>("intro");
  const [messages, setMessages] = useState<any[]>([]);
  const [thinking, setThinking] = useState(false);
  const [input, setInput] = useState(initialDream);
  const [submitting, setSubmitting] = useState(false);

  // Dados recolhidos
  const [dreamText, setDreamText] = useState(initialDream);
  const [dreamReflection, setDreamReflection] = useState("");

  // Exploração livre
  const [exploreIdx, setExploreIdx] = useState(0);      // quantas perguntas feitas
  const [exploreHistory, setExploreHistory] = useState<any[]>([]); // historial da exploração

  // Logística
  const [logIdx, setLogIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});

  // Resultado
  const [objectives, setObjectives] = useState<any[]>([]);
  const [dreamId, setDreamId] = useState<string | null>(null);
  const [tone, setTone] = useState<string | null>(null);

  const scroll = useCallback(() => {
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 80);
  }, []);

  const addNorth = useCallback((content: string, delayMs = 900) => {
    return new Promise<void>(resolve => {
      setThinking(true);
      scroll();
      setTimeout(() => {
        setThinking(false);
        setMessages(prev => [...prev, { role: "north", content }]);
        scroll();
        resolve();
      }, delayMs);
    });
  }, [scroll]);

  // ── INTRO ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (initialDream) {
      addNorth(
        "Olá. Sou North.\n\nVi que você já tem um sonho em mente. Vou entender melhor antes de construirmos o seu plano.",
        600
      ).then(() => { setPhase("dream"); setTimeout(() => inputRef.current?.focus(), 200); });
    } else {
      addNorth(
        "Olá. Eu sou North.\n\nAntes de qualquer plano, preciso entender o seu sonho de verdade.\n\nNão tenho pressa. Começa.",
        900
      ).then(() => { setPhase("dream"); setTimeout(() => inputRef.current?.focus(), 200); });
    }
  }, []);

  // ── SUBMIT SONHO ───────────────────────────────────────────────────────────
  async function handleDreamSubmit() {
    if (!input.trim() || submitting) return;
    const dream = input.trim();
    setDreamText(dream);
    setInput("");
    setMessages(prev => [...prev, { role: "user", content: dream }]);
    setSubmitting(true);

    const res = await fetch("/api/north/reflect", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dream }),
    });
    const data = res.ok ? await res.json() : {};
    const reflection = data.reflection || "Você quer construir algo que seja verdadeiramente seu.";
    setDreamReflection(reflection);
    setSubmitting(false);

    await addNorth(`${reflection}\n\nIsso está certo?`, 1600);
    setPhase("reflection");
  }

  // ── REFLEXO CONFIRMADO → iniciar exploração livre ─────────────────────────
  async function handleReflectionYes() {
    setMessages(prev => [...prev, { role: "user", content: "Sim, é isso." }]);
    await addNorth(
      "Perfeito.\n\nAntes de qualquer plano, quero entender melhor esse sonho.\n\nVou te fazer algumas perguntas. Não existe resposta certa — só a sua.",
      1000
    );
    setPhase("explore");
    await askExploreQuestion(0, []);
  }

  async function handleReflectionNo() {
    setMessages(prev => [...prev, { role: "user", content: "Não exatamente." }]);
    await addNorth("Conta mais. O que é mais importante que não captei?", 700);
    setPhase("dream");
    setTimeout(() => inputRef.current?.focus(), 200);
  }

  // ── PERGUNTAS LIVRES ───────────────────────────────────────────────────────
  async function askExploreQuestion(idx: number, history: any[]) {
    if (idx >= 6) {
      // Exploração concluída → ir para logística
      await transitionToLogistics();
      return;
    }

    setSubmitting(true);
    const res = await fetch("/api/north/explore", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        dream: dreamText,
        reflection: dreamReflection,
        history,
        questionIndex: idx,
      }),
    });
    setSubmitting(false);

    if (!res.ok) { await transitionToLogistics(); return; }
    const { question, done } = await res.json();

    if (done || !question) {
      await transitionToLogistics();
      return;
    }

    await addNorth(question, 1000);
    setExploreIdx(idx);
    setTimeout(() => inputRef.current?.focus(), 200);
  }

  async function handleExploreAnswer() {
    if (!input.trim() || submitting) return;
    const answer = input.trim();
    setInput("");

    const newHistory = [...exploreHistory,
      { role: "north", content: "..." },  // placeholder — será preenchido com a pergunta actual
      { role: "user", content: answer },
    ];

    // Na prática, guarda a conversa real
    const lastNorthMsg = messages.filter(m => m.role === "north").slice(-1)[0]?.content || "";
    const updatedHistory = [...exploreHistory,
      { role: "north", content: lastNorthMsg },
      { role: "user", content: answer },
    ];

    setExploreHistory(updatedHistory);
    setMessages(prev => [...prev, { role: "user", content: answer }]);

    const nextIdx = exploreIdx + 1;

    // North pode dar um breve acknowledgment antes da próxima pergunta
    // (a API decide se há mais perguntas ou se já chega)
    await askExploreQuestion(nextIdx, updatedHistory);
  }

  // ── TRANSIÇÃO PARA LOGÍSTICA ───────────────────────────────────────────────
  async function transitionToLogistics() {
    await addNorth(
      "Já tenho uma boa noção do seu sonho.\n\nAgora preciso de alguns dados práticos para construir um plano que funcione com a sua vida real.",
      1000
    );
    setPhase("logistics");
    setLogIdx(0);
    await addNorth(LOGISTICS[0].text, 700);
    setTimeout(() => inputRef.current?.focus(), 200);
  }

  // ── PERGUNTAS LOGÍSTICAS ───────────────────────────────────────────────────
  async function handleLogisticsAnswer() {
    if (!input.trim()) return;
    const answer = input.trim();
    setInput("");
    const q = LOGISTICS[logIdx];
    const newAnswers = { ...answers, [q.id]: answer };
    setAnswers(newAnswers);
    setMessages(prev => [...prev, { role: "user", content: answer }]);

    const next = logIdx + 1;
    if (next < LOGISTICS.length) {
      const ack = LOGISTICS_ACK[q.id];
      if (ack) await addNorth(ack, 400);
      setLogIdx(next);
      await addNorth(LOGISTICS[next].text, 700);
      setTimeout(() => inputRef.current?.focus(), 200);
    } else {
      await buildObjectives(newAnswers);
    }
  }

  // ── CONSTRUÇÃO DOS OBJECTIVOS ──────────────────────────────────────────────
  async function buildObjectives(allAnswers: Record<string, string>) {
    await addNorth(
      "Tenho tudo que preciso.\n\nVou analisar o que você me contou e construir os pilares concretos do seu plano.\n\nIsso leva alguns segundos.",
      600
    );
    setPhase("building");
    setThinking(true);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push("/"); return; }

    const { data: dream } = await supabase.from("dreams").insert({
      user_id: user.id, title: dreamText, status: "active",
      maturity_stage: 3, activated_at: new Date().toISOString(),
    }).select().single();

    if (!dream) { setThinking(false); return; }
    setDreamId(dream.id);

    // Salvar memória — inclui contexto da exploração livre
    const exploreContext = exploreHistory
      .filter(h => h.role === "user")
      .map(h => h.content)
      .join(" | ");

    await supabase.from("dream_memories").insert({
      dream_id: dream.id, user_id: user.id,
      dream_profile: {
        dream_declared: dreamText,
        dream_real: dreamReflection,
        explore_context: exploreContext,
        deadline_declared: allAnswers.deadline || null,
        obstacle_declared: null,
        success_metric: allAnswers.success_metric || null,
        current_level: allAnswers.current_level || null,
        recurring_words: [], previous_attempts: [],
        last_updated: new Date().toISOString(),
      },
      execution_profile: {
        declared_times: [allAnswers.daily_time || "30 minutos"],
        best_time: allAnswers.best_time || null,
        constraints: allAnswers.constraints || null,
        real_times: [], strong_days: [], weak_days: [],
        avg_real_duration: 30, current_streak: 0, best_streak: 0,
      },
      emotional_profile: {
        preferred_tone: "direct", reacts_badly_to: [], reacts_well_to: [],
        crisis_moments: [], abandonment_triggers: [], resistance_language: [],
      },
      conversation_summaries: [],
    });

    // Gerar objectivos com contexto completo (incluindo exploração)
    const res = await fetch("/api/north/extract-objectives", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        dreamId: dream.id,
        dreamTitle: dreamText,
        dreamReflection,
        exploreContext,
        deadline: allAnswers.deadline,
        dailyTime: allAnswers.daily_time,
        bestTime: allAnswers.best_time,
        currentLevel: allAnswers.current_level,
        constraints: allAnswers.constraints,
        successMetric: allAnswers.success_metric,
      }),
    });

    setThinking(false);

    if (res.ok) {
      const { objectives: objs } = await res.json();
      setObjectives(objs || []);
      await addNorth(
        `Com base em tudo que você me contou, identifiquei ${objs?.length || 0} objetivos macro para tornar esse sonho real.\n\nVerifica se os pilares fazem sentido para você.`,
        500
      );
      setPhase("review");
    } else {
      await addNorth("Algo deu errado. Tenta novamente.", 400);
    }
  }

  // ── CONFIRMAR OBJECTIVOS → TOM ─────────────────────────────────────────────
  async function handleObjectivesConfirm() {
    setMessages(prev => [...prev, { role: "user", content: "Sim, faz sentido." }]);
    await addNorth("Perfeito.\n\nÚltima coisa — como você quer que eu fale com você quando as coisas ficarem difíceis?", 800);
    setPhase("tone");
  }

  // ── ESCOLHA DE TOM ─────────────────────────────────────────────────────────
  async function handleToneSelect(t: string) {
    setTone(t);
    const labels: Record<string, string> = {
      direct: "Direto.", gentle: "Gentil.", provocative: "Desafiador."
    };
    setMessages(prev => [...prev, { role: "user", content: labels[t] }]);

    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await supabase.from("users").update({
        north_tone: t,
        onboarding_completed_at: new Date().toISOString(),
      }).eq("id", user.id);
    }

    if (dreamId && objectives.length > 0) {
      generateAllBlocks(objectives, answers).catch(console.error);
    }

    setPhase("complete");
    await addNorth(
      "Seu plano está sendo construído.\n\nVai a Objetivos para acompanhar tudo.",
      700
    );
    setTimeout(() => router.push(`/objectives?dreamId=${dreamId}`), 2500);
  }

  async function generateAllBlocks(objs: any[], allAnswers: Record<string, string>) {
    for (const obj of objs) {
      await fetch(`/api/objectives/${obj.id}`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dailyTime: allAnswers.daily_time, bestTime: allAnswers.best_time,
          deadline: allAnswers.deadline, currentLevel: allAnswers.current_level,
          constraints: allAnswers.constraints,
        }),
      });
    }
  }

  // ── HANDLER CENTRAL DO INPUT ───────────────────────────────────────────────
  function handleSubmit() {
    if (phase === "dream")     return handleDreamSubmit();
    if (phase === "explore")   return handleExploreAnswer();
    if (phase === "logistics") return handleLogisticsAnswer();
  }

  const showInput = ["dream", "explore", "logistics"].includes(phase);
  const isLogistics = phase === "logistics";
  const isExplore   = phase === "explore";
  const currentLog  = LOGISTICS[logIdx];

  // Progress indicator
  const progressPhases = ["dream", "explore", "logistics", "building", "review", "tone", "complete"];
  const progressPct = progressPhases.includes(phase)
    ? Math.round((progressPhases.indexOf(phase) / (progressPhases.length - 1)) * 100)
    : 0;

  return (
    <div style={{ minHeight: "100vh", background: T.bg, color: T.light, fontFamily: "Inter, sans-serif", display: "flex", flexDirection: "column" }}>

      {/* Header */}
      <div style={{ padding: "24px 24px 0", maxWidth: "600px", margin: "0 auto", width: "100%", boxSizing: "border-box" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "32px" }}>
          <p style={{ fontFamily: "'Playfair Display', serif", fontSize: "16px", fontWeight: 700, letterSpacing: "0.06em", margin: 0 }}>DP.</p>
          {/* Barra de progresso geral */}
          <div style={{ width: "120px" }}>
            <div style={{ height: "2px", background: T.border, borderRadius: "999px" }}>
              <div style={{ height: "100%", width: `${progressPct}%`, background: T.blue, borderRadius: "999px", transition: "width 600ms ease" }} />
            </div>
          </div>
        </div>

        {/* Indicador de fase */}
        {isExplore && (
          <div style={{ marginBottom: "20px" }}>
            <span style={{ fontSize: "10px", color: T.silver, textTransform: "uppercase", letterSpacing: "0.1em" }}>
              Entendendo o sonho · pergunta {exploreIdx + 1}
            </span>
          </div>
        )}
        {isLogistics && (
          <div style={{ marginBottom: "20px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
              <span style={{ fontSize: "10px", color: T.silver, textTransform: "uppercase", letterSpacing: "0.1em" }}>
                Dados do plano · {logIdx + 1} de {LOGISTICS.length}
              </span>
            </div>
            <div style={{ height: "2px", background: T.border, borderRadius: "999px" }}>
              <div style={{ height: "100%", width: `${((logIdx + 1) / LOGISTICS.length) * 100}%`, background: T.amber, borderRadius: "999px", transition: "width 400ms ease" }} />
            </div>
          </div>
        )}
      </div>

      {/* Conversa */}
      <div style={{ flex: 1, padding: "0 24px", maxWidth: "600px", margin: "0 auto", width: "100%", boxSizing: "border-box" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>

          {messages.map((m, i) => (
            <div key={i} style={{
              maxWidth: m.role === "user" ? "82%" : "100%",
              alignSelf: m.role === "user" ? "flex-end" : "flex-start",
              padding: "12px 18px", borderRadius: "12px",
              background: m.role === "user" ? T.surface : T.card,
              border: `1px solid ${T.border}`,
              borderLeft: m.role === "north" ? `2px solid ${T.silver}` : undefined,
            }}>
              <p style={{ margin: 0, fontSize: "14px", lineHeight: 1.85, fontWeight: 300,
                fontStyle: m.role === "north" ? "italic" : "normal", whiteSpace: "pre-wrap" }}>
                {m.content}
              </p>
            </div>
          ))}

          {(thinking || submitting) && (
            <div style={{ padding: "12px 18px", background: T.card, borderRadius: "12px",
              border: `1px solid ${T.border}`, borderLeft: `2px solid ${T.silver}`, alignSelf: "flex-start" }}>
              <p style={{ margin: 0, fontSize: "13px", color: T.silver, fontStyle: "italic" }}>
                North está pensando...
              </p>
            </div>
          )}

          {/* Sim / Não exatamente */}
          {phase === "reflection" && (
            <div style={{ display: "flex", gap: "8px" }}>
              <button onClick={handleReflectionYes}
                style={{ flex: 1, padding: "12px", background: T.card, border: `1px solid ${T.blue}44`, borderRadius: "8px", color: T.light, fontSize: "13px", cursor: "pointer", fontFamily: "Inter, sans-serif" }}>
                Sim, é isso
              </button>
              <button onClick={handleReflectionNo}
                style={{ flex: 1, padding: "12px", background: "transparent", border: `1px solid ${T.border}`, borderRadius: "8px", color: T.silver, fontSize: "13px", cursor: "pointer", fontFamily: "Inter, sans-serif" }}>
                Não exatamente
              </button>
            </div>
          )}

          {/* Revisão de objectivos */}
          {phase === "review" && objectives.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {objectives.map((obj, i) => (
                <div key={obj.id || i} style={{ padding: "14px 18px", background: T.surface,
                  border: `1px solid ${T.blue}33`, borderLeft: `3px solid ${T.blue}`, borderRadius: "10px" }}>
                  <div style={{ display: "flex", gap: "12px" }}>
                    <span style={{ fontSize: "10px", color: T.blue, fontWeight: 700, fontFamily: "monospace", paddingTop: "3px", minWidth: "22px" }}>
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <div>
                      <p style={{ margin: "0 0 3px", fontSize: "14px", fontWeight: 600 }}>{obj.title}</p>
                      {obj.description && <p style={{ margin: "0 0 3px", fontSize: "12px", color: T.light, lineHeight: 1.5 }}>{obj.description}</p>}
                      {obj.why && <p style={{ margin: 0, fontSize: "11px", color: T.silver, fontStyle: "italic" }}>→ {obj.why}</p>}
                    </div>
                  </div>
                </div>
              ))}
              <div style={{ display: "flex", gap: "8px", marginTop: "8px" }}>
                <button onClick={handleObjectivesConfirm}
                  style={{ flex: 2, padding: "12px", background: T.blue, border: "none", borderRadius: "8px", color: T.light, fontSize: "13px", fontWeight: 500, cursor: "pointer", fontFamily: "Inter, sans-serif" }}>
                  Perfeito, avançar →
                </button>
                <button onClick={() => {
                  setObjectives([]);
                  setMessages(prev => [...prev, { role: "north", content: "Tudo bem. Me conta o sonho de novo com suas próprias palavras." }]);
                  setPhase("dream");
                  setInput("");
                  setTimeout(() => inputRef.current?.focus(), 200);
                }} style={{ flex: 1, padding: "12px", background: "transparent", border: `1px solid ${T.border}`, borderRadius: "8px", color: T.silver, fontSize: "13px", cursor: "pointer", fontFamily: "Inter, sans-serif" }}>
                  Ajustar
                </button>
              </div>
            </div>
          )}

          {/* Escolha de tom */}
          {phase === "tone" && !tone && (
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {[
                { key: "direct",      label: "Direto",      desc: "Objetivo, sem rodeios" },
                { key: "gentle",      label: "Gentil",      desc: "Acolhedor e paciente" },
                { key: "provocative", label: "Desafiador",  desc: "Questiona mais, aceita menos desculpas" },
              ].map(t => (
                <button key={t.key} onClick={() => handleToneSelect(t.key)}
                  style={{ padding: "14px 18px", background: T.surface, border: `1px solid ${T.border}`, borderRadius: "8px",
                    color: T.light, fontSize: "13px", cursor: "pointer", fontFamily: "Inter, sans-serif",
                    textAlign: "left", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontWeight: 600 }}>{t.label}</span>
                  <span style={{ color: T.silver, fontSize: "12px" }}>{t.desc}</span>
                </button>
              ))}
            </div>
          )}

          <div ref={bottomRef} style={{ height: "1px" }} />
        </div>
      </div>

      {/* Input */}
      {showInput && (
        <div style={{ padding: "16px 24px 32px", maxWidth: "600px", margin: "0 auto", width: "100%", boxSizing: "border-box" }}>
          {/* Placeholder contextual */}
          {isExplore && (
            <p style={{ fontSize: "11px", color: T.silver, marginBottom: "8px", letterSpacing: "0.04em" }}>
              Responde com o que vier — sem filtro.
            </p>
          )}
          {isLogistics && currentLog && (
            <p style={{ fontSize: "11px", color: T.amber, marginBottom: "8px", letterSpacing: "0.04em", opacity: 0.8 }}>
              Dados do plano
            </p>
          )}
          <div style={{ display: "flex", gap: "8px" }}>
            <textarea
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSubmit(); }
              }}
              placeholder={
                phase === "dream"     ? "Qual é o sonho que você não para de adiar?" :
                phase === "explore"   ? "Responde o que vier à mente..." :
                currentLog?.placeholder || ""
              }
              rows={2}
              disabled={submitting || thinking}
              style={{ flex: 1, background: T.card, border: `1px solid ${
                isLogistics ? T.amber + "44" : T.border
              }`, borderRadius: "10px", padding: "12px 16px", color: T.light, fontSize: "14px",
                fontFamily: "Inter, sans-serif", resize: "none", outline: "none", lineHeight: 1.5,
                opacity: submitting || thinking ? 0.6 : 1 }}
            />
            <button
              onClick={handleSubmit}
              disabled={!input.trim() || submitting || thinking}
              style={{ padding: "12px 18px", background: input.trim() && !submitting ? T.blue : T.border,
                border: "none", borderRadius: "10px", color: T.light, fontSize: "13px",
                fontWeight: 500, cursor: "pointer", fontFamily: "Inter, sans-serif" }}>
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
    <Suspense fallback={<div style={{ minHeight: "100vh", background: "#0D0D14" }} />}>
      <OnboardingContent />
    </Suspense>
  );
}
