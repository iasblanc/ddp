// @ts-nocheck
"use client";
import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuthGuard } from "@/lib/auth-guard";

const T = {
  bg: "#0D0D14", card: "#1A1A2E", light: "#E8E4DC", silver: "#6B6B80",
  blue: "#4A6FA5", green: "#2D6A4F", amber: "#C9853A", border: "#252538",
  surface: "#141420", mauve: "#7B5EA7",
};

const SESSION_LABEL: Record<string, { label: string; color: string }> = {
  learn:    { label: "Aprender",  color: T.blue },
  practice: { label: "Praticar",  color: T.amber },
  review:   { label: "Rever",     color: T.mauve },
  test:     { label: "Testar",    color: T.green },
};

const STATUS_COLOR: Record<string, string> = {
  scheduled: T.blue, completed: T.green,
  active: T.amber, missed: T.silver, skipped: T.silver,
};

function ObjectivesContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const dreamId = searchParams.get("dreamId");
  useAuthGuard();

  const [dream, setDream] = useState<any>(null);
  const [objectives, setObjectives] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState<string | null>(null);
  const [showAll, setShowAll] = useState<Record<string, boolean>>({});
  const [answers, setAnswers] = useState<any>({});

  useEffect(() => { loadData(); }, [dreamId]);

  async function loadData() {
    setLoading(true);
    const [dreamsRes, objRes, memRes] = await Promise.all([
      fetch("/api/dreams"),
      dreamId ? fetch(`/api/objectives?dreamId=${dreamId}`) : Promise.resolve(null),
      dreamId ? fetch(`/api/dreams/${dreamId}/memory`) : Promise.resolve(null),
    ]);

    if (dreamsRes.ok) {
      const { dreams } = await dreamsRes.json();
      const active = dreamId
        ? dreams?.find((d: any) => d.id === dreamId)
        : dreams?.find((d: any) => d.status === "active");
      setDream(active || null);
      if (!dreamId && active) {
        router.replace(`/objectives?dreamId=${active.id}`);
        return;
      }
    }
    if (objRes?.ok) {
      const { objectives: objs } = await objRes.json();
      setObjectives(objs || []);
    }
    if (memRes?.ok) {
      const { memory } = await memRes.json();
      setAnswers({
        dailyTime: memory?.execution_profile?.declared_times?.[0] || "1 hora",
        bestTime: memory?.execution_profile?.best_time || "manhã",
        deadline: memory?.dream_profile?.deadline_declared || "3 meses",
        currentLevel: memory?.dream_profile?.current_level || "iniciante",
        constraints: memory?.execution_profile?.constraints || "nenhuma",
      });
    }
    setLoading(false);
  }

  async function generateBlocks(objId: string) {
    setGenerating(objId);
    const res = await fetch(`/api/objectives/${objId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...answers, weeks: 6, blocksPerWeek: 3 }),
    });
    if (res.ok) await loadData();
    else alert("Erro ao gerar tarefas. Tenta novamente.");
    setGenerating(null);
  }

  const fmt = (iso: string) => new Date(iso).toLocaleDateString("pt-BR", {
    weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
  });

  const totalBlocks = objectives.reduce((s, o) => s + (o.blocks?.length || 0), 0);
  const totalCompleted = objectives.reduce((s, o) =>
    s + (o.blocks?.filter((b: any) => b.status === "completed").length || 0), 0);
  const progress = totalBlocks ? Math.round((totalCompleted / totalBlocks) * 100) : 0;
  const totalHours = Math.round(totalBlocks * 0.5);

  if (loading) return (
    <div style={{ minHeight: "100vh", background: T.bg, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <p style={{ color: T.silver, fontFamily: "Inter, sans-serif", fontSize: "14px" }}>A carregar plano completo...</p>
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", background: T.bg, color: T.light, fontFamily: "Inter, sans-serif" }}>

      {/* Header */}
      <div style={{ borderBottom: `1px solid ${T.border}`, padding: "16px 32px", display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, background: `${T.bg}F0`, backdropFilter: "blur(12px)", zIndex: 50, flexWrap: "wrap", gap: "12px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          <button onClick={() => router.push("/dashboard")} style={{ background: "none", border: "none", color: T.silver, cursor: "pointer", fontSize: "13px", fontFamily: "Inter, sans-serif" }}>← Dashboard</button>
          <span style={{ color: T.border }}>|</span>
          <div>
            <p style={{ margin: 0, fontSize: "10px", color: T.silver, textTransform: "uppercase", letterSpacing: "0.1em" }}>Plano Completo</p>
            <p style={{ margin: 0, fontFamily: "'Playfair Display', serif", fontSize: "15px" }}>{dream?.title || "—"}</p>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <span style={{ fontSize: "12px", color: T.silver }}>{totalCompleted}/{totalBlocks} tarefas · {totalHours}h total</span>
          <button onClick={() => router.push(`/timeline?dreamId=${dreamId}`)} style={{ padding: "6px 12px", background: `${T.blue}22`, border: `1px solid ${T.blue}44`, borderRadius: "6px", color: T.blue, fontSize: "12px", cursor: "pointer", fontFamily: "Inter, sans-serif" }}>
            Timeline
          </button>
          <button onClick={() => router.push(`/plan?dreamId=${dreamId}`)} style={{ padding: "6px 12px", background: "transparent", border: `1px solid ${T.border}`, borderRadius: "6px", color: T.silver, fontSize: "12px", cursor: "pointer", fontFamily: "Inter, sans-serif" }}>
            Plano
          </button>
        </div>
      </div>

      <div style={{ maxWidth: "860px", margin: "0 auto", padding: "32px 24px" }}>

        {/* Progresso geral */}
        {totalBlocks > 0 && (
          <div style={{ padding: "24px", background: T.card, border: `1px solid ${T.border}`, borderRadius: "14px", marginBottom: "32px" }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "16px", marginBottom: "20px" }}>
              {[
                { label: "Objectivos", value: objectives.length, color: T.blue },
                { label: "Tarefas 30min", value: totalBlocks, color: T.amber },
                { label: "Horas de trabalho", value: `${totalHours}h`, color: T.mauve },
                { label: "Concluídas", value: `${progress}%`, color: T.green },
              ].map(s => (
                <div key={s.label} style={{ textAlign: "center" }}>
                  <p style={{ margin: "0 0 4px", fontSize: "24px", fontWeight: 300, color: s.color, fontFamily: "'Playfair Display', serif" }}>{s.value}</p>
                  <p style={{ margin: 0, fontSize: "11px", color: T.silver, textTransform: "uppercase", letterSpacing: "0.06em" }}>{s.label}</p>
                </div>
              ))}
            </div>
            <div style={{ height: "4px", background: T.border, borderRadius: "999px" }}>
              <div style={{ height: "100%", width: `${progress}%`, background: `linear-gradient(90deg, ${T.blue}, ${T.green})`, borderRadius: "999px", transition: "width 800ms ease-out" }} />
            </div>
          </div>
        )}

        {/* Objectivos */}
        {objectives.length === 0 ? (
          <div style={{ textAlign: "center", padding: "60px 0" }}>
            <p style={{ fontFamily: "'Playfair Display', serif", fontSize: "20px", marginBottom: "8px" }}>Sem objectivos macro ainda.</p>
            <p style={{ fontSize: "13px", color: T.silver }}>Completa o onboarding para North gerar o teu plano.</p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
            {objectives.map((obj, idx) => {
              const blocks: any[] = obj.blocks || [];
              const completed = blocks.filter((b: any) => b.status === "completed").length;
              const pct = blocks.length ? Math.round((completed / blocks.length) * 100) : 0;
              const showing = showAll[obj.id] ? blocks : blocks;
              // Sempre mostrar todos os blocos

              return (
                <div key={obj.id} style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: "16px", overflow: "hidden" }}>

                  {/* Cabeçalho do objectivo */}
                  <div style={{ padding: "22px 26px 18px" }}>
                    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "16px" }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
                          <span style={{ fontSize: "10px", fontFamily: "monospace", fontWeight: 700, color: T.blue, background: `${T.blue}22`, padding: "3px 8px", borderRadius: "4px" }}>
                            OBJ {String(idx + 1).padStart(2, "0")}
                          </span>
                          <span style={{ fontSize: "10px", color: obj.status === "completed" ? T.green : T.silver, padding: "2px 8px", borderRadius: "999px", background: obj.status === "completed" ? `${T.green}22` : T.surface, border: `1px solid ${obj.status === "completed" ? T.green + "44" : T.border}` }}>
                            {obj.status === "completed" ? "✓ Concluído" : "Em curso"}
                          </span>
                        </div>
                        <p style={{ margin: "0 0 6px", fontSize: "17px", fontWeight: 600, lineHeight: 1.3 }}>{obj.title}</p>
                        {obj.description && <p style={{ margin: "0 0 4px", fontSize: "13px", color: T.light, lineHeight: 1.6 }}>{obj.description}</p>}
                        {obj.why && <p style={{ margin: 0, fontSize: "12px", color: T.silver, fontStyle: "italic" }}>→ {obj.why}</p>}
                      </div>
                      <div style={{ textAlign: "center", flexShrink: 0, minWidth: "64px" }}>
                        <p style={{ margin: "0 0 2px", fontSize: "26px", fontWeight: 300, color: pct === 100 ? T.green : T.blue, fontFamily: "'Playfair Display', serif" }}>{pct}%</p>
                        <p style={{ margin: 0, fontSize: "11px", color: T.silver }}>{completed}/{blocks.length}</p>
                      </div>
                    </div>

                    {/* Barra do objectivo */}
                    {blocks.length > 0 && (
                      <div style={{ height: "3px", background: T.border, borderRadius: "999px", marginTop: "14px" }}>
                        <div style={{ height: "100%", width: `${pct}%`, background: pct === 100 ? T.green : T.blue, borderRadius: "999px", transition: "width 600ms ease-out" }} />
                      </div>
                    )}
                  </div>

                  {/* Separador */}
                  <div style={{ height: "1px", background: T.border }} />

                  {/* Blocos / tarefas */}
                  <div style={{ padding: "16px 26px 22px" }}>
                    {blocks.length === 0 ? (
                      <div style={{ textAlign: "center", padding: "20px 0" }}>
                        <p style={{ fontSize: "13px", color: T.silver, marginBottom: "14px" }}>
                          Tarefas de 30 minutos ainda não geradas para este objectivo.
                        </p>
                        <button
                          onClick={() => generateBlocks(obj.id)}
                          disabled={!!generating}
                          style={{ padding: "10px 20px", background: generating === obj.id ? T.border : `${T.blue}22`, border: `1px solid ${T.blue}44`, borderRadius: "8px", color: T.blue, fontSize: "13px", cursor: generating ? "default" : "pointer", fontFamily: "Inter, sans-serif", fontWeight: 500 }}>
                          {generating === obj.id ? "North a gerar tarefas..." : "Gerar tarefas de 30min com North →"}
                        </button>
                      </div>
                    ) : (
                      <div>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
                          <span style={{ fontSize: "11px", color: T.silver, textTransform: "uppercase", letterSpacing: "0.08em" }}>
                            {blocks.length} acções tácticas · {blocks.length / 2}h de trabalho focado
                          </span>
                          <div style={{ display: "flex", gap: "8px" }}>
                            {["learn","practice","review","test"].map(type => {
                              const count = blocks.filter(b => b.session_type === type).length;
                              if (!count) return null;
                              const cfg = SESSION_LABEL[type];
                              return (
                                <span key={type} style={{ fontSize: "10px", color: cfg.color, padding: "2px 7px", background: `${cfg.color}15`, borderRadius: "4px", border: `1px solid ${cfg.color}33` }}>
                                  {cfg.label} ({count})
                                </span>
                              );
                            })}
                          </div>
                        </div>

                        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                          {showing.map((block: any, bIdx: number) => {
                            const isNext = block.status === "scheduled" && bIdx === blocks.findIndex((b: any) => b.status === "scheduled");
                            const stColor = STATUS_COLOR[block.status] || T.border;
                            const sess = SESSION_LABEL[block.session_type] || SESSION_LABEL.practice;

                            return (
                              <div key={block.id} style={{
                                padding: "12px 14px",
                                background: isNext ? `${T.blue}0A` : T.surface,
                                border: `1px solid ${isNext ? T.blue + "33" : T.border}`,
                                borderLeft: `3px solid ${stColor}`,
                                borderRadius: "8px",
                                cursor: block.status === "scheduled" ? "pointer" : "default",
                              }}
                                onClick={() => block.status === "scheduled" && router.push(`/block/${block.id}`)}
                              >
                                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "12px" }}>
                                  <div style={{ flex: 1 }}>
                                    <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "4px", flexWrap: "wrap" }}>
                                      {isNext && <span style={{ fontSize: "9px", fontWeight: 700, color: T.blue, letterSpacing: "0.1em" }}>PRÓXIMO</span>}
                                      {block.is_critical && <span style={{ fontSize: "9px", color: T.amber }}>★ CRÍTICO</span>}
                                      <span style={{ fontSize: "10px", color: sess.color, background: `${sess.color}15`, padding: "1px 6px", borderRadius: "3px" }}>
                                        {sess.label}
                                      </span>
                                      {block.status === "completed" && <span style={{ fontSize: "10px", color: T.green }}>✓ Concluído</span>}
                                      {block.status === "missed" && <span style={{ fontSize: "10px", color: T.silver }}>Não realizado</span>}
                                    </div>
                                    <p style={{ margin: "0 0 3px", fontSize: "13px", fontWeight: isNext ? 500 : 400, opacity: block.status === "missed" ? 0.5 : 1, lineHeight: 1.4 }}>
                                      {block.title}
                                    </p>
                                    {block.description && (
                                      <p style={{ margin: "0 0 4px", fontSize: "11px", color: T.silver, lineHeight: 1.4 }}>{block.description}</p>
                                    )}
                                    {block.resource_url && (
                                      <a
                                        href={block.resource_url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        onClick={e => e.stopPropagation()}
                                        style={{ display: "inline-flex", alignItems: "center", gap: "4px", fontSize: "11px", color: T.blue, textDecoration: "none", marginTop: "2px" }}
                                      >
                                        🔗 {block.resource_name || "Abrir recurso"}
                                      </a>
                                    )}
                                  </div>
                                  <div style={{ textAlign: "right", flexShrink: 0 }}>
                                    <p style={{ margin: "0 0 2px", fontSize: "11px", color: T.silver }}>{fmt(block.scheduled_at)}</p>
                                    <p style={{ margin: 0, fontSize: "11px", color: T.silver }}>{block.duration_minutes}min</p>
                                    {block.status === "scheduled" && (
                                      <p style={{ margin: "4px 0 0", fontSize: "11px", color: T.blue }}>Executar →</p>
                                    )}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default function ObjectivesPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: "100vh", background: "#0D0D14" }} />}>
      <ObjectivesContent />
    </Suspense>
  );
}
