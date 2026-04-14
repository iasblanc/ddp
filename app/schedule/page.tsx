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

const STATUS_COLOR: Record<string, string> = {
  completed: T.green, scheduled: T.blue, active: T.amber,
  missed: T.silver, skipped: T.silver,
};
const SESSION_COLOR: Record<string, string> = {
  learn: T.blue, practice: T.amber, review: T.mauve, test: T.green,
};
const SESSION_LABEL: Record<string, string> = {
  learn: "Aprender", practice: "Praticar", review: "Rever", test: "Testar",
};

const DAYS_PT = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const MONTHS_PT = ["jan","fev","mar","abr","mai","jun","jul","ago","set","out","nov","dez"];

function startOfWeek(d: Date): Date {
  const r = new Date(d);
  r.setHours(0, 0, 0, 0);
  const day = r.getDay();
  r.setDate(r.getDate() - (day === 0 ? 6 : day - 1)); // Monday
  return r;
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

function fmtDay(d: Date) {
  return `${DAYS_PT[d.getDay()]} ${d.getDate()} ${MONTHS_PT[d.getMonth()]}`;
}

function fmtTime(iso: string) {
  // Mostrar em horário local Brasil (UTC-3)
  const d = new Date(iso);
  const local = new Date(d.getTime() - 3 * 3600000);
  return `${String(local.getUTCHours()).padStart(2,"0")}:${String(local.getUTCMinutes()).padStart(2,"0")}`;
}

function isToday(d: Date) {
  const today = new Date();
  return d.getDate() === today.getDate() &&
    d.getMonth() === today.getMonth() &&
    d.getFullYear() === today.getFullYear();
}

function isPast(iso: string) {
  return new Date(iso) < new Date();
}

function ScheduleContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const dreamId = searchParams.get("dreamId");
  useAuthGuard();

  const [dream, setDream] = useState<any>(null);
  const [blocks, setBlocks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [weekStart, setWeekStart] = useState<Date>(() => startOfWeek(new Date()));
  const [rescheduling, setRescheduling] = useState(false);
  const [memory, setMemory] = useState<any>(null);

  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  useEffect(() => { loadData(); }, [dreamId]);

  async function loadData() {
    setLoading(true);
    const [dreamsRes, blocksRes] = await Promise.all([
      fetch("/api/dreams"),
      fetch(`/api/blocks${dreamId ? `?dreamId=${dreamId}` : ""}`)
        .catch(() => null),
    ]);

    if (dreamsRes.ok) {
      const { dreams } = await dreamsRes.json();
      const active = dreamId
        ? dreams?.find((d: any) => d.id === dreamId)
        : dreams?.find((d: any) => d.status === "active");
      setDream(active || null);

      if (!dreamId && active) {
        router.replace(`/schedule?dreamId=${active.id}`);
        return;
      }

      // Buscar memória para obter bestTime e dailyTime
      if (active) {
        const mem = await fetch(`/api/dreams/${active.id}/memory`).then(r => r.json()).catch(() => ({}));
        setMemory(mem.memory);
      }
    }

    // Buscar todos os blocos do sonho via API de objectivos (que inclui blocos)
    if (dreamId) {
      const objRes = await fetch(`/api/objectives?dreamId=${dreamId}`);
      if (objRes.ok) {
        const { objectives } = await objRes.json();
        const allBlocks: any[] = [];
        for (const obj of (objectives || [])) {
          for (const block of (obj.blocks || [])) {
            allBlocks.push({ ...block, objective_title: obj.title, objective_id: obj.id });
          }
        }
        // Blocos gerais (sem objectivo)
        const genRes = await fetch(`/api/blocks?dreamId=${dreamId}&days=180`);
        if (genRes.ok) {
          const { blocks: genBlocks } = await genRes.json();
          for (const b of (genBlocks || [])) {
            if (!allBlocks.find(ab => ab.id === b.id)) {
              allBlocks.push({ ...b, objective_title: "Geral" });
            }
          }
        }
        setBlocks(allBlocks);
      }
    }
    setLoading(false);
  }

  async function rescheduleAll() {
    if (!dreamId || rescheduling) return;
    setRescheduling(true);
    const bestTime  = memory?.execution_profile?.best_time || "manhã";
    const dailyTime = memory?.execution_profile?.declared_times?.[0] || "1 hora";
    const res = await fetch("/api/plan/reschedule-all", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dreamId, bestTime, dailyTime, blocksPerWeek: 3 }),
    });
    if (res.ok) await loadData();
    setRescheduling(false);
  }

  // Agrupar blocos por dia da semana actual
  function blocksForDay(day: Date): any[] {
    const dayKey = day.toISOString().slice(0, 10);
    return blocks
      .filter(b => {
        const bLocal = new Date(new Date(b.scheduled_at).getTime() - 3 * 3600000);
        return bLocal.toISOString().slice(0, 10) === dayKey;
      })
      .sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime());
  }

  // Stats da semana
  const weekBlocks = weekDays.flatMap(d => blocksForDay(d));
  const weekDone   = weekBlocks.filter(b => b.status === "completed").length;
  const weekTotal  = weekBlocks.length;

  // Total geral
  const totalBlocks    = blocks.length;
  const totalCompleted = blocks.filter(b => b.status === "completed").length;
  const totalPct       = totalBlocks ? Math.round((totalCompleted / totalBlocks) * 100) : 0;

  if (loading) return (
    <div style={{ minHeight: "100vh", background: T.bg, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <p style={{ color: T.silver, fontFamily: "Inter, sans-serif", fontSize: "14px" }}>A carregar agenda...</p>
    </div>
  );

  const prevWeek = () => setWeekStart(d => addDays(d, -7));
  const nextWeek = () => setWeekStart(d => addDays(d, +7));
  const goToday  = () => setWeekStart(startOfWeek(new Date()));

  return (
    <div style={{ minHeight: "100vh", background: T.bg, color: T.light, fontFamily: "Inter, sans-serif" }}>

      {/* Header */}
      <div style={{ borderBottom: `1px solid ${T.border}`, padding: "14px 28px", display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, background: `${T.bg}F8`, backdropFilter: "blur(12px)", zIndex: 50, flexWrap: "wrap", gap: "10px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
          <button onClick={() => router.push("/dashboard")} style={{ background: "none", border: "none", color: T.silver, cursor: "pointer", fontSize: "13px", fontFamily: "Inter, sans-serif" }}>← Dashboard</button>
          <span style={{ color: T.border }}>|</span>
          <div>
            <p style={{ margin: 0, fontSize: "10px", color: T.silver, textTransform: "uppercase", letterSpacing: "0.1em" }}>Agenda</p>
            <p style={{ margin: 0, fontFamily: "'Playfair Display', serif", fontSize: "15px" }}>{dream?.title || "—"}</p>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          {/* Progresso geral */}
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <div style={{ width: "80px", height: "3px", background: T.border, borderRadius: "999px" }}>
              <div style={{ height: "100%", width: `${totalPct}%`, background: `linear-gradient(90deg, ${T.blue}, ${T.green})`, borderRadius: "999px" }} />
            </div>
            <span style={{ fontSize: "11px", color: T.silver }}>{totalCompleted}/{totalBlocks}</span>
          </div>
          <button onClick={rescheduleAll} disabled={rescheduling}
            style={{ padding: "6px 12px", background: rescheduling ? T.border : `${T.amber}22`, border: `1px solid ${T.amber}44`, borderRadius: "6px", color: rescheduling ? T.silver : T.amber, fontSize: "11px", cursor: rescheduling ? "default" : "pointer", fontFamily: "Inter, sans-serif" }}>
            {rescheduling ? "Redistribuindo..." : "Redistribuir"}
          </button>
          <button onClick={() => router.push(`/timeline?dreamId=${dreamId}`)}
            style={{ padding: "6px 12px", background: "transparent", border: `1px solid ${T.border}`, borderRadius: "6px", color: T.silver, fontSize: "11px", cursor: "pointer", fontFamily: "Inter, sans-serif" }}>
            Timeline
          </button>
          <button onClick={() => router.push(`/objectives?dreamId=${dreamId}`)}
            style={{ padding: "6px 12px", background: T.blue, border: "none", borderRadius: "6px", color: T.light, fontSize: "11px", fontWeight: 500, cursor: "pointer", fontFamily: "Inter, sans-serif" }}>
            Objetivos
          </button>
        </div>
      </div>

      {/* Navegação de semana */}
      <div style={{ padding: "16px 28px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: `1px solid ${T.border}22` }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <button onClick={prevWeek} style={{ width: "32px", height: "32px", background: T.surface, border: `1px solid ${T.border}`, borderRadius: "8px", color: T.light, cursor: "pointer", fontSize: "14px", display: "flex", alignItems: "center", justifyContent: "center" }}>‹</button>
          <button onClick={nextWeek} style={{ width: "32px", height: "32px", background: T.surface, border: `1px solid ${T.border}`, borderRadius: "8px", color: T.light, cursor: "pointer", fontSize: "14px", display: "flex", alignItems: "center", justifyContent: "center" }}>›</button>
          <button onClick={goToday} style={{ padding: "5px 12px", background: "transparent", border: `1px solid ${T.border}`, borderRadius: "6px", color: T.silver, fontSize: "11px", cursor: "pointer", fontFamily: "Inter, sans-serif" }}>Hoje</button>
          <span style={{ fontSize: "13px", color: T.light, fontWeight: 500 }}>
            {fmtDay(weekStart)} — {fmtDay(addDays(weekStart, 6))}
          </span>
        </div>
        <div style={{ fontSize: "12px", color: T.silver }}>
          {weekTotal > 0 ? `${weekDone}/${weekTotal} esta semana` : "Sem tarefas esta semana"}
        </div>
      </div>

      {/* Grade semanal */}
      <div style={{ padding: "20px 28px" }}>
        {weekDays.map((day, dayIdx) => {
          const dayBlocks = blocksForDay(day);
          const today = isToday(day);
          if (dayBlocks.length === 0 && !today) return null; // Ocultar dias vazios não-hoje

          return (
            <div key={dayIdx} style={{
              marginBottom: "16px",
              background: today ? `${T.blue}06` : T.surface,
              border: `1px solid ${today ? T.blue + "33" : T.border}`,
              borderRadius: "12px",
              overflow: "hidden",
            }}>
              {/* Cabeçalho do dia */}
              <div style={{
                padding: "12px 18px",
                display: "flex", alignItems: "center", justifyContent: "space-between",
                borderBottom: dayBlocks.length > 0 ? `1px solid ${T.border}22` : "none",
                background: today ? `${T.blue}0A` : "transparent",
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  {today && (
                    <span style={{ fontSize: "9px", fontWeight: 700, color: T.blue, letterSpacing: "0.1em", background: `${T.blue}22`, padding: "2px 7px", borderRadius: "4px" }}>HOJE</span>
                  )}
                  <span style={{ fontSize: "14px", fontWeight: today ? 600 : 500, color: today ? T.light : T.light }}>
                    {fmtDay(day)}
                  </span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  {dayBlocks.length > 0 && (
                    <span style={{ fontSize: "11px", color: T.silver }}>
                      {dayBlocks.filter(b => b.status === "completed").length}/{dayBlocks.length} · {dayBlocks.length / 2}h
                    </span>
                  )}
                  {dayBlocks.length === 0 && today && (
                    <span style={{ fontSize: "11px", color: T.silver }}>Sem tarefas hoje</span>
                  )}
                </div>
              </div>

              {/* Tarefas do dia */}
              {dayBlocks.length > 0 && (
                <div style={{ padding: "8px 0" }}>
                  {dayBlocks.map((block, bIdx) => {
                    const isNext = block.status === "scheduled" &&
                      blocks.find(b => b.status === "scheduled")?.id === block.id;
                    const done = block.status === "completed";
                    const missed = block.status === "missed" || block.status === "skipped";
                    const stColor = STATUS_COLOR[block.status] || T.border;
                    const sessColor = SESSION_COLOR[block.session_type] || T.silver;

                    return (
                      <div key={block.id}
                        onClick={() => block.status === "scheduled" && router.push(`/block/${block.id}`)}
                        style={{
                          display: "flex", alignItems: "flex-start", gap: "0",
                          padding: "8px 18px",
                          cursor: block.status === "scheduled" ? "pointer" : "default",
                          opacity: missed ? 0.45 : 1,
                          background: isNext ? `${T.blue}0A` : "transparent",
                          transition: "background 150ms ease",
                          borderTop: bIdx > 0 ? `1px solid ${T.border}18` : "none",
                        }}
                        onMouseEnter={e => { if (block.status === "scheduled") (e.currentTarget as HTMLElement).style.background = `${T.blue}12`; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = isNext ? `${T.blue}0A` : "transparent"; }}
                      >
                        {/* Hora */}
                        <div style={{ minWidth: "52px", flexShrink: 0, paddingTop: "1px" }}>
                          <p style={{ margin: 0, fontSize: "13px", fontWeight: 600, color: done ? T.green : isNext ? T.blue : T.silver, fontFamily: "monospace" }}>
                            {fmtTime(block.scheduled_at)}
                          </p>
                        </div>

                        {/* Linha de cor */}
                        <div style={{ width: "3px", minHeight: "36px", background: stColor, borderRadius: "2px", flexShrink: 0, marginRight: "12px", alignSelf: "stretch" }} />

                        {/* Conteúdo */}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "2px", flexWrap: "wrap" }}>
                            {isNext && <span style={{ fontSize: "9px", fontWeight: 700, color: T.blue, letterSpacing: "0.1em" }}>PRÓXIMA</span>}
                            {block.is_critical && <span style={{ fontSize: "9px", color: T.amber }}>★</span>}
                            <span style={{ fontSize: "10px", color: sessColor, background: `${sessColor}18`, padding: "1px 6px", borderRadius: "3px" }}>
                              {SESSION_LABEL[block.session_type] || "Tarefa"}
                            </span>
                            {done && <span style={{ fontSize: "10px", color: T.green }}>✓ Concluída</span>}
                            {missed && <span style={{ fontSize: "10px", color: T.silver }}>Não realizada</span>}
                          </div>
                          <p style={{ margin: "0 0 2px", fontSize: "13px", fontWeight: isNext ? 500 : 400, lineHeight: 1.4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {block.title}
                          </p>
                          {block.objective_title && (
                            <p style={{ margin: 0, fontSize: "10px", color: T.silver }}>
                              {block.objective_title}
                            </p>
                          )}
                          {block.resource_url && (
                            <a href={block.resource_url} target="_blank" rel="noopener noreferrer"
                              onClick={e => e.stopPropagation()}
                              style={{ display: "inline-flex", alignItems: "center", gap: "3px", fontSize: "10px", color: T.blue, textDecoration: "none", marginTop: "2px" }}>
                              🔗 {block.resource_name || "Recurso"}
                            </a>
                          )}
                        </div>

                        {/* Duração + Executar */}
                        <div style={{ textAlign: "right", flexShrink: 0, paddingLeft: "8px" }}>
                          <p style={{ margin: "0 0 2px", fontSize: "11px", color: T.silver }}>
                            {block.duration_minutes || 30}min
                          </p>
                          {block.status === "scheduled" && (
                            <span style={{ fontSize: "11px", color: T.blue }}>Executar →</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}

        {/* Se a semana inteira está vazia */}
        {weekDays.every(d => blocksForDay(d).length === 0) && (
          <div style={{ textAlign: "center", padding: "48px 0" }}>
            <p style={{ fontFamily: "'Playfair Display', serif", fontSize: "18px", marginBottom: "8px", color: T.silver }}>Sem tarefas nesta semana.</p>
            <div style={{ display: "flex", gap: "10px", justifyContent: "center" }}>
              <button onClick={prevWeek} style={{ padding: "9px 18px", background: "transparent", border: `1px solid ${T.border}`, borderRadius: "8px", color: T.silver, fontSize: "12px", cursor: "pointer", fontFamily: "Inter, sans-serif" }}>
                ← Semana anterior
              </button>
              <button onClick={nextWeek} style={{ padding: "9px 18px", background: T.blue, border: "none", borderRadius: "8px", color: T.light, fontSize: "12px", cursor: "pointer", fontFamily: "Inter, sans-serif" }}>
                Próxima semana →
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function SchedulePage() {
  return (
    <Suspense fallback={<div style={{ minHeight: "100vh", background: "#0D0D14" }} />}>
      <ScheduleContent />
    </Suspense>
  );
}
