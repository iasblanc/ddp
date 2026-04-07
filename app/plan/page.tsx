// @ts-nocheck
"use client";
import { useAuthGuard } from "@/lib/auth-guard";
import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";

const T = {
  bg: "#0D0D14", surface: "#141420", card: "#1A1A2E", light: "#E8E4DC",
  silver: "#6B6B80", blue: "#4A6FA5", green: "#2D6A4F", amber: "#C9853A",
  border: "#252538",
};

function PlanContent() {
  const router = useRouter();
  useAuthGuard();
  const searchParams = useSearchParams();
  const dreamId = searchParams.get("dreamId");
  const [planData, setPlanData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [calendar, setCalendar] = useState<any>(null);

  useEffect(() => {
    if (dreamId) loadPlan();
    else loadActiveDream();
    checkCalendar();
  }, [dreamId]);

  async function loadActiveDream() {
    const res = await fetch("/api/dreams");
    if (res.ok) {
      const { dreams } = await res.json();
      const active = dreams?.find((d: any) => d.status === "active");
      if (active) router.replace(`/plan?dreamId=${active.id}`);
      else setLoading(false);
    }
  }

  async function loadPlan() {
    setLoading(true);
    const res = await fetch(`/api/plan/${dreamId}`);
    if (res.ok) setPlanData(await res.json());
    setLoading(false);
  }

  async function checkCalendar() {
    const res = await fetch("/api/calendar/sync");
    if (res.ok) setCalendar(await res.json());
  }

  async function skipBlock(blockId: string) {
    await fetch(`/api/blocks/${blockId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "skipped" }),
    });
    await loadPlan();
  }

  const formatDate = (iso: string) => new Date(iso).toLocaleDateString("pt-BR", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

  if (loading) return <div style={{ minHeight: "100vh", background: T.bg, display: "flex", alignItems: "center", justifyContent: "center" }}><p style={{ color: T.silver, fontFamily: "Inter, sans-serif", fontSize: "14px" }}>A carregar...</p></div>;

  if (!planData) return (
    <div style={{ minHeight: "100vh", background: T.bg, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: "16px" }}>
      <p style={{ color: T.light, fontFamily: "'Playfair Display', serif", fontSize: "24px" }}>Nenhum plano activo.</p>
      <button onClick={() => router.push("/dreams")} style={{ padding: "10px 20px", background: T.blue, border: "none", borderRadius: "8px", color: T.light, cursor: "pointer", fontFamily: "Inter, sans-serif" }}>Criar sonho</button>
    </div>
  );

  const { dream, blocks, completed } = planData;
  const plan = dream?.plan_data;
  const total = (blocks?.length || 0) + (completed || 0);
  const progress = total ? Math.round(((completed || 0) / total) * 100) : 0;

  return (
    <div style={{ minHeight: "100vh", background: T.bg, color: T.light, fontFamily: "Inter, sans-serif" }}>
      <div style={{ borderBottom: `1px solid ${T.border}`, padding: "16px 32px", display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, background: `${T.bg}F0`, backdropFilter: "blur(12px)", zIndex: 50 }}>
        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          <button onClick={() => router.push("/dashboard")} style={{ background: "none", border: "none", color: T.silver, cursor: "pointer", fontSize: "13px", fontFamily: "Inter, sans-serif" }}>← Dashboard</button>
          <span style={{ color: T.border }}>|</span>
          <p style={{ fontFamily: "'Playfair Display', serif", fontSize: "16px", margin: 0 }}>{dream?.title}</p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          {calendar?.connected && <span style={{ fontSize: "11px", color: T.green, padding: "3px 10px", background: `${T.green}22`, borderRadius: "999px", border: `1px solid ${T.green}44` }}>📅 Calendar</span>}
          <span style={{ fontSize: "12px", color: T.silver }}>{completed || 0} completos</span>
        </div>
      </div>

      <div style={{ maxWidth: "900px", margin: "0 auto", padding: "40px 32px", display: "grid", gridTemplateColumns: "1fr 300px", gap: "32px" }}>
        <div>
          {/* Progresso */}
          <div style={{ marginBottom: "32px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
              <span style={{ fontSize: "12px", color: T.silver, textTransform: "uppercase", letterSpacing: "0.08em" }}>Progresso</span>
              <span style={{ fontSize: "12px", color: T.silver }}>{progress}%</span>
            </div>
            <div style={{ height: "3px", background: T.border, borderRadius: "999px" }}>
              <div style={{ height: "100%", width: `${progress}%`, background: T.blue, borderRadius: "999px", transition: "width 600ms ease-out" }} />
            </div>
          </div>

          {plan?.calibration_hypothesis && (
            <div style={{ padding: "14px 18px", background: T.surface, border: `1px solid ${T.border}`, borderRadius: "10px", marginBottom: "24px" }}>
              <p style={{ fontSize: "10px", color: T.silver, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "4px" }}>Hipótese do plano</p>
              <p style={{ margin: 0, fontSize: "13px", fontStyle: "italic", color: T.light, lineHeight: 1.6 }}>{plan.calibration_hypothesis}</p>
            </div>
          )}

          <p style={{ fontSize: "11px", color: T.silver, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "16px" }}>Próximos blocos</p>

          {(!blocks || blocks.length === 0) ? (
            <div style={{ padding: "40px", textAlign: "center", color: T.silver, fontSize: "14px" }}>Nenhum bloco agendado.</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {blocks.map((block: any, idx: number) => {
                const isNext = idx === 0;
                return (
                  <div key={block.id} style={{
                    padding: "16px 20px", background: isNext ? T.card : T.surface,
                    border: `1px solid ${isNext ? T.blue + "44" : T.border}`,
                    borderLeft: `3px solid ${isNext ? T.blue : T.border}`,
                    borderRadius: "10px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "16px",
                  }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", gap: "8px", marginBottom: "4px" }}>
                        {isNext && <span style={{ fontSize: "10px", color: T.blue, fontWeight: 600, letterSpacing: "0.08em" }}>PRÓXIMO</span>}
                        {block.is_critical && <span style={{ fontSize: "10px", color: T.amber }}>★</span>}
                      </div>
                      <p style={{ margin: 0, fontSize: "14px", fontWeight: isNext ? 500 : 400 }}>{block.title}</p>
                      <p style={{ margin: "4px 0 0", fontSize: "12px", color: T.silver }}>{formatDate(block.scheduled_at)} · {block.duration_minutes || 30}min</p>
                    </div>
                    <div style={{ display: "flex", gap: "6px" }}>
                      <button onClick={() => router.push(`/block/${block.id}`)}
                        style={{ padding: "8px 14px", background: isNext ? T.blue : `${T.blue}22`, border: `1px solid ${T.blue}44`, borderRadius: "8px", color: isNext ? T.light : T.blue, fontSize: "12px", cursor: "pointer", fontFamily: "Inter, sans-serif", fontWeight: isNext ? 500 : 400 }}>
                        {isNext ? "Executar →" : "Ver"}
                      </button>
                      <button onClick={() => skipBlock(block.id)}
                        style={{ padding: "8px 10px", background: "transparent", border: `1px solid ${T.border}`, borderRadius: "8px", color: T.silver, fontSize: "11px", cursor: "pointer", fontFamily: "Inter, sans-serif" }}>
                        ×
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div>
          {plan?.phases && (
            <div>
              <p style={{ fontSize: "11px", color: T.silver, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "16px" }}>Fases</p>
              {plan.phases.map((phase: any, i: number) => (
                <div key={i} style={{ padding: "14px", background: T.surface, border: `1px solid ${T.border}`, borderRadius: "10px", marginBottom: "10px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
                    <span style={{ fontSize: "11px", color: T.silver }}>Fase {phase.number}</span>
                    <span style={{ fontSize: "11px", color: T.silver }}>{phase.duration_weeks}sem</span>
                  </div>
                  <p style={{ margin: "0 0 4px", fontSize: "13px", fontWeight: 500 }}>{phase.name}</p>
                  <p style={{ margin: 0, fontSize: "12px", color: T.silver, lineHeight: 1.5 }}>{phase.goal}</p>
                </div>
              ))}
              {plan.success_metric && (
                <div style={{ padding: "12px", background: `${T.green}11`, border: `1px solid ${T.green}33`, borderRadius: "10px", marginTop: "8px" }}>
                  <p style={{ fontSize: "11px", color: T.green, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "4px" }}>Sucesso =</p>
                  <p style={{ margin: 0, fontSize: "12px", fontStyle: "italic", lineHeight: 1.5 }}>{plan.success_metric}</p>
                </div>
              )}
            </div>
          )}
          <div style={{ marginTop: "20px", display: "flex", flexDirection: "column", gap: "8px" }}>
            <button onClick={() => router.push("/dashboard")}
              style={{ padding: "10px", background: T.blue, border: "none", borderRadius: "8px", color: T.light, fontSize: "13px", cursor: "pointer", fontFamily: "Inter, sans-serif", fontWeight: 500 }}>
              Falar com North
            </button>
            <button onClick={() => router.push("/dreams")}
              style={{ padding: "10px", background: "transparent", border: `1px solid ${T.border}`, borderRadius: "8px", color: T.silver, fontSize: "13px", cursor: "pointer", fontFamily: "Inter, sans-serif" }}>
              Todos os sonhos
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function PlanPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: "100vh", background: "#0D0D14" }} />}>
      <PlanContent />
    </Suspense>
  );
}
