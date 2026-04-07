"use client";

import { useState, useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";

type Step = "dream" | "email" | "sent";

export default function HomePage() {
  const [step, setStep] = useState<Step>("dream");
  const [dream, setDream] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);

  // Registrar service worker
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(console.error);
    }
  }, []);

  // Foco automático
  useEffect(() => {
    if (step === "dream") textareaRef.current?.focus();
    if (step === "email") emailRef.current?.focus();
  }, [step]);

  const handleDreamSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (dream.trim().length < 5) return;
    setStep("email");
  };

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || loading) return;

    setLoading(true);
    setError(null);

    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback?next=/onboarding`,
          data: {
            dream_text: dream.trim(),
            locale: navigator.language || "en",
          },
        },
      });

      if (error) throw error;
      setStep("sent");
    } catch (err: any) {
      setError(err.message || "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-deep-night flex flex-col items-center justify-center px-6 py-12">
      {/* Logo */}
      <div className="mb-16 text-center">
        <h1 className="font-display text-north-light leading-none tracking-widest">
          <span className="block text-2xl font-normal">DONT DREAM.</span>
          <span className="block text-2xl font-bold">PLAN.</span>
        </h1>
      </div>

      {/* Step: Dream Input */}
      {step === "dream" && (
        <div className="w-full max-w-lg animate-slide-up">
          <form onSubmit={handleDreamSubmit}>
            <label className="block mb-4">
              <span className="sr-only">What is the dream you keep putting off?</span>
              <textarea
                ref={textareaRef}
                value={dream}
                onChange={(e) => setDream(e.target.value)}
                placeholder="What is the dream you keep putting off?"
                rows={4}
                className="
                  w-full bg-stellar-gray border border-border rounded-lg
                  px-5 py-4 text-base text-north-light
                  placeholder:text-muted-silver placeholder:font-light
                  focus:outline-none focus:border-north-blue
                  resize-none transition-all duration-280
                  font-light leading-relaxed
                "
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey && dream.trim().length >= 5) {
                    e.preventDefault();
                    handleDreamSubmit(e);
                  }
                }}
              />
            </label>

            {dream.trim().length >= 5 && (
              <button
                type="submit"
                className="
                  w-full bg-north-blue hover:bg-north-blue-dim
                  text-north-light font-medium
                  py-3 px-6 rounded-lg
                  transition-all duration-280
                  animate-fade-in
                "
              >
                Continue
              </button>
            )}
          </form>

          <p className="mt-6 text-center text-muted-silver text-xs tracking-wide">
            Your dream stays private.
          </p>
        </div>
      )}

      {/* Step: Email Input */}
      {step === "email" && (
        <div className="w-full max-w-lg animate-slide-up">
          {/* Eco do sonho */}
          <div className="mb-8 p-5 bg-surface border border-border-subtle rounded-lg">
            <p className="text-muted-silver text-xs tracking-widest uppercase mb-2">Your dream</p>
            <p className="text-north-light font-light leading-relaxed italic">
              {dream}
            </p>
          </div>

          <form onSubmit={handleEmailSubmit}>
            <label className="block mb-4">
              <span className="block text-muted-silver text-sm mb-2">
                Where should we send your access link?
              </span>
              <input
                ref={emailRef}
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your@email.com"
                className="
                  w-full bg-stellar-gray border border-border rounded-lg
                  px-5 py-3 text-base text-north-light
                  placeholder:text-muted-silver
                  focus:outline-none focus:border-north-blue
                  transition-all duration-280
                "
                required
              />
            </label>

            {error && (
              <p className="mb-4 text-pause-amber text-sm">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading || !email.trim()}
              className="
                w-full bg-north-blue hover:bg-north-blue-dim
                disabled:opacity-50 disabled:cursor-not-allowed
                text-north-light font-medium
                py-3 px-6 rounded-lg
                transition-all duration-280
                flex items-center justify-center gap-2
              "
            >
              {loading ? (
                <>
                  <span className="north-thinking-dots">
                    <span className="north-dot inline-block w-1 h-1 bg-current rounded-full mx-0.5" />
                    <span className="north-dot inline-block w-1 h-1 bg-current rounded-full mx-0.5" />
                    <span className="north-dot inline-block w-1 h-1 bg-current rounded-full mx-0.5" />
                  </span>
                </>
              ) : (
                "Send link"
              )}
            </button>

            <button
              type="button"
              onClick={() => setStep("dream")}
              className="
                w-full mt-3 text-muted-silver text-sm
                py-2 hover:text-north-light
                transition-all duration-280
              "
            >
              ← Go back
            </button>
          </form>
        </div>
      )}

      {/* Step: Sent */}
      {step === "sent" && (
        <div className="w-full max-w-lg text-center animate-slide-up">
          <div className="mb-8">
            <div className="w-12 h-0.5 bg-execute-green mx-auto mb-8 block-complete-line" />
            <h2 className="font-display text-north-light text-2xl font-normal tracking-wide mb-4">
              Check your email.
            </h2>
            <p className="text-muted-silver font-light leading-relaxed">
              We sent a link to <span className="text-north-light">{email}</span>.
            </p>
            <p className="text-muted-silver font-light mt-2">
              Click it and North will be waiting.
            </p>
          </div>

          <p className="text-muted-silver text-xs">
            No email?{" "}
            <button
              onClick={() => setStep("email")}
              className="text-north-blue hover:underline"
            >
              Try again
            </button>
          </p>
        </div>
      )}
    </main>
  );
}
