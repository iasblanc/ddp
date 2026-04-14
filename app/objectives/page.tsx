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
  learn:    { label: "Aprender", color: T.blue },
  practice: { label: "Praticar", color: T.amber },
  review:   { label: "Rever",    color: T.mauve },
  test:     { label: "Testar",   color: T.green },
};

const STATUS_COLOR: Record<string, string> = {
  scheduled: T.blue, completed: T.green, active: T.amber, missed: T.silver, skipped: T.silver,
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
  const [generatingObjectives, setGeneratingObjectives] = useState(false);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
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
      if (!dreamId && active) { router.replace(`/objectives?dreamId=${active.id}`); return; }
    }
    if (objRes?.ok) {
      const { objectives: objs } = await objRes.json();
      setObjectives(objs || []);
    }
    if (memRes?.ok) {
      const { memory } = await memRes.json();
      setAnswers({
        dailyTime: memory?.execution_profile?.declared_times?.[0] || "1 hora",
        bestTime:  memory?.execution_profile?.best_time || "manhã",
        deadline:  memory?.dream_profile?.deadline_declared || "3 meses",
        currentLevel: memory?.dream_profile?.current_level || "iniciante",
        constraints:  memory?.execution_profile?.constraints || "nenhuma",
      });
    }
    setLoading(false);
  }

  async function generateObjectives() {
    if (!dreamId || !dream) return;
    setGeneratingObjectives(true);
    const mem = await fetch(`/api/dreams/${dreamId}/memory`).then(r => r.json()).catch(() => ({}));
    const ep = mem.memory?.execution_profile || {};
    const dp = mem.memory?.dream_profile || {};
    await fetch("/api/north/extract-objectives", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        dreamId, dreamTitle: dream.title,
        dreamReflection: dp.dream_real,
        deadline: dp.deadline_declared,
        dailyTime: ep.declared_times?.[0] || "1 hora",
        bestTime: ep.best_time || "manhã",
        currentLevel: dp.current_level || "iniciante",
        mainObstacle: dp.obstacle_declared,
        constraints: ep.constraints,
        successMetric: dp.success_metric,
      }),
    });
    await loadData();
    setGeneratingObjectives(false);
  }

  const [generateError, setGenerateError] = useState<string | null>(null);

  async function generateBlocks(objId: string) {
    setGenerating(objId);
    setGenerateError(null);
    try {
      const res = await fetch(`/api/objectives/${objId}`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...answers, weeks: 6, blocksPerWeek: 3 }),
      });
      const data = res.ok ? await res.json() : null;
      if (!res.ok) {
        setGenerateError(`Erro do servidor (${res.status}). Tenta novamente.`);
      } else if (data?.count > 0) {
        await loadData();
      } else if (data?.error === "parse_failed" || data?.error === "empty_result") {
        setGenerateError("North não conseguiu formatar as tarefas. Tenta novamente em alguns segundos.");
      } else if (data?.count === 0) {
        setGenerateError("Nenhuma tarefa foi gerada. Tenta novamente.");
      } else {
        await loadData();
      }
    } catch {
      setGenerateError("Erro de conexão. Tenta novamente.");
    }
    setGenerating(null);
  }

  const fmt = (iso: string) => new Date(iso).toLocaleDateString("pt-BR", {
    weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit"
  });

  // Separar objetivos reais do grupo "geral"
  const realObjectives = objectives.filter(o => o.id !== "general");
  const generalGroup   = objectives.find(o => o.id === "general");
  const allObjForStats = objectives; // inclui geral para stats totais

  const totalBlocks    = allObjForStats.reduce((s, o) => s + (o.blocks?.length || 0), 0);
  const totalCompleted = allObjForStats.reduce((s, o) => s + (o.blocks?.filter((b: any) => b.status === "completed").length || 0), 0);
  const progress       = totalBlocks ? Math.round((totalCompleted / totalBlocks) * 100) : 0;
  const totalHours     = (totalBlocks * 0.5).toFixed(1).replace(".0", "");

  if (loading) return (
    <div style={{ minHeight: "100vh", background: T.bg, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <p style={{ color: T.silver, fontFamily: "Inter, sans-serif", fontSize: "14px" }}>A carregar plano completo...</p>
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", background: T.bg, color: T.light, fontFamily: "Inter, sans-serif" }}>

      {/* Header */}
      <div style={{ borderBottom: `1px solid ${T.border}`, padding: "14px 28px", display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, background: `${T.bg}F0`, backdropFilter: "blur(12px)", zIndex: 50, flexWrap: "wrap", gap: "10px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
          <button onClick={() => router.push("/dashboard")} style={{ background: "none", border: "none", color: T.silver, cursor: "pointer", fontSize: "13px", fontFamily: "Inter, sans-serif" }}>← Dashboard</button>
          <span style={{ color: T.border }}>|</span>
          <div>
            <p style={{ margin: 0, fontSize: "10px", color: T.silver, textTransform: "uppercase", letterSpacing: "0.1em" }}>Plano Completo</p>
            <p style={{ margin: 0, fontFamily: "'Playfair Display', serif", fontSize: "15px" }}>{dream?.title || "—"}</p>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <span style={{ fontSize: "11px", color: T.silver }}>{totalCompleted}/{totalBlocks} · {totalHours}h</span>
          <button onClick={() => router.push(`/timeline?dreamId=${dreamId}`)}
            style={{ padding: "6px 12px", background: "transparent", border: `1px solid ${T.border}`, borderRadius: "6px", color: T.silver, fontSize: "11px", cursor: "pointer", fontFamily: "Inter, sans-serif" }}>
            Timeline
          </button>
        </div>
      </div>

      <div style={{ maxWidth: "820px", margin: "0 auto", padding: "28px 24px" }}>

        {/* Stats */}
        {totalBlocks > 0 && (
          <div style={{ padding: "20px 24px", background: T.card, border: `1px solid ${T.border}`, borderRadius: "14px", marginBottom: "28px" }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "12px", marginBottom: "16px" }}>
              {[
                { label: "Objetivos",      value: realObjectives.length, color: T.blue },
                { label: "Tarefas 30min",  value: totalBlocks,           color: T.amber },
                { label: "Horas de foco",  value: `${totalHours}h`,      color: T.mauve },
                { label: "Concluídas",     value: `${progress}%`,         color: T.green },
              ].map(s => (
                <div key={s.label} style={{ textAlign: "center" }}>
                  <p style={{ margin: "0 0 3px", fontSize: "22px", fontWeight: 300, color: s.color, fontFamily: "'Playfair Display', serif" }}>{s.value}</p>
                  <p style={{ margin: 0, fontSize: "10px", color: T.silver, textTransform: "uppercase", letterSpacing: "0.06em" }}>{s.label}</p>
                </div>
              ))}
            </div>
            <div style={{ height: "3px", background: T.border, borderRadius: "999px" }}>
              <div style={{ height: "100%", width: `${progress}%`, background: `linear-gradient(90deg, ${T.blue}, ${T.green})`, borderRadius: "999px", transition: "width 800ms ease-out" }} />
            </div>
          </div>
        )}

        {/* Estado vazio — sem objetivos reais */}
        {realObjectives.length === 0 && (
          <div style={{ textAlign: "center", padding: "50px 0", maxWidth: "400px", margin: "0 auto 32px" }}>
            <p style={{ fontFamily: "'Playfair Display', serif", fontSize: "20px", marginBottom: "10px" }}>
              Sem objetivos macro ainda.
            </p>
            <p style={{ fontSize: "13px", color: T.silver, lineHeight: 1.7, marginBottom: "24px" }}>
              North vai analisar o seu sonho e identificar os pilares concretos a atingir.
            </p>
            <button
              onClick={generateObjectives}
              disabled={generatingObjectives}
              style={{ padding: "13px 26px", background: generatingObjectives ? T.border : T.blue, border: "none", borderRadius: "10px", color: T.light, fontSize: "13px", fontWeight: 500, cursor: generatingObjectives ? "default" : "pointer", fontFamily: "Inter, sans-serif" }}>
              {generatingObjectives ? "North está analisando..." : "Gerar objetivos macro com North →"}
            </button>
          </div>
        )}

        {/* Objetivos reais */}
        {realObjectives.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: "16px", marginBottom: "24px" }}>
            {realObjectives.map((obj, idx) => {
              const blocks: any[] = obj.blocks || [];
              const done = blocks.filter((b: any) => b.status === "completed").length;
              const pct = blocks.length ? Math.round((done / blocks.length) * 100) : 0;
              const isCollapsed = collapsed[obj.id] ?? false;

              return (
                <div key={obj.id} style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: "14px", overflow: "hidden" }}>
                  {/* Header do objetivo — clicável para collapse */}
                  <div
                    onClick={() => setCollapsed(prev => ({ ...prev, [obj.id]: !isCollapsed }))}
                    style={{ padding: "18px 22px", cursor: "pointer", display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "14px" }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px" }}>
                        <span style={{ fontSize: "10px", fontFamily: "monospace", fontWeight: 700, color: T.blue, background: `${T.blue}22`, padding: "2px 7px", borderRadius: "4px" }}>
                          OBJ {String(idx + 1).padStart(2, "0")}
                        </span>
                        <span style={{ fontSize: "10px", color: obj.status === "completed" ? T.green : T.silver, padding: "2px 8px", borderRadius: "999px", background: obj.status === "completed" ? `${T.green}22` : T.surface, border: `1px solid ${obj.status === "completed" ? T.green + "44" : T.border}` }}>
                          {obj.status === "completed" ? "✓ Concluído" : "Em andamento"}
                        </span>
                        <span style={{ fontSize: "10px", color: T.silver }}>{isCollapsed ? "▶" : "▼"}</span>
                      </div>
                      <p style={{ margin: "0 0 4px", fontSize: "15px", fontWeight: 600, lineHeight: 1.3 }}>{obj.title}</p>
                      {obj.description && !isCollapsed && <p style={{ margin: "0 0 3px", fontSize: "12px", color: T.light, lineHeight: 1.5 }}>{obj.description}</p>}
                      {obj.why && !isCollapsed && <p style={{ margin: 0, fontSize: "11px", color: T.silver, fontStyle: "italic" }}>→ {obj.why}</p>}
                    </div>
                    <div style={{ textAlign: "center", flexShrink: 0 }}>
                      <p style={{ margin: "0 0 2px", fontSize: "22px", fontWeight: 300, color: pct === 100 ? T.green : T.blue, fontFamily: "'Playfair Display', serif" }}>{pct}%</p>
                      <p style={{ margin: 0, fontSize: "10px", color: T.silver }}>{done}/{blocks.length}</p>
                    </div>
                  </div>

                  {/* Barra de progresso do objetivo */}
                  {blocks.length > 0 && (
                    <div style={{ height: "2px", background: T.border, margin: "0 22px" }}>
                      <div style={{ height: "100%", width: `${pct}%`, background: pct === 100 ? T.green : T.blue, transition: "width 600ms ease-out" }} />
                    </div>
                  )}

                  {/* Blocos — colapsáveis */}
                  {!isCollapsed && (
                    <div style={{ padding: "14px 22px 18px" }}>
                      {blocks.length === 0 ? (
                        <div style={{ textAlign: "center", padding: "16px 0" }}>
                          <p style={{ fontSize: "12px", color: T.silver, marginBottom: "12px" }}>Tarefas de 30 min ainda não geradas.</p>
                          <button onClick={() => generateBlocks(obj.id)} disabled={!!generating}
                            style={{ padding: "8px 18px", background: generating === obj.id ? T.border : `${T.blue}22`, border: `1px solid ${T.blue}44`, borderRadius: "7px", color: T.blue, fontSize: "12px", cursor: generating ? "default" : "pointer", fontFamily: "Inter, sans-serif", fontWeight: 500 }}>
                            {generating === obj.id ? "Gerando com North..." : "Gerar tarefas de 30min →"}
                          </button>
                          {generateError && generating !== obj.id && (
                            <p style={{ margin: "8px 0 0", fontSize: "11px", color: "#C9853A", lineHeight: 1.4 }}>{generateError}</p>
                          )}
                        </div>
                      ) : (
                        <>
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "10px" }}>
                            <span style={{ fontSize: "10px", color: T.silver, textTransform: "uppercase", letterSpacing: "0.07em" }}>
                              {blocks.length} tarefas · {(blocks.length / 2).toFixed(1).replace(".0","")}h
                            </span>
                            <div style={{ display: "flex", gap: "6px" }}>
                              {["learn","practice","review","test"].map(type => {
                                const count = blocks.filter(b => b.session_type === type).length;
                                if (!count) return null;
                                const cfg = SESSION_LABEL[type];
                                return (
                                  <span key={type} style={{ fontSize: "9px", color: cfg.color, padding: "1px 6px", background: `${cfg.color}15`, borderRadius: "3px" }}>
                                    {cfg.label} {count}
                                  </span>
                                );
                              })}
                            </div>
                          </div>
                          <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
                            {blocks.map((block: any, bIdx: number) => {
                              const isNext = block.status === "scheduled" && bIdx === blocks.findIndex((b: any) => b.status === "scheduled");
                              const stColor = STATUS_COLOR[block.status] || T.border;
                              const sess = SESSION_LABEL[block.session_type] || SESSION_LABEL.practice;
                              return (
                                <div key={block.id}
                                  onClick={() => block.status === "scheduled" && router.push(`/block/${block.id}`)}
                                  style={{ padding: "10px 12px", background: isNext ? `${T.blue}0A` : T.surface, border: `1px solid ${isNext ? T.blue + "33" : T.border}`, borderLeft: `3px solid ${stColor}`, borderRadius: "7px", cursor: block.status === "scheduled" ? "pointer" : "default", opacity: block.status === "missed" || block.status === "skipped" ? 0.45 : 1 }}>
                                  <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "10px" }}>
                                    <div style={{ flex: 1 }}>
                                      <div style={{ display: "flex", alignItems: "center", gap: "5px", marginBottom: "3px", flexWrap: "wrap" }}>
                                        {isNext && <span style={{ fontSize: "9px", fontWeight: 700, color: T.blue, letterSpacing: "0.1em" }}>PRÓXIMO</span>}
                                        {block.is_critical && <span style={{ fontSize: "9px", color: T.amber }}>★</span>}
                                        <span style={{ fontSize: "9px", color: sess.color, background: `${sess.color}15`, padding: "1px 5px", borderRadius: "3px" }}>{sess.label}</span>
                                        {block.status === "completed" && <span style={{ fontSize: "9px", color: T.green }}>✓</span>}
                                      </div>
                                      <p style={{ margin: "0 0 2px", fontSize: "12px", fontWeight: isNext ? 500 : 400, lineHeight: 1.4 }}>{block.title}</p>
                                      {block.description && <p style={{ margin: "0 0 3px", fontSize: "10px", color: T.silver, lineHeight: 1.4 }}>{block.description}</p>}
                                      {block.resource_url && (
                                        <a href={block.resource_url} target="_blank" rel="noopener noreferrer"
                                          onClick={e => e.stopPropagation()}
                                          style={{ display: "inline-flex", alignItems: "center", gap: "3px", fontSize: "10px", color: T.blue, textDecoration: "none" }}>
                                          🔗 {block.resource_name || "Recurso"}
                                        </a>
                                      )}
                                    </div>
                                    <div style={{ textAlign: "right", flexShrink: 0 }}>
                                      <p style={{ margin: "0 0 1px", fontSize: "10px", color: T.silver }}>{fmt(block.scheduled_at)}</p>
                                      {block.status === "scheduled" && <p style={{ margin: 0, fontSize: "10px", color: T.blue }}>Executar →</p>}
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Grupo de blocos gerais (sem objetivo) */}
        {generalGroup && generalGroup.blocks?.length > 0 && (
          <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: "14px", overflow: "hidden" }}>
            <div
              onClick={() => setCollapsed(prev => ({ ...prev, general: !prev.general }))}
              style={{ padding: "16px 22px", cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <p style={{ margin: "0 0 2px", fontSize: "12px", fontWeight: 600 }}>Blocos Gerais</p>
                <p style={{ margin: 0, fontSize: "11px", color: T.silver }}>Tarefas sem objetivo macro associado</p>
              </div>
              <span style={{ fontSize: "10px", color: T.silver }}>{collapsed.general ? "▶" : "▼"}</span>
            </div>
            {!collapsed.general && (
              <div style={{ padding: "0 22px 16px", display: "flex", flexDirection: "column", gap: "5px" }}>
                {generalGroup.blocks.map((block: any) => (
                  <div key={block.id}
                    onClick={() => block.status === "scheduled" && router.push(`/block/${block.id}`)}
                    style={{ padding: "10px 12px", background: T.surface, border: `1px solid ${T.border}`, borderLeft: `3px solid ${STATUS_COLOR[block.status] || T.border}`, borderRadius: "7px", cursor: block.status === "scheduled" ? "pointer" : "default" }}>
                    <p style={{ margin: 0, fontSize: "12px", lineHeight: 1.4 }}>{block.title}</p>
                    <p style={{ margin: "2px 0 0", fontSize: "10px", color: T.silver }}>{fmt(block.scheduled_at)}</p>
                  </div>
                ))}
              </div>
            )}
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
