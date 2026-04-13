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

const statusColor: Record<string, string> = {
  scheduled: T.blue, completed: T.green, missed: T.silver, active: T.amber, skipped: T.silver,
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
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  useEffect(() => { loadData(); }, [dreamId]);

  async function loadData() {
    setLoading(true);
    const [dreamsRes, objRes] = await Promise.all([
      fetch("/api/dreams"),
      dreamId ? fetch(`/api/objectives?dreamId=${dreamId}`) : Promise.resolve(null),
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
      // Expandir o primeiro por defeito
      if (objs?.length) setExpanded({ [objs[0].id]: true });
    }

    setLoading(false);
  }

  async function generateBlocks(objId: string) {
    setGenerating(objId);
    const res = await fetch(`/api/objectives/${objId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ weeks: 8, blocksPerWeek: 3 }),
    });
    if (res.ok) await loadData();
    setGenerating(null);
  }

  const fmt = (iso: string) => new Date(iso).toLocaleDateString("pt-BR", {
    weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit"
  });

  const totalBlocks = objectives.reduce((s, o) => s + (o.blocks?.length || 0), 0);
  const totalCompleted = objectives.reduce((s, o) => s + (o.blocks?.filter((b: any) => b.status === "completed").length || 0), 0);
  const progress = totalBlocks ? Math.round((totalCompleted / totalBlocks) * 100) : 0;

  if (loading) return (
    <div style={{ minHeight: "100vh", background: T.bg, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <p style={{ color: T.silver, fontFamily: "Inter, sans-serif", fontSize: "14px" }}>A carregar...</p>
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", background: T.bg, color: T.light, fontFamily: "Inter, sans-serif" }}>
      {/* Header */}
      <div style={{ borderBottom: `1px solid ${T.border}`, padding: "16px 32px", display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, background: `${T.bg}F0`, backdropFilter: "blur(12px)", zIndex: 50 }}>
        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          <button onClick={() => router.push("/dashboard")} style={{ background: "none", border: "none", color: T.silver, cursor: "pointer", fontSize: "13px", fontFamily: "Inter, sans-serif" }}>← Dashboard</button>
          <span style={{ color: T.border }}>|</span>
          <div>
            <p style={{ margin: 0, fontSize: "11px", color: T.silver, textTransform: "uppercase", letterSpacing: "0.08em" }}>Sonho</p>
            <p style={{ margin: 0, fontFamily: "'Playfair Display', serif", fontSize: "16px" }}>{dream?.title || "—"}</p>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          <span style={{ fontSize: "12px", color: T.silver }}>{totalCompleted}/{totalBlocks} blocos</span>
          <button onClick={() => router.push(`/plan?dreamId=${dreamId}`)} style={{ padding: "7px 14px", background: "transparent", border: `1px solid ${T.border}`, borderRadius: "8px", color: T.silver, fontSize: "12px", cursor: "pointer", fontFamily: "Inter, sans-serif" }}>Vista Plano</button>
        </div>
      </div>

      <div style={{ maxWidth: "800px", margin: "0 auto", padding: "40px 32px" }}>

        {/* Progresso geral */}
        {totalBlocks > 0 && (
          <div style={{ marginBottom: "32px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
              <span style={{ fontSize: "12px", color: T.silver, textTransform: "uppercase", letterSpacing: "0.08em" }}>Progresso do Sonho</span>
              <span style={{ fontSize: "12px", color: T.silver }}>{progress}%</span>
            </div>
            <div style={{ height: "4px", background: T.border, borderRadius: "999px" }}>
              <div style={{ height: "100%", width: `${progress}%`, background: `linear-gradient(90deg, ${T.blue}, ${T.green})`, borderRadius: "999px", transition: "width 600ms ease-out" }} />
            </div>
          </div>
        )}

        {/* Objectivos */}
        {objectives.length === 0 ? (
          <div style={{ textAlign: "center", padding: "60px 0" }}>
            <p style={{ fontFamily: "'Playfair Display', serif", fontSize: "20px", marginBottom: "12px" }}>Sem objectivos macro ainda.</p>
            <p style={{ fontSize: "13px", color: T.silver, marginBottom: "24px" }}>North vai extrair os objectivos macro do teu sonho.</p>
            <button onClick={() => router.push("/dashboard")} style={{ padding: "12px 24px", background: T.blue, border: "none", borderRadius: "8px", color: T.light, fontSize: "13px", cursor: "pointer", fontFamily: "Inter, sans-serif" }}>
              Conversar com North
            </button>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            {objectives.map((obj, idx) => {
              const objBlocks = obj.blocks || [];
              const completed = objBlocks.filter((b: any) => b.status === "completed").length;
              const objProgress = objBlocks.length ? Math.round((completed / objBlocks.length) * 100) : 0;
              const isExpanded = expanded[obj.id];

              return (
                <div key={obj.id} style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: "14px", overflow: "hidden" }}>
                  {/* Cabeçalho do objectivo */}
                  <div
                    onClick={() => setExpanded(prev => ({ ...prev, [obj.id]: !isExpanded }))}
                    style={{ padding: "20px 24px", cursor: "pointer", display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "16px" }}
                  >
                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "6px" }}>
                        <span style={{ fontSize: "11px", color: T.blue, fontWeight: 600, fontFamily: "monospace" }}>
                          OBJ {String(idx + 1).padStart(2, "0")}
                        </span>
                        <span style={{ fontSize: "11px", padding: "2px 8px", borderRadius: "999px", background: obj.status === "completed" ? `${T.green}22` : `${T.blue}11`, color: obj.status === "completed" ? T.green : T.blue, border: `1px solid ${obj.status === "completed" ? T.green : T.blue}33` }}>
                          {obj.status === "completed" ? "Concluído" : "Em curso"}
                        </span>
                      </div>
                      <p style={{ margin: "0 0 4px", fontSize: "16px", fontWeight: 500 }}>{obj.title}</p>
                      {obj.description && <p style={{ margin: 0, fontSize: "12px", color: T.silver, lineHeight: 1.5 }}>{obj.description}</p>}
                    </div>
                    <div style={{ textAlign: "right", flexShrink: 0 }}>
                      <p style={{ margin: "0 0 6px", fontSize: "20px", fontWeight: 300, color: obj.status === "completed" ? T.green : T.blue, fontFamily: "'Playfair Display', serif" }}>
                        {objProgress}%
                      </p>
                      <p style={{ margin: 0, fontSize: "11px", color: T.silver }}>{completed}/{objBlocks.length}</p>
                    </div>
                  </div>

                  {/* Barra de progresso */}
                  {objBlocks.length > 0 && (
                    <div style={{ height: "2px", background: T.border, margin: "0 24px" }}>
                      <div style={{ height: "100%", width: `${objProgress}%`, background: obj.status === "completed" ? T.green : T.blue, transition: "width 600ms ease-out" }} />
                    </div>
                  )}

                  {/* Blocos expandidos */}
                  {isExpanded && (
                    <div style={{ padding: "16px 24px 20px" }}>
                      {objBlocks.length === 0 ? (
                        <div style={{ textAlign: "center", padding: "20px 0" }}>
                          <p style={{ fontSize: "13px", color: T.silver, marginBottom: "12px" }}>Sem acções tácticas ainda.</p>
                          <button
                            onClick={() => generateBlocks(obj.id)}
                            disabled={!!generating}
                            style={{ padding: "8px 18px", background: generating === obj.id ? T.border : `${T.blue}22`, border: `1px solid ${T.blue}44`, borderRadius: "8px", color: T.blue, fontSize: "12px", cursor: "pointer", fontFamily: "Inter, sans-serif" }}
                          >
                            {generating === obj.id ? "A gerar..." : "Gerar acções tácticas com North →"}
                          </button>
                        </div>
                      ) : (
                        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                          <p style={{ fontSize: "11px", color: T.silver, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "8px" }}>
                            Acções Tácticas · {objBlocks.length} sessões de 30min
                          </p>
                          {objBlocks.slice(0, isExpanded ? objBlocks.length : 5).map((block: any) => (
                            <div
                              key={block.id}
                              onClick={() => block.status === "scheduled" && router.push(`/block/${block.id}`)}
                              style={{
                                padding: "10px 14px",
                                background: T.surface,
                                border: `1px solid ${block.status === "completed" ? T.green + "33" : T.border}`,
                                borderLeft: `3px solid ${statusColor[block.status] || T.border}`,
                                borderRadius: "8px",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "space-between",
                                cursor: block.status === "scheduled" ? "pointer" : "default",
                                opacity: block.status === "missed" || block.status === "skipped" ? 0.5 : 1,
                              }}
                            >
                              <div style={{ flex: 1 }}>
                                <p style={{ margin: 0, fontSize: "13px", fontWeight: block.status === "scheduled" ? 400 : 300 }}>
                                  {block.status === "completed" && <span style={{ color: T.green, marginRight: "6px" }}>✓</span>}
                                  {block.title}
                                </p>
                                <p style={{ margin: "2px 0 0", fontSize: "11px", color: T.silver }}>{fmt(block.scheduled_at)}</p>
                              </div>
                              {block.status === "scheduled" && (
                                <span style={{ fontSize: "11px", color: T.blue, marginLeft: "8px" }}>Executar →</span>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
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
