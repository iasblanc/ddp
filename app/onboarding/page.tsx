// @ts-nocheck
"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const T = {
  bg: "#0D0D14", card: "#1A1A2E", light: "#E8E4DC", silver: "#6B6B80",
  blue: "#4A6FA5", green: "#2D6A4F", amber: "#C9853A", border: "#252538",
  surface: "#141420",
};

type Step = "intro" | "dream" | "reflection" | "deep-questions"
          | "building-objectives" | "review-objectives" | "tone" | "complete";

const DEEP_QUESTIONS = [
  {
    id: "deadline",
    text: "Em quanto tempo queres atingir este sonho?\nSe tens uma data específica em mente, diz-me qual é.",
    placeholder: "Ex: em 6 meses, até Dezembro de 2026, em 1 ano...",
  },
  {
    id: "daily_time",
    text: "Quanto tempo por dia consegues dedicar a isto de forma honesta?\nNão o ideal — o real.",
    placeholder: "Ex: 1 hora por dia, 30 minutos de manhã, 2 horas ao fim de semana...",
  },
  {
    id: "best_time",
    text: "A que horas do dia tens mais energia e foco?\nÉ nesse momento que vamos agendar os teus blocos.",
    placeholder: "Ex: manhã cedo antes do trabalho, depois do almoço, à noite...",
  },
  {
    id: "current_level",
    text: "Qual é o teu ponto de partida hoje?\nO que já sabes, já fizeste ou já tens em relação a este sonho?",
    placeholder: "Ex: nunca comecei, já tentei mas parei, tenho alguma base...",
  },
  {
    id: "main_obstacle",
    text: "O que te impediu de avançar até agora?\nSê honesto — é aqui que o plano tem de ser mais robusto.",
    placeholder: "Ex: falta de tempo, não sei por onde começar, perco a motivação...",
  },
  {
    id: "constraints",
    text: "Há dias ou horários em que sabes que não consegues trabalhar nisto?\nEx: fins de semana, viagens, épocas específicas.",
    placeholder: "Ex: às terças tenho reuniões até às 20h, viagens de negócios mensais...",
  },
  {
    id: "success_metric",
    text: "Como vais saber que conseguiste?\nDescreve o que vai ser diferente na tua vida quando o sonho for real.",
    placeholder: "Ex: vou ter X, conseguirei fazer Y, terei a sensação de Z...",
  },
];

export default function OnboardingPage() {
  const router = useRouter();
  const supabase = createClient();
  const bottomRef = useRef<HTMLDivElement>(null);

  const [step, setStep] = useState<Step>("intro");
  const [messages, setMessages] = useState<any[]>([]);
  const [thinking, setThinking] = useState(false);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  const [dreamText, setDreamText] = useState("");
  const [dreamReflection, setDreamReflection] = useState("");
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [qIdx, setQIdx] = useState(0);
  const [tone, setTone] = useState<string | null>(null);
  const [objectives, setObjectives] = useState<any[]>([]);
  const [dreamId, setDreamId] = useState<string | null>(null);

  const scroll = useCallback(() => {
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 80);
  }, []);

  const addNorth = useCallback((content: string, thinkMs = 1000) => {
    return new Promise<void>(resolve => {
      setThinking(true);
      scroll();
      setTimeout(() => {
        setThinking(false);
        setMessages(prev => [...prev, { role: "north", content }]);
        scroll();
        resolve();
      }, thinkMs);
    });
  }, [scroll]);

  // Intro
  useEffect(() => {
    addNorth(
      "Olá. Eu sou North.\n\nVou ajudar-te a transformar o teu sonho num plano real e completo — com objectivos concretos, tarefas específicas de 30 minutos e um calendário que funciona com a tua vida.\n\nNão tenho pressa. Começa.",
      900
    ).then(() => setTimeout(() => setStep("dream"), 400));
  }, []);

  async function handleDreamSubmit() {
    if (!input.trim() || loading) return;
    const dream = input.trim();
    setDreamText(dream);
    setInput("");
    setMessages(prev => [...prev, { role: "user", content: dream }]);
    setLoading(true);

    const res = await fetch("/api/north/reflect", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dream }),
    });
    const data = res.ok ? await res.json() : {};
    const reflection = data.reflection || "Queres construir algo que seja verdadeiramente teu.";
    setDreamReflection(reflection);
    setLoading(false);

    await addNorth(`${reflection}\n\nIsso está certo?`, 1800);
    setStep("reflection");
  }

  async function handleReflectionYes() {
    setMessages(prev => [...prev, { role: "user", content: "Sim, é isso." }]);
    await addNorth(
      "Perfeito.\n\nAgora preciso de perceber bem a tua situação para construir um plano que realmente funcione.\n\nVou fazer-te algumas perguntas — responde com honestidade, não com o que achas que devia ser.",
      1200
    );
    setStep("deep-questions");
    setQIdx(0);
    await addNorth(DEEP_QUESTIONS[0].text, 800);
  }

  async function handleReflectionNo() {
    setMessages(prev => [...prev, { role: "user", content: "Não exatamente." }]);
    await addNorth("Conta-me mais. O que é o mais importante que não captei?", 800);
    setStep("dream");
  }

  async function handleAnswerSubmit() {
    if (!input.trim()) return;
    const answer = input.trim();
    setInput("");
    const q = DEEP_QUESTIONS[qIdx];
    const newAnswers = { ...answers, [q.id]: answer };
    setAnswers(newAnswers);
    setMessages(prev => [...prev, { role: "user", content: answer }]);

    const next = qIdx + 1;
    if (next < DEEP_QUESTIONS.length) {
      setQIdx(next);
      await addNorth(DEEP_QUESTIONS[next].text, 800);
    } else {
      setStep("building-objectives");
      await buildObjectives(newAnswers);
    }
  }

  async function buildObjectives(allAnswers: Record<string, string>) {
    await addNorth(
      "Tenho tudo o que preciso.\n\nVou agora analisar o teu sonho e construir os objectivos macro — os pilares concretos que, quando alcançados, garantem que o teu sonho se torna realidade.\n\nIsto demora alguns segundos.",
      600
    );
    setThinking(true);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push("/"); return; }

    await supabase.from("users").update({ north_tone: "direct" }).eq("id", user.id);

    const { data: dream } = await supabase.from("dreams").insert({
      user_id: user.id,
      title: dreamText,
      status: "active",
      maturity_stage: 3,
      activated_at: new Date().toISOString(),
    }).select().single();

    if (!dream) { setThinking(false); return; }
    setDreamId(dream.id);

    await supabase.from("dream_memories").insert({
      dream_id: dream.id,
      user_id: user.id,
      dream_profile: {
        dream_declared: dreamText,
        dream_real: dreamReflection,
        deadline_declared: allAnswers.deadline || null,
        obstacle_declared: allAnswers.main_obstacle || null,
        success_metric: allAnswers.success_metric || null,
        recurring_words: [],
        previous_attempts: [],
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
        preferred_tone: "direct", reacts_badly_to: [],
        reacts_well_to: [], crisis_moments: [],
        abandonment_triggers: [allAnswers.main_obstacle || ""],
        resistance_language: [],
      },
      conversation_summaries: [],
    });

    const res = await fetch("/api/north/extract-objectives", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        dreamId: dream.id,
        dreamTitle: dreamText,
        dreamReflection,
        deadline: allAnswers.deadline,
        dailyTime: allAnswers.daily_time,
        bestTime: allAnswers.best_time,
        currentLevel: allAnswers.current_level,
        mainObstacle: allAnswers.main_obstacle,
        constraints: allAnswers.constraints,
        successMetric: allAnswers.success_metric,
      }),
    });

    setThinking(false);

    if (res.ok) {
      const { objectives: objs } = await res.json();
      setObjectives(objs || []);
      await addNorth(
        `Identifiquei ${objs?.length || 0} objectivos macro para o teu sonho.\n\nCada um tem tarefas específicas de 30 minutos já pensadas.\n\nVerifica se os pilares fazem sentido para ti.`,
        400
      );
      setStep("review-objectives");
    } else {
      await addNorth("Algo correu mal. Vamos avançar.", 400);
      setStep("tone");
    }
  }

  async function handleObjectivesConfirm() {
    setMessages(prev => [...prev, { role: "user", content: "Sim, faz sentido." }]);
    await addNorth(
      "Perfeito.\n\nÚltima coisa — como queres que eu fale contigo quando as coisas ficarem difíceis?",
      800
    );
    setStep("tone");
  }

  async function handleToneSelect(t: string) {
    setTone(t);
    const labels: Record<string, string> = {
      direct: "Direto.", gentle: "Gentil.", provocative: "Desafiador.",
    };
    setMessages(prev => [...prev, { role: "user", content: labels[t] }]);

    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await supabase.from("users").update({
        north_tone: t,
        onboarding_completed_at: new Date().toISOString(),
      }).eq("id", user.id);
    }

    // Gerar blocos para todos os objectivos em background
    if (dreamId && objectives.length > 0) {
      generateAllBlocks(objectives, answers).catch(console.error);
    }

    setStep("complete");
    await addNorth(
      "O teu plano completo está pronto.\n\nObjectivos definidos. Tarefas específicas geradas. Calendar pronto para receber.\n\nVai a Objectivos para ver tudo.",
      700
    );
    setTimeout(() => router.push(`/objectives?dreamId=${dreamId}`), 3000);
  }

  async function generateAllBlocks(objs: any[], allAnswers: Record<string, string>) {
    for (const obj of objs) {
      await fetch(`/api/objectives/${obj.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dailyTime: allAnswers.daily_time,
          bestTime: allAnswers.best_time,
          deadline: allAnswers.deadline,
          currentLevel: allAnswers.current_level,
          constraints: allAnswers.constraints,
        }),
      });
    }
  }

  const currentQ = DEEP_QUESTIONS[qIdx];
  const showInput = step === "dream" || step === "deep-questions";
  const isDeepQ = step === "deep-questions";

  return (
    <div style={{ minHeight: "100vh", background: T.bg, color: T.light, fontFamily: "Inter, sans-serif", display: "flex", flexDirection: "column" }}>
      <div style={{ flex: 1, padding: "40px 24px 0", maxWidth: "600px", margin: "0 auto", width: "100%", boxSizing: "border-box" }}>

        <p style={{ fontFamily: "'Playfair Display', serif", fontSize: "16px", fontWeight: 700, letterSpacing: "0.06em", marginBottom: "40px", textAlign: "center" }}>DP.</p>

        {/* Progress bar de perguntas */}
        {isDeepQ && (
          <div style={{ marginBottom: "28px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
              <span style={{ fontSize: "11px", color: T.silver, textTransform: "uppercase", letterSpacing: "0.08em" }}>
                Pergunta {qIdx + 1} de {DEEP_QUESTIONS.length}
              </span>
            </div>
            <div style={{ height: "2px", background: T.border, borderRadius: "999px" }}>
              <div style={{ height: "100%", width: `${((qIdx + 1) / DEEP_QUESTIONS.length) * 100}%`, background: T.blue, borderRadius: "999px", transition: "width 400ms ease" }} />
            </div>
          </div>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {messages.map((m, i) => (
            <div key={i} style={{
              maxWidth: m.role === "user" ? "80%" : "100%",
              alignSelf: m.role === "user" ? "flex-end" : "flex-start",
              padding: "12px 18px",
              borderRadius: "12px",
              background: m.role === "user" ? T.surface : T.card,
              border: `1px solid ${T.border}`,
              borderLeft: m.role === "north" ? `2px solid ${T.silver}` : undefined,
            }}>
              <p style={{ margin: 0, fontSize: "14px", lineHeight: 1.85, fontWeight: 300, fontStyle: m.role === "north" ? "italic" : "normal", whiteSpace: "pre-wrap" }}>
                {m.content}
              </p>
            </div>
          ))}

          {thinking && (
            <div style={{ padding: "12px 18px", background: T.card, borderRadius: "12px", border: `1px solid ${T.border}`, borderLeft: `2px solid ${T.silver}`, alignSelf: "flex-start" }}>
              <p style={{ margin: 0, fontSize: "13px", color: T.silver, fontStyle: "italic" }}>North está a pensar...</p>
            </div>
          )}

          {/* Revisão de objectivos */}
          {step === "review-objectives" && objectives.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {objectives.map((obj, i) => (
                <div key={obj.id || i} style={{
                  padding: "16px 20px", background: T.surface,
                  border: `1px solid ${T.blue}33`, borderLeft: `3px solid ${T.blue}`,
                  borderRadius: "10px",
                }}>
                  <div style={{ display: "flex", gap: "12px" }}>
                    <span style={{ fontSize: "11px", color: T.blue, fontWeight: 600, fontFamily: "monospace", paddingTop: "2px", minWidth: "24px" }}>
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <div>
                      <p style={{ margin: "0 0 4px", fontSize: "14px", fontWeight: 600 }}>{obj.title}</p>
                      {obj.description && <p style={{ margin: "0 0 3px", fontSize: "12px", color: T.light, lineHeight: 1.5 }}>{obj.description}</p>}
                      {obj.why && <p style={{ margin: 0, fontSize: "11px", color: T.silver, fontStyle: "italic" }}>→ {obj.why}</p>}
                    </div>
                  </div>
                </div>
              ))}
              <div style={{ display: "flex", gap: "8px", marginTop: "8px" }}>
                <button onClick={handleObjectivesConfirm} style={{ flex: 2, padding: "12px", background: T.blue, border: "none", borderRadius: "8px", color: T.light, fontSize: "13px", fontWeight: 500, cursor: "pointer", fontFamily: "Inter, sans-serif" }}>
                  Perfeito, avançar →
                </button>
                <button onClick={() => { setObjectives([]); setStep("dream"); setMessages([]); }} style={{ flex: 1, padding: "12px 14px", background: "transparent", border: `1px solid ${T.border}`, borderRadius: "8px", color: T.silver, fontSize: "13px", cursor: "pointer", fontFamily: "Inter, sans-serif" }}>
                  Recomeçar
                </button>
              </div>
            </div>
          )}

          {step === "reflection" && (
            <div style={{ display: "flex", gap: "8px" }}>
              <button onClick={handleReflectionYes} style={{ flex: 1, padding: "12px", background: T.card, border: `1px solid ${T.blue}44`, borderRadius: "8px", color: T.light, fontSize: "13px", cursor: "pointer", fontFamily: "Inter, sans-serif" }}>
                Sim, é isso
              </button>
              <button onClick={handleReflectionNo} style={{ flex: 1, padding: "12px", background: "transparent", border: `1px solid ${T.border}`, borderRadius: "8px", color: T.silver, fontSize: "13px", cursor: "pointer", fontFamily: "Inter, sans-serif" }}>
                Não exatamente
              </button>
            </div>
          )}

          {step === "tone" && !tone && (
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {[
                { key: "direct", label: "Direto", desc: "Objetivo, sem rodeios" },
                { key: "gentle", label: "Gentil", desc: "Acolhedor e paciente" },
                { key: "provocative", label: "Desafiador", desc: "Questiona mais, aceita menos desculpas" },
              ].map(t => (
                <button key={t.key} onClick={() => handleToneSelect(t.key)} style={{ padding: "14px 18px", background: T.surface, border: `1px solid ${T.border}`, borderRadius: "8px", color: T.light, fontSize: "13px", cursor: "pointer", fontFamily: "Inter, sans-serif", textAlign: "left", display: "flex", justifyContent: "space-between" }}>
                  <span style={{ fontWeight: 600 }}>{t.label}</span>
                  <span style={{ color: T.silver, fontSize: "12px" }}>{t.desc}</span>
                </button>
              ))}
            </div>
          )}

          <div ref={bottomRef} />
        </div>
      </div>

      {showInput && (
        <div style={{ padding: "20px 24px 36px", maxWidth: "600px", margin: "0 auto", width: "100%", boxSizing: "border-box" }}>
          <div style={{ display: "flex", gap: "8px" }}>
            <textarea
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  step === "dream" ? handleDreamSubmit() : handleAnswerSubmit();
                }
              }}
              placeholder={step === "dream" ? "Qual é o sonho que não paras de adiar?" : currentQ?.placeholder || ""}
              rows={2}
              disabled={loading || thinking}
              autoFocus
              style={{ flex: 1, background: T.card, border: `1px solid ${T.border}`, borderRadius: "10px", padding: "12px 16px", color: T.light, fontSize: "14px", fontFamily: "Inter, sans-serif", resize: "none", outline: "none", lineHeight: 1.5, opacity: loading || thinking ? 0.6 : 1 }}
            />
            <button
              onClick={step === "dream" ? handleDreamSubmit : handleAnswerSubmit}
              disabled={!input.trim() || loading || thinking}
              style={{ padding: "12px 18px", background: input.trim() && !loading ? T.blue : T.border, border: "none", borderRadius: "10px", color: T.light, fontSize: "13px", fontWeight: 500, cursor: "pointer", fontFamily: "Inter, sans-serif" }}>
              →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
