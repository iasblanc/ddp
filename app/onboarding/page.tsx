// @ts-nocheck
"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import { NorthMessage, NorthThinking } from "@/components/ui/NorthMessage";
import { cn, delay } from "@/lib/utils";
import type { NorthTone } from "@/types/database";

// ── TIPOS ─────────────────────────────────────────────────────
type OnboardingStep =
  | "north-intro"
  | "dream-input"
  | "dream-reflection"
  | "questions"
  | "plan-building"
  | "plan-reveal"
  | "tone-choice"
  | "calendar-connect"
  | "complete";

interface Question {
  id: string;
  north: string;
  placeholder: string;
}

const QUESTIONS: Question[] = [
  {
    id: "deadline",
    north: "If this dream became real, when would you want that to happen?",
    placeholder: "In 6 months, by end of year, in 2 years...",
  },
  {
    id: "time",
    north: "How much time per day can you honestly dedicate to this?",
    placeholder: "30 minutes, 1 hour...",
  },
  {
    id: "obstacle",
    north: "What has stopped you from starting until now?",
    placeholder: "Be honest with yourself.",
  },
];

// ── COMPONENTE DE USUÁRIO ─────────────────────────────────────
function UserBubble({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex justify-end animate-slide-up">
      <div className="max-w-[80%] px-4 py-3 bg-deep-night border border-border-subtle rounded-lg">
        <p className="text-base text-north-light leading-relaxed">{children}</p>
      </div>
    </div>
  );
}

// ── ONBOARDING PRINCIPAL ──────────────────────────────────────
export default function OnboardingPage() {
  const router = useRouter();
  const supabase = createClient();
  const bottomRef = useRef<HTMLDivElement>(null);

  const [step, setStep] = useState<OnboardingStep>("north-intro");
  const [northThinking, setNorthThinking] = useState(false);
  const [dreamText, setDreamText] = useState("");
  const [dreamReflection, setDreamReflection] = useState("");
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [currentQuestionIdx, setCurrentQuestionIdx] = useState(0);
  const [currentInput, setCurrentInput] = useState("");
  const [selectedTone, setSelectedTone] = useState<NorthTone | null>(null);
  const [loading, setLoading] = useState(false);

  // Histórico de mensagens renderizadas
  const [messages, setMessages] = useState<Array<{
    id: string;
    type: "north" | "user" | "action";
    voice?: "ouve" | "pensa" | "provoca";
    content?: React.ReactNode;
  }>>([]);

  const scrollToBottom = useCallback(() => {
    setTimeout(() => {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 100);
  }, []);

  const addMessage = useCallback((msg: typeof messages[0]) => {
    setMessages(prev => [...prev, { ...msg, id: crypto.randomUUID() }]);
    scrollToBottom();
  }, [scrollToBottom]);

  const northSpeak = useCallback(async (content: React.ReactNode, voice: "ouve" | "pensa" | "provoca" = "ouve", thinkMs = 1200) => {
    setNorthThinking(true);
    scrollToBottom();
    await delay(thinkMs);
    setNorthThinking(false);
    addMessage({ id: "", type: "north", voice, content });
  }, [addMessage, scrollToBottom]);

  // ── STEP: intro ──────────────────────────────────────────────
  useEffect(() => {
    if (step === "north-intro") {
      northSpeak(
        <>
          Hello. I am North.<br />
          I will help you transform this into something real.<br /><br />
          I am not in a hurry.<br />
          You can begin.
        </>,
        "ouve",
        800
      ).then(() => {
        delay(600).then(() => setStep("dream-input"));
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── STEP: dream input ────────────────────────────────────────
  const handleDreamSubmit = async () => {
    if (!dreamText.trim() || loading) return;
    setLoading(true);

    addMessage({ id: "", type: "user", content: dreamText });

    // North gera reflexo via API
    const reflection = await generateReflection(dreamText);
    setDreamReflection(reflection);

    await northSpeak(
      <>{reflection}<br /><br />Is that right?</>,
      "ouve",
      1800
    );

    setStep("dream-reflection");
    setLoading(false);
  };

  // ── STEP: dream reflection ────────────────────────────────────
  const handleReflectionYes = async () => {
    addMessage({ id: "", type: "user", content: "Yes, that's it." });
    await delay(400);
    setStep("questions");
    await askNextQuestion(0);
  };

  const handleReflectionNo = async () => {
    addMessage({ id: "", type: "user", content: "Not exactly." });
    await northSpeak(
      "Tell me more. What is the most important part I missed?",
      "ouve",
      1000
    );
    setCurrentInput("");
    setStep("dream-input");
  };

  // ── STEP: questions ───────────────────────────────────────────
  const askNextQuestion = async (idx: number) => {
    if (idx >= QUESTIONS.length) {
      setStep("plan-building");
      await buildPlan();
      return;
    }
    setCurrentQuestionIdx(idx);
    await northSpeak(QUESTIONS[idx].north, "pensa", 1000);
  };

  const handleAnswerSubmit = async () => {
    if (!currentInput.trim()) return;

    const question = QUESTIONS[currentQuestionIdx];
    const newAnswers = { ...answers, [question.id]: currentInput };
    setAnswers(newAnswers);

    addMessage({ id: "", type: "user", content: currentInput });
    setCurrentInput("");

    await delay(400);
    await askNextQuestion(currentQuestionIdx + 1);
  };

  // ── STEP: plan building ───────────────────────────────────────
  const buildPlan = async () => {
    setNorthThinking(true);
    scrollToBottom();

    await northSpeak(
      "Building your plan...",
      "pensa",
      400
    );

    // Pausa dramática de 3-4 segundos
    await delay(3200);
    setNorthThinking(false);
    setStep("plan-reveal");
    await revealPlan();
  };

  const revealPlan = async () => {
    const deadline = answers.deadline || "90 days";
    const time = answers.time || "30 minutes";

    await northSpeak(
      <>
        Your plan has three phases.<br /><br />
        In the first — the next 3 weeks — you will take the first concrete step.<br />
        Not because it is the most important.<br />
        Because it will prove to yourself that this is real.<br /><br />
        Your first block is tomorrow.<br />
        <span className="text-muted-silver text-sm">30 minutes. Just show up.</span>
      </>,
      "pensa",
      600
    );

    await delay(800);
    setStep("tone-choice");
    await northSpeak(
      "One last thing. How do you want me to talk to you when things get hard?",
      "ouve",
      1200
    );
  };

  // ── STEP: tone choice ─────────────────────────────────────────
  const handleToneSelect = async (tone: NorthTone) => {
    setSelectedTone(tone);
    const toneLabels: Record<NorthTone, string> = {
      direct: "Direct.",
      gentle: "Gentle.",
      provocative: "Challenging.",
    };
    addMessage({ id: "", type: "user", content: toneLabels[tone] });
    await delay(400);
    setStep("calendar-connect");
    await northSpeak(
      "Perfect. Now let's connect your calendar so your first block is in your real schedule.",
      "pensa",
      1000
    );
  };

  // ── STEP: calendar connect ────────────────────────────────────
  const handleCalendarConnect = async () => {
    setLoading(true);
    // TODO: Fase 4 — integração Google Calendar
    // Por agora, simular e avançar
    await delay(1500);
    await completeOnboarding();
  };

  const handleSkipCalendar = async () => {
    await completeOnboarding();
  };

  // ── COMPLETE ONBOARDING ───────────────────────────────────────
  const completeOnboarding = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Atualizar perfil do usuário
      await supabase.from("users").update({
        north_tone: selectedTone || "direct",
        onboarding_completed_at: new Date().toISOString(),
      }).eq("id", user.id);

      // Criar sonho inicial
      const { data: dream } = await supabase.from("dreams").insert({
        user_id: user.id,
        title: dreamText,
        status: "active",
        maturity_stage: 3,
        activated_at: new Date().toISOString(),
      }).select().single();

      // Criar memória inicial de North
      if (dream) {
        await supabase.from("dream_memories").insert({
          dream_id: dream.id,
          user_id: user.id,
          dream_profile: {
            dream_declared: dreamText,
            dream_real: dreamReflection,
            deadline_declared: answers.deadline || null,
            obstacle_declared: answers.obstacle || null,
            recurring_words: [],
            previous_attempts: [],
            last_updated: new Date().toISOString(),
          },
          execution_profile: {
            declared_times: [answers.time || "30 minutes"],
            real_times: [],
            strong_days: [],
            weak_days: [],
            avg_real_duration: 30,
            current_streak: 0,
            best_streak: 0,
          },
          emotional_profile: {
            preferred_tone: selectedTone || "direct",
            reacts_badly_to: [],
            reacts_well_to: [],
            crisis_moments: [],
            abandonment_triggers: [],
            resistance_language: [],
          },
          conversation_summaries: [],
        });
      }

      setStep("complete");
      await northSpeak(
        <>
          Your first block is scheduled for tomorrow.<br /><br />
          Until then, you don't need to do anything.<br />
          Just show up.
        </>,
        "ouve",
        600
      );

      await delay(3000);
      router.push("/dashboard");
    } catch (error) {
      console.error("Onboarding error:", error);
      setLoading(false);
    }
  };

  // ── GENERATE REFLECTION (via North API) ──────────────────────
  async function generateReflection(dream: string): Promise<string> {
    try {
      const res = await fetch("/api/north/reflect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dream }),
      });
      if (!res.ok) throw new Error("API failed");
      const data = await res.json();
      return data.reflection;
    } catch {
      // Fallback local
      return `You want to build something that is truly yours — and you stopped believing you would actually do it`;
    }
  }

  // ── RENDER ────────────────────────────────────────────────────
  const currentQuestion = QUESTIONS[currentQuestionIdx];
  const showInput = step === "dream-input" || step === "questions";
  const showReflectionButtons = step === "dream-reflection";
  const showToneButtons = step === "tone-choice" && !selectedTone;
  const showCalendarButtons = step === "calendar-connect";

  return (
    <main className="min-h-screen bg-deep-night flex flex-col">
      {/* Header mínimo */}
      <div className="px-6 py-5 border-b border-border flex items-center justify-between">
        <p className="font-display text-north-light text-base font-bold tracking-widest">DP.</p>
        <p className="text-muted-silver text-2xs tracking-widest uppercase">Finding your North</p>
      </div>

      {/* Thread */}
      <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-8 max-w-2xl mx-auto w-full">
        <div className="space-y-4">

          {/* Mensagens renderizadas */}
          {messages.map(msg => {
            if (msg.type === "north") {
              return (
                <NorthMessage key={msg.id} voice={msg.voice || "ouve"}>
                  {msg.content}
                </NorthMessage>
              );
            }
            if (msg.type === "user") {
              return <UserBubble key={msg.id}>{msg.content}</UserBubble>;
            }
            return null;
          })}

          {/* North pensando */}
          {northThinking && <NorthThinking />}

          {/* Botões de ação contextuais */}
          {showReflectionButtons && !northThinking && (
            <div className="flex gap-3 animate-slide-up">
              <Button variant="secondary" onClick={handleReflectionYes}>Yes, that's it</Button>
              <Button variant="ghost" onClick={handleReflectionNo}>Not exactly</Button>
            </div>
          )}

          {showToneButtons && !northThinking && (
            <div className="flex flex-col sm:flex-row gap-3 animate-slide-up">
              {[
                { tone: "direct" as NorthTone, label: "Direct", desc: "Objective, no detours" },
                { tone: "gentle" as NorthTone, label: "Gentle", desc: "Welcoming and patient" },
                { tone: "provocative" as NorthTone, label: "Challenging", desc: "Pushes harder, accepts less" },
              ].map(opt => (
                <button
                  key={opt.tone}
                  onClick={() => handleToneSelect(opt.tone)}
                  className="flex-1 p-4 text-left bg-stellar-gray hover:bg-surface border border-border hover:border-north-blue/40 rounded-lg transition-all duration-280 group"
                >
                  <p className="text-north-light font-medium text-sm mb-1">{opt.label}</p>
                  <p className="text-muted-silver text-xs">{opt.desc}</p>
                </button>
              ))}
            </div>
          )}

          {showCalendarButtons && !northThinking && (
            <div className="flex flex-col gap-3 animate-slide-up">
              <Button
                variant="primary"
                size="lg"
                loading={loading}
                onClick={handleCalendarConnect}
                className="w-full"
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <rect x="2" y="2" width="12" height="12" rx="2" stroke="currentColor" strokeWidth="1.5" />
                  <path d="M5 1v2M11 1v2M2 6h12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
                Connect Google Calendar
              </Button>
              <button
                onClick={handleSkipCalendar}
                className="text-muted-silver text-sm hover:text-north-light transition-colors py-1"
              >
                Skip for now
              </button>
            </div>
          )}

          <div ref={bottomRef} />
        </div>
      </div>

      {/* Input area */}
      {showInput && !northThinking && (
        <div className="border-t border-border px-4 sm:px-6 py-4 max-w-2xl mx-auto w-full">
          {step === "dream-input" && (
            <div className="space-y-3">
              <textarea
                value={dreamText}
                onChange={e => setDreamText(e.target.value)}
                placeholder="What is the dream you keep putting off?"
                rows={3}
                autoFocus
                className="w-full bg-stellar-gray border border-border focus:border-north-blue rounded-lg px-4 py-3 text-base text-north-light placeholder:text-muted-silver placeholder:font-light resize-none outline-none transition-all duration-280 font-light leading-relaxed"
                onKeyDown={e => {
                  if (e.key === "Enter" && !e.shiftKey && dreamText.trim().length >= 5) {
                    e.preventDefault();
                    handleDreamSubmit();
                  }
                }}
              />
              <Button
                variant="primary"
                size="lg"
                loading={loading}
                onClick={handleDreamSubmit}
                disabled={dreamText.trim().length < 5}
                className="w-full"
              >
                Continue
              </Button>
            </div>
          )}

          {step === "questions" && currentQuestion && (
            <div className="flex gap-3">
              <input
                type="text"
                value={currentInput}
                onChange={e => setCurrentInput(e.target.value)}
                placeholder={currentQuestion.placeholder}
                autoFocus
                className="flex-1 bg-stellar-gray border border-border focus:border-north-blue rounded-lg px-4 py-3 text-base text-north-light placeholder:text-muted-silver outline-none transition-all duration-280"
                onKeyDown={e => {
                  if (e.key === "Enter" && currentInput.trim()) {
                    handleAnswerSubmit();
                  }
                }}
              />
              <Button
                variant="primary"
                onClick={handleAnswerSubmit}
                disabled={!currentInput.trim()}
                className="shrink-0"
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M14 8L2 8M14 8L9 3M14 8L9 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </Button>
            </div>
          )}
        </div>
      )}
    </main>
  );
}
