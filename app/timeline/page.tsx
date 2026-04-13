// @ts-nocheck
"use client";
import { useEffect, useState, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuthGuard } from "@/lib/auth-guard";

const T = {
  bg: "#0D0D14", card: "#1A1A2E", light: "#E8E4DC", silver: "#6B6B80",
  blue: "#4A6FA5", green: "#2D6A4F", amber: "#C9853A", border: "#252538",
  surface: "#141420", mauve: "#7B5EA7",
};

const SESSION_COLORS: Record<string, string> = {
  learn: T.blue, practice: T.amber, review: T.mauve, test: T.green,
};

const STATUS_STYLE: Record<string, { bg: string; border: string; opacity: number }> = {
  completed: { bg: T.green,   border: T.green,   opacity: 1 },
  scheduled: { bg: T.blue,    border: T.blue,    opacity: 1 },
  active:    { bg: T.amber,   border: T.amber,   opacity: 1 },
  missed:    { bg: T.silver,  border: T.silver,  opacity: 0.4 },
  skipped:   { bg: T.silver,  border: T.silver,  opacity: 0.3 },
};

function getWeekKey(date: Date): string {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - d.getDay() + 1); // Monday
  return d.toISOString().slice(0, 10);
}

function getWeeksRange(blocks: any[]): Date[] {
  if (!blocks.length) return [];
  const dates = blocks.map(b => new Date(b.scheduled_at));
  const min = new Date(Math.min(...dates.map(d => d.getTime())));
  const max = new Date(Math.max(...dates.map(d => d.getTime())));
  // Start from current week or first block, whichever is earlier
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const startDate = min < today ? min : today;
  startDate.setDate(startDate.getDate() - startDate.getDay() + 1);
  max.setDate(max.getDate() + 14); // buffer at end

  const weeks: Date[] = [];
  const cur = new Date(startDate);
  while (cur <= max) {
    weeks.push(new Date(cur));
    cur.setDate(cur.getDate() + 7);
  }
  return weeks;
}

function Tooltip({ block, onClose }: { block: any; onClose: () => void }) {
  const router = useRouter();
  const fmt = (iso: string) => new Date(iso).toLocaleDateString("pt-BR", {
    weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit"
  });
  return (
    <div
      onClick={e => e.stopPropagation()}
      style={{
        position: "fixed", zIndex: 200, background: T.card,
        border: `1px solid ${T.blue}44`, borderRadius: "12px",
        padding: "16px", width: "280px", boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
        left: "50%", top: "50%", transform: "translate(-50%, -50%)",
        fontFamily: "Inter, sans-serif",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
        <span style={{ fontSize: "10px", color: SESSION_COLORS[block.session_type] || T.silver, textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 600 }}>
          {block.session_type || "praticar"}
        </span>
        <button onClick={onClose} style={{ background: "none", border: "none", color: T.silver, cursor: "pointer", fontSize: "16px", lineHeight: 1 }}>×</button>
      </div>
      <p style={{ margin: "0 0 6px", fontSize: "13px", fontWeight: 500, color: T.light, lineHeight: 1.4 }}>{block.title}</p>
      {block.description && <p style={{ margin: "0 0 8px", fontSize: "11px", color: T.silver, lineHeight: 1.5 }}>{block.description}</p>}
      {block.resource_url && (
        <a href={block.resource_url} target="_blank" rel="noopener noreferrer"
          style={{ display: "block", marginBottom: "8px", fontSize: "11px", color: T.blue, textDecoration: "none" }}>
          🔗 {block.resource_name || "Abrir recurso"}
        </a>
      )}
      <p style={{ margin: "0 0 12px", fontSize: "11px", color: T.silver }}>
        {fmt(block.scheduled_at)} · {block.duration_minutes || 30}min
      </p>
      {block.status === "scheduled" && (
        <button
          onClick={() => { onClose(); router.push(`/block/${block.id}`); }}
          style={{ width: "100%", padding: "9px", background: T.blue, border: "none", borderRadius: "7px", color: T.light, fontSize: "12px", fontWeight: 500, cursor: "pointer", fontFamily: "Inter, sans-serif" }}>
          Executar agora →
        </button>
      )}
      {block.status === "completed" && (
        <div style={{ padding: "8px", background: `${T.green}22`, borderRadius: "7px", textAlign: "center", fontSize: "12px", color: T.green }}>✓ Concluído</div>
      )}
    </div>
  );
}

function TimelineContent() {
  const router = useRouter();
  const params = useSearchParams();
  const dreamId = params.get("dreamId");
  useAuthGuard();

  const scrollRef = useRef<HTMLDivElement>(null);
  const [dream, setDream] = useState<any>(null);
  const [objectives, setObjectives] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [tooltip, setTooltip] = useState<any>(null);
  const [todayOffset, setTodayOffset] = useState(0);

  const WEEK_W = 120; // px per week column
  const ROW_H = 56;   // px per objective row

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
      setDream(active);
      if (!dreamId && active) {
        router.replace(`/timeline?dreamId=${active.id}`);
        return;
      }
    }

    if (objRes?.ok) {
      const { objectives: objs } = await objRes.json();
      setObjectives(objs || []);
    }
    setLoading(false);
  }

  // Calcular semanas
  const allBlocks = objectives.flatMap(o => o.blocks || []);
  const weeks = getWeeksRange(allBlocks);

  // Scroll para "hoje" no mount
  useEffect(() => {
    if (!weeks.length || !scrollRef.current) return;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayWeek = new Date(today);
    todayWeek.setDate(todayWeek.getDate() - todayWeek.getDay() + 1);
    const todayIdx = weeks.findIndex(w => getWeekKey(w) === getWeekKey(todayWeek));
    if (todayIdx > 0) {
      const offset = todayIdx * WEEK_W - 40;
      scrollRef.current.scrollLeft = offset;
      setTodayOffset(todayIdx * WEEK_W);
    }
  }, [weeks.length]);

  const fmtWeek = (d: Date) => d.toLocaleDateString("pt-BR", { day: "numeric", month: "short" });
  const fmtMonth = (d: Date) => d.toLocaleDateString("pt-BR", { month: "long" });

  // Stats
  const totalBlocks = allBlocks.length;
  const completed = allBlocks.filter(b => b.status === "completed").length;
  const progress = totalBlocks ? Math.round((completed / totalBlocks) * 100) : 0;

  if (loading) return (
    <div style={{ minHeight: "100vh", background: T.bg, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <p style={{ color: T.silver, fontFamily: "Inter, sans-serif", fontSize: "14px" }}>A construir timeline...</p>
    </div>
  );

  const totalW = weeks.length * WEEK_W;
  const LABEL_W = 200;

  return (
    <div style={{ minHeight: "100vh", background: T.bg, color: T.light, fontFamily: "Inter, sans-serif", display: "flex", flexDirection: "column" }}
      onClick={() => tooltip && setTooltip(null)}>

      {/* Header */}
      <div style={{ borderBottom: `1px solid ${T.border}`, padding: "14px 24px", display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, background: `${T.bg}F8`, backdropFilter: "blur(12px)", zIndex: 100, flexWrap: "wrap", gap: "10px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
          <button onClick={() => router.push("/dashboard")} style={{ background: "none", border: "none", color: T.silver, cursor: "pointer", fontSize: "13px", fontFamily: "Inter, sans-serif" }}>← Dashboard</button>
          <span style={{ color: T.border }}>|</span>
          <div>
            <p style={{ margin: 0, fontSize: "10px", color: T.silver, textTransform: "uppercase", letterSpacing: "0.1em" }}>Timeline</p>
            <p style={{ margin: 0, fontFamily: "'Playfair Display', serif", fontSize: "15px" }}>{dream?.title || "—"}</p>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
          <div style={{ display: "flex", gap: "12px", fontSize: "11px" }}>
            {[
              { color: T.green,  label: "Concluído" },
              { color: T.blue,   label: "Agendado" },
              { color: T.amber,  label: "Em curso" },
              { color: T.silver, label: "Perdido" },
            ].map(l => (
              <div key={l.label} style={{ display: "flex", alignItems: "center", gap: "5px" }}>
                <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: l.color }} />
                <span style={{ color: T.silver }}>{l.label}</span>
              </div>
            ))}
          </div>
          <span style={{ fontSize: "12px", color: T.silver, borderLeft: `1px solid ${T.border}`, paddingLeft: "14px" }}>{completed}/{totalBlocks} · {progress}%</span>
          <button onClick={() => router.push(`/objectives?dreamId=${dreamId}`)} style={{ padding: "6px 12px", background: "transparent", border: `1px solid ${T.border}`, borderRadius: "6px", color: T.silver, fontSize: "11px", cursor: "pointer", fontFamily: "Inter, sans-serif" }}>Lista</button>
        </div>
      </div>

      {/* Timeline */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>

        {/* Labels fixas */}
        <div style={{ width: `${LABEL_W}px`, flexShrink: 0, borderRight: `1px solid ${T.border}`, background: T.bg, zIndex: 50, paddingTop: "68px" }}>
          {objectives.map((obj, i) => {
            const blocks = obj.blocks || [];
            const done = blocks.filter((b: any) => b.status === "completed").length;
            const pct = blocks.length ? Math.round((done / blocks.length) * 100) : 0;
            return (
              <div key={obj.id} style={{ height: `${ROW_H}px`, padding: "0 16px", display: "flex", alignItems: "center", borderBottom: `1px solid ${T.border}`, gap: "10px" }}>
                <div style={{ flex: 1, overflow: "hidden" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "3px" }}>
                    <span style={{ fontSize: "9px", fontFamily: "monospace", color: T.blue, fontWeight: 700 }}>
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <p style={{ margin: 0, fontSize: "12px", fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "140px" }}>
                      {obj.title}
                    </p>
                  </div>
                  <div style={{ height: "2px", background: T.border, borderRadius: "999px", width: "100%" }}>
                    <div style={{ height: "100%", width: `${pct}%`, background: pct === 100 ? T.green : T.blue, borderRadius: "999px" }} />
                  </div>
                </div>
                <span style={{ fontSize: "10px", color: pct === 100 ? T.green : T.silver, flexShrink: 0 }}>{pct}%</span>
              </div>
            );
          })}
        </div>

        {/* Scroll area */}
        <div ref={scrollRef} style={{ flex: 1, overflowX: "auto", overflowY: "hidden", position: "relative", cursor: "grab" }}
          onMouseDown={e => {
            const el = scrollRef.current;
            if (!el) return;
            const startX = e.pageX - el.offsetLeft;
            const scrollLeft = el.scrollLeft;
            const onMove = (ev: MouseEvent) => { el.scrollLeft = scrollLeft - (ev.pageX - el.offsetLeft - startX); };
            const onUp = () => { document.removeEventListener("mousemove", onMove); document.removeEventListener("mouseup", onUp); };
            document.addEventListener("mousemove", onMove);
            document.addEventListener("mouseup", onUp);
          }}>

          <div style={{ width: `${totalW}px`, position: "relative" }}>

            {/* Meses header */}
            <div style={{ height: "28px", display: "flex", borderBottom: `1px solid ${T.border}`, position: "sticky", top: 0, background: T.bg, zIndex: 40 }}>
              {weeks.map((w, i) => {
                const showMonth = i === 0 || w.getMonth() !== weeks[i - 1].getMonth();
                return (
                  <div key={i} style={{ width: `${WEEK_W}px`, flexShrink: 0, display: "flex", alignItems: "center", paddingLeft: "8px", borderRight: i % 4 === 3 ? `1px solid ${T.border}` : "none" }}>
                    {showMonth && <span style={{ fontSize: "10px", color: T.silver, textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 600 }}>{fmtMonth(w)}</span>}
                  </div>
                );
              })}
            </div>

            {/* Semanas header */}
            <div style={{ height: "40px", display: "flex", borderBottom: `1px solid ${T.border}`, position: "sticky", top: "28px", background: T.bg, zIndex: 40 }}>
              {weeks.map((w, i) => {
                const isToday = i * WEEK_W <= todayOffset && todayOffset < (i + 1) * WEEK_W;
                return (
                  <div key={i} style={{ width: `${WEEK_W}px`, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", borderRight: `1px solid ${T.border}`, position: "relative", background: isToday ? `${T.blue}08` : "transparent" }}>
                    {isToday && <div style={{ position: "absolute", top: 0, bottom: 0, left: "50%", width: "1px", background: `${T.blue}66` }} />}
                    <span style={{ fontSize: "10px", color: isToday ? T.blue : T.silver, fontWeight: isToday ? 600 : 400 }}>
                      {fmtWeek(w)}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Grid + blocos */}
            <div style={{ position: "relative" }}>
              {objectives.map((obj, objIdx) => {
                const blocksByWeek: Record<string, any[]> = {};
                (obj.blocks || []).forEach((b: any) => {
                  const wk = getWeekKey(new Date(b.scheduled_at));
                  if (!blocksByWeek[wk]) blocksByWeek[wk] = [];
                  blocksByWeek[wk].push(b);
                });

                return (
                  <div key={obj.id} style={{ height: `${ROW_H}px`, display: "flex", borderBottom: `1px solid ${T.border}22`, position: "relative" }}>
                    {weeks.map((w, wIdx) => {
                      const wk = getWeekKey(w);
                      const blocksInWeek = blocksByWeek[wk] || [];
                      const isToday = wIdx * WEEK_W <= todayOffset && todayOffset < (wIdx + 1) * WEEK_W;

                      return (
                        <div key={wIdx} style={{ width: `${WEEK_W}px`, flexShrink: 0, borderRight: `1px solid ${T.border}22`, position: "relative", background: isToday ? `${T.blue}04` : "transparent", display: "flex", alignItems: "center", justifyContent: "center", gap: "3px", padding: "0 4px", flexWrap: "wrap" }}>
                          {blocksInWeek.slice(0, 8).map((block: any) => {
                            const ss = STATUS_STYLE[block.status] || STATUS_STYLE.scheduled;
                            const isNext = block.status === "scheduled" &&
                              allBlocks.find(b => b.status === "scheduled")?.id === block.id;
                            return (
                              <div
                                key={block.id}
                                onClick={e => { e.stopPropagation(); setTooltip(block); }}
                                title={block.title}
                                style={{
                                  width: isNext ? "14px" : "10px",
                                  height: isNext ? "14px" : "10px",
                                  borderRadius: "50%",
                                  background: ss.bg,
                                  opacity: ss.opacity,
                                  cursor: "pointer",
                                  border: isNext ? `2px solid ${T.light}` : "none",
                                  boxShadow: isNext ? `0 0 6px ${T.blue}88` : "none",
                                  flexShrink: 0,
                                  transition: "transform 150ms ease",
                                }}
                                onMouseEnter={e => { (e.target as HTMLElement).style.transform = "scale(1.4)"; }}
                                onMouseLeave={e => { (e.target as HTMLElement).style.transform = "scale(1)"; }}
                              />
                            );
                          })}
                          {blocksInWeek.length > 8 && (
                            <span style={{ fontSize: "9px", color: T.silver }}>+{blocksInWeek.length - 8}</span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                );
              })}

              {/* Linha de hoje */}
              {todayOffset > 0 && (
                <div style={{ position: "absolute", top: 0, bottom: 0, left: `${todayOffset + WEEK_W / 2}px`, width: "1px", background: `${T.blue}44`, pointerEvents: "none" }}>
                  <div style={{ position: "absolute", top: "8px", left: "-18px", background: T.blue, color: T.light, fontSize: "9px", padding: "2px 6px", borderRadius: "4px", whiteSpace: "nowrap" }}>hoje</div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Tooltip */}
      {tooltip && <Tooltip block={tooltip} onClose={() => setTooltip(null)} />}

      {/* Legenda de sessão */}
      <div style={{ padding: "10px 24px", borderTop: `1px solid ${T.border}`, display: "flex", gap: "20px", background: T.bg }}>
        <span style={{ fontSize: "10px", color: T.silver, textTransform: "uppercase", letterSpacing: "0.06em" }}>Tipo:</span>
        {[
          { color: T.blue,  label: "Aprender" },
          { color: T.amber, label: "Praticar" },
          { color: T.mauve, label: "Rever" },
          { color: T.green, label: "Testar" },
        ].map(l => (
          <div key={l.label} style={{ display: "flex", alignItems: "center", gap: "5px" }}>
            <div style={{ width: "8px", height: "8px", borderRadius: "2px", background: l.color }} />
            <span style={{ fontSize: "11px", color: T.silver }}>{l.label}</span>
          </div>
        ))}
        <span style={{ fontSize: "10px", color: T.silver, marginLeft: "8px" }}>Click num ponto para ver detalhes e executar</span>
      </div>
    </div>
  );
}

export default function TimelinePage() {
  return (
    <Suspense fallback={<div style={{ minHeight: "100vh", background: "#0D0D14" }} />}>
      <TimelineContent />
    </Suspense>
  );
}
