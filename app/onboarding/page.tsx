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

type Step = "intro" | "dream" | "reflection" | "questions" | "building-objectives"
          | "review-objectives" | "tone" | "complete";

export default function OnboardingPage() {
  const router = useRouter();
  const supabase = createClient();
  const bottomRef = useRef<HTMLDivElement>(null);

  const [step, setStep] = useState<Step>("intro");
  const [messages, setMessages] = useState<any[]>([]);
  const [thinking, setThinking] = useState(false);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  // Dados recolhidos
  const [dreamText, setDreamText] = useState("");
  const [dreamReflection, setDreamReflection] = useState("");
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [qIdx, setQIdx] = useState(0);
  const [tone, setTone] = useState<string | null>(null);
  const [objectives, setObjectives] = useState<any[]>([]);
  const [dreamId, setDreamId] = useState<string | null>(null);

  const questions = [
    { id: "deadline", text: "Se este sonho se tornasse real, quando gostarias que isso acontecesse?" },
    { id: "time", text: "Quanto tempo por dia consegues dedicar a isto de forma honesta?" },
    { id: "obstacle", text: "O que te impediu de começar até agora?" },
  ];

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
    addNorth("Olá. Eu sou North.\n\nVou ajudar-te a transformar o teu sonho em algo real e executável.\n\nNão tenho pressa. Começa.", 800)
      .then(() => setTimeout(() => setStep("dream"), 500));
  }, []);

  // Submissão do sonho
  async function handleDreamSubmit() {
    if (!input.trim() || loading) return;
    const dream = input.trim();
    setDreamText(dream);
    setInput("");
    setMessages(prev => [...prev, { role: "user", content: dream }]);
    setLoading(true);

    // Reflexo de North via API
    const res = await fetch("/api/north/reflect", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dream }),
    });
    const data = res.ok ? await res.json() : {};
    const reflection = data.reflection || "Queres construir algo que seja verdadeiramente teu.";
    setDreamReflection(reflection);
    setLoading(false);

    await addNorth(`${reflection}\n\nIsso está certo?`, 1600);
    setStep("reflection");
  }

  // Reflexo confirmado
  async function handleReflectionYes() {
    setMessages(prev => [...prev, { role: "user", content: "Sim, é isso." }]);
    await addNorth(questions[0].text, 800);
    setStep("questions");
    setQIdx(0);
  }

  async function handleReflectionNo() {
    setMessages(prev => [...prev, { role: "user", content: "Não exatamente." }]);
    await addNorth("Conta-me mais. Qual é a parte mais importante que não captei?", 800);
    setStep("dream");
  }

  // Perguntas
  async function handleAnswerSubmit() {
    if (!input.trim()) return;
    const answer = input.trim();
    setInput("");
    const q = questions[qIdx];
    setAnswers(prev => ({ ...prev, [q.id]: answer }));
    setMessages(prev => [...prev, { role: "user", content: answer }]);

    const next = qIdx + 1;
    if (next < questions.length) {
      await addNorth(questions[next].text, 900);
      setQIdx(next);
    } else {
      // Todas as respostas dadas — criar sonho e extrair objectivos
      setStep("building-objectives");
      await buildObjectives({ ...answers, [q.id]: answer });
    }
  }

  // Criar sonho + extrair objectivos
  async function buildObjectives(allAnswers: Record<string, string>) {
    await addNorth("Estou a analisar o teu sonho e a identificar os pilares para o tornar real.\n\nIsto demora alguns segundos.", 600);
    setThinking(true);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push("/"); return; }

    // Actualizar perfil
    await supabase.from("users").update({ north_tone: "direct" }).eq("id", user.id);

    // Criar sonho
    const { data: dream } = await supabase.from("dreams").insert({
      user_id: user.id,
      title: dreamText,
      status: "active",
      maturity_stage: 3,
      activated_at: new Date().toISOString(),
    }).select().single();

    if (!dream) { setThinking(false); return; }
    setDreamId(dream.id);

    // Criar memória
    await supabase.from("dream_memories").insert({
      dream_id: dream.id,
      user_id: user.id,
      dream_profile: {
        dream_declared: dreamText,
        dream_real: dreamReflection,
        deadline_declared: allAnswers.deadline || null,
        obstacle_declared: allAnswers.obstacle || null,
        recurring_words: [],
        previous_attempts: [],
        last_updated: new Date().toISOString(),
      },
      execution_profile: {
        declared_times: [allAnswers.time || "30 minutos"],
        real_times: [], strong_days: [], weak_days: [],
        avg_real_duration: 30, current_streak: 0, best_streak: 0,
      },
      emotional_profile: {
        preferred_tone: "direct", reacts_badly_to: [], reacts_well_to: [],
        crisis_moments: [], abandonment_triggers: [], resistance_language: [],
      },
      conversation_summaries: [],
    });

    // Extrair objectivos macro
    const res = await fetch("/api/north/extract-objectives", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        dreamId: dream.id,
        dreamTitle: dreamText,
        dreamReflection,
        deadline: allAnswers.deadline,
        timeAvailable: allAnswers.time,
        obstacle: allAnswers.obstacle,
      }),
    });

    setThinking(false);

    if (res.ok) {
      const { objectives: objs } = await res.json();
      setObjectives(objs || []);
      await addNorth(`Identifiquei ${objs?.length || 0} objectivos macro para o teu sonho.\n\nVerifica se fazem sentido para ti.`, 400);
      setStep("review-objectives");
    } else {
      await addNorth("Algo correu mal ao gerar os objectivos. Vamos avançar com o plano base.", 400);
      setStep("tone");
    }
  }

  // Confirmar objectivos
  async function handleObjectivesConfirm() {
    setMessages(prev => [...prev, { role: "user", content: "Sim, faz sentido." }]);
    await addNorth("Perfeito. Última coisa — como queres que eu fale contigo quando as coisas ficarem difíceis?", 800);
    setStep("tone");
  }

  // Escolha de tom
  async function handleToneSelect(t: string) {
    setTone(t);
    const labels: Record<string, string> = { direct: "Direto.", gentle: "Gentil.", provocative: "Desafiador." };
    setMessages(prev => [...prev, { role: "user", content: labels[t] }]);

    const { data: { user } } = await supabase.auth.getUser();
    if (user) await supabase.from("users").update({
      north_tone: t,
      onboarding_completed_at: new Date().toISOString(),
    }).eq("id", user.id);

    // Gerar acções tácticas para cada objectivo em background
    if (dreamId && objectives.length > 0) {
      generateAllBlocks(dreamId, objectives).catch(console.error);
    }

    // Fallback: gerar plano base se não há objectivos
    if (!objectives.length && dreamId) {
      fetch("/api/plan/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dreamId, conversationSummary: `${dreamText}. ${dreamReflection}`, timeAvailable: answers.time }),
      }).catch(console.error);
    }

    setStep("complete");
    await addNorth("O teu plano está pronto.\n\nOs teus primeiros blocos estão agendados para esta semana.\n\nSó aparecer.", 600);
    setTimeout(() => router.push("/dashboard"), 3000);
  }

  async function generateAllBlocks(dId: string, objs: any[]) {
    for (const obj of objs) {
      await fetch(`/api/objectives/${obj.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ weeks: 8, blocksPerWeek: 3, timePreference: "morning" }),
      });
    }
  }

  const currentQ = questions[qIdx];
  const showInput = step === "dream" || step === "questions";

  return (
    <div style={{ minHeight: "100vh", background: T.bg, color: T.light, fontFamily: "Inter, sans-serif", display: "flex", flexDirection: "column" }}>
      <div style={{ flex: 1, padding: "40px 24px 0", maxWidth: "580px", margin: "0 auto", width: "100%" }}>

        {/* Logo */}
        <p style={{ fontFamily: "'Playfair Display', serif", fontSize: "16px", fontWeight: 700, letterSpacing: "0.06em", marginBottom: "40px", textAlign: "center" }}>DP.</p>

        {/* Mensagens */}
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {messages.map((m, i) => (
            <div key={i} style={{
              maxWidth: m.role === "user" ? "80%" : "100%",
              alignSelf: m.role === "user" ? "flex-end" : "flex-start",
              padding: "12px 16px",
              borderRadius: "12px",
              background: m.role === "user" ? T.surface : T.card,
              border: `1px solid ${T.border}`,
              borderLeft: m.role === "north" ? `2px solid ${T.silver}` : undefined,
            }}>
              <p style={{ margin: 0, fontSize: "14px", lineHeight: 1.8, fontWeight: 300, fontStyle: m.role === "north" ? "italic" : "normal", whiteSpace: "pre-wrap" }}>
                {m.content}
              </p>
            </div>
          ))}

          {thinking && (
            <div style={{ padding: "12px 16px", background: T.card, borderRadius: "12px", border: `1px solid ${T.border}`, borderLeft: `2px solid ${T.silver}`, alignSelf: "flex-start" }}>
              <p style={{ margin: 0, fontSize: "13px", color: T.silver, fontStyle: "italic" }}>North está a pensar...</p>
            </div>
          )}

          {/* Review de objectivos */}
          {step === "review-objectives" && objectives.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {objectives.map((obj, i) => (
                <div key={obj.id || i} style={{
                  padding: "14px 18px",
                  background: T.surface,
                  border: `1px solid ${T.blue}33`,
                  borderLeft: `3px solid ${T.blue}`,
                  borderRadius: "10px",
                }}>
                  <div style={{ display: "flex", gap: "10px", alignItems: "flex-start" }}>
                    <span style={{ fontSize: "11px", color: T.blue, fontWeight: 600, minWidth: "18px", paddingTop: "2px" }}>
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <div>
                      <p style={{ margin: "0 0 4px", fontSize: "14px", fontWeight: 500 }}>{obj.title}</p>
                      {obj.description && <p style={{ margin: 0, fontSize: "12px", color: T.silver, lineHeight: 1.5 }}>{obj.description}</p>}
                    </div>
                  </div>
                </div>
              ))}
              <div style={{ display: "flex", gap: "8px", marginTop: "8px" }}>
                <button onClick={handleObjectivesConfirm} style={{ flex: 1, padding: "12px", background: T.blue, border: "none", borderRadius: "8px", color: T.light, fontSize: "13px", fontWeight: 500, cursor: "pointer", fontFamily: "Inter, sans-serif" }}>
                  Sim, faz sentido →
                </button>
                <button onClick={() => { setStep("dream"); setMessages(prev => [...prev.slice(0, -3)]); }} style={{ padding: "12px 16px", background: "transparent", border: `1px solid ${T.border}`, borderRadius: "8px", color: T.silver, fontSize: "13px", cursor: "pointer", fontFamily: "Inter, sans-serif" }}>
                  Ajustar
                </button>
              </div>
            </div>
          )}

          {/* Reflexo — sim/não */}
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

          {/* Tom */}
          {step === "tone" && !tone && (
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {[
                { key: "direct", label: "Direto", desc: "Objetivo e sem rodeios" },
                { key: "gentle", label: "Gentil", desc: "Acolhedor e paciente" },
                { key: "provocative", label: "Desafiador", desc: "Questiona mais, aceita menos respostas superficiais" },
              ].map(t => (
                <button key={t.key} onClick={() => handleToneSelect(t.key)}
                  style={{ padding: "12px 16px", background: T.surface, border: `1px solid ${T.border}`, borderRadius: "8px", color: T.light, fontSize: "13px", cursor: "pointer", fontFamily: "Inter, sans-serif", textAlign: "left", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontWeight: 500 }}>{t.label}</span>
                  <span style={{ fontSize: "12px", color: T.silver }}>{t.desc}</span>
                </button>
              ))}
            </div>
          )}

          <div ref={bottomRef} />
        </div>
      </div>

      {/* Input */}
      {showInput && (
        <div style={{ padding: "20px 24px 32px", maxWidth: "580px", margin: "0 auto", width: "100%", boxSizing: "border-box" }}>
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
              placeholder={step === "dream" ? "Qual é o sonho que não paras de adiar?" : currentQ?.text || ""}
              rows={2}
              disabled={loading || thinking}
              autoFocus
              style={{
                flex: 1, background: T.card, border: `1px solid ${T.border}`,
                borderRadius: "10px", padding: "12px 16px", color: T.light,
                fontSize: "14px", fontFamily: "Inter, sans-serif", resize: "none", outline: "none",
                lineHeight: 1.5, opacity: loading || thinking ? 0.6 : 1,
              }}
            />
            <button
              onClick={step === "dream" ? handleDreamSubmit : handleAnswerSubmit}
              disabled={!input.trim() || loading || thinking}
              style={{
                padding: "12px 18px", background: input.trim() && !loading ? T.blue : T.border,
                border: "none", borderRadius: "10px", color: T.light, fontSize: "13px",
                fontWeight: 500, cursor: "pointer", fontFamily: "Inter, sans-serif",
              }}>→</button>
          </div>
        </div>
      )}
    </div>
  );
}
