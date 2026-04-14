// @ts-nocheck
"use client";
import { useEffect, useState, useRef, useCallback, Suspense } from "react";
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

const DAYS_PT    = ["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"];
const MONTHS_PT  = ["jan","fev","mar","abr","mai","jun","jul","ago","set","out","nov","dez"];
const TZ_OFFSET  = 3; // São Paulo UTC-3

// ── helpers ──────────────────────────────────────────────────────────────────
function toLocal(iso: string): Date {
  return new Date(new Date(iso).getTime() - TZ_OFFSET * 3600000);
}
function toUTC(localDate: Date): string {
  return new Date(localDate.getTime() + TZ_OFFSET * 3600000).toISOString();
}
function startOfWeek(d: Date): Date {
  const r = new Date(d); r.setHours(0,0,0,0);
  r.setDate(r.getDate() - (r.getDay() === 0 ? 6 : r.getDay() - 1));
  return r;
}
function addDays(d: Date, n: number): Date {
  const r = new Date(d); r.setDate(r.getDate() + n); return r;
}
function fmtDate(d: Date) { return `${DAYS_PT[d.getDay()]} ${d.getDate()} ${MONTHS_PT[d.getMonth()]}`; }
function fmtTime(h: number, m: number) {
  return `${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}`;
}
function localHourMin(iso: string): { h: number; m: number } {
  const d = toLocal(iso);
  return { h: d.getUTCHours(), m: d.getUTCMinutes() };
}
function localDayKey(iso: string): string {
  return toLocal(iso).toISOString().slice(0, 10);
}
function isToday(d: Date): boolean {
  const now = new Date();
  return d.getDate()===now.getDate() && d.getMonth()===now.getMonth() && d.getFullYear()===now.getFullYear();
}

function ScheduleContent() {
  const router      = useRouter();
  const searchParams = useSearchParams();
  const dreamId     = searchParams.get("dreamId");
  useAuthGuard();

  const [dream,      setDream]      = useState<any>(null);
  const [blocks,     setBlocks]     = useState<any[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [saving,     setSaving]     = useState<string | null>(null);
  const [weekStart,  setWeekStart]  = useState<Date>(() => startOfWeek(new Date()));
  const [rescheduling, setRescheduling] = useState(false);
  const [memory,     setMemory]     = useState<any>(null);

  // Drag state
  const [dragging,   setDragging]   = useState<string | null>(null); // block id
  const [dragOver,   setDragOver]   = useState<string | null>(null); // "dayKey_HH:MM"
  const dragBlock    = useRef<any>(null);

  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const gridRef = useRef<HTMLDivElement>(null);

  // Scroll para o horário de trabalho ao montar
  useEffect(() => {
    if (!gridRef.current) return;
    const slotHeight = 72;
    const targetSlot = startHour * 2; // cada hora = 2 slots
    const headerOffset = 52 + 10; // header do dia + padding
    gridRef.current.scrollTop = targetSlot * slotHeight - headerOffset;
  }, [loading]);

  useEffect(() => { loadData(); }, [dreamId]);

  async function loadData() {
    setLoading(true);
    const dreamsRes = await fetch("/api/dreams");
    if (dreamsRes.ok) {
      const { dreams } = await dreamsRes.json();
      const active = dreamId
        ? dreams?.find((d: any) => d.id === dreamId)
        : dreams?.find((d: any) => d.status === "active");
      setDream(active || null);
      if (!dreamId && active) { router.replace(`/schedule?dreamId=${active.id}`); return; }
      if (active) {
        const mem = await fetch(`/api/dreams/${active.id}/memory`).then(r=>r.json()).catch(()=>({}));
        setMemory(mem.memory);
      }
    }
    if (dreamId) {
      const objRes = await fetch(`/api/objectives?dreamId=${dreamId}`);
      if (objRes.ok) {
        const { objectives } = await objRes.json();
        const all: any[] = [];
        for (const obj of objectives||[]) {
          for (const b of obj.blocks||[]) {
            all.push({ ...b, objective_title: obj.title });
          }
        }
        // Blocos sem objectivo
        const genRes = await fetch(`/api/blocks?dreamId=${dreamId}&days=365`);
        if (genRes.ok) {
          const { blocks: gb } = await genRes.json();
          for (const b of gb||[]) {
            if (!all.find(x => x.id === b.id)) all.push({ ...b, objective_title: "Geral" });
          }
        }
        setBlocks(all);
      }
    }
    setLoading(false);
  }

  // ── Calcular slots de tempo disponíveis num dia ───────────────────────────
  // 24h completas: 00:00 a 23:30 (48 slots de 30min)
  const timeSlots = Array.from({ length: 48 }, (_, i) => ({
    h: Math.floor(i / 2),
    m: (i % 2) * 30,
  }));
  const startHour = parseStartHour(memory?.execution_profile?.best_time || "manhã");
  const bpd       = parseDailyBlocks(memory?.execution_profile?.declared_times?.[0] || "1 hora");

  // ── Blocos agrupados ──────────────────────────────────────────────────────
  function blocksForSlot(dayKey: string, h: number, m: number): any[] {
    return blocks.filter(b => {
      if (localDayKey(b.scheduled_at) !== dayKey) return false;
      const lhm = localHourMin(b.scheduled_at);
      return lhm.h === h && lhm.m === m;
    });
  }
  function blocksForDay(day: Date): any[] {
    const dayKey = day.toISOString().slice(0,10);
    return blocks
      .filter(b => localDayKey(b.scheduled_at) === dayKey)
      .sort((a,b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime());
  }

  // ── API: actualizar horário de um bloco ───────────────────────────────────
  async function moveBlock(blockId: string, newDayKey: string, h: number, m: number) {
    setSaving(blockId);
    // Construir nova data local → converter para UTC
    const [year, month, day] = newDayKey.split("-").map(Number);
    const localDate = new Date(Date.UTC(year, month-1, day, h, m, 0));
    const utcISO = toUTC(localDate);

    // Optimistic update
    setBlocks(prev => prev.map(b =>
      b.id === blockId ? { ...b, scheduled_at: utcISO } : b
    ));

    try {
      const res = await fetch(`/api/blocks/${blockId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scheduled_at: utcISO }),
      });
      if (!res.ok) {
        // Reverter se falhou
        await loadData();
      }
    } catch {
      await loadData();
    }
    setSaving(null);
  }

  // ── Drag handlers ─────────────────────────────────────────────────────────
  function handleDragStart(e: React.DragEvent, block: any) {
    dragBlock.current = block;
    setDragging(block.id);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", block.id);
  }
  function handleDragEnd() {
    setDragging(null);
    setDragOver(null);
    dragBlock.current = null;
  }
  function handleDragOver(e: React.DragEvent, slotKey: string) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOver(slotKey);
  }
  function handleDragLeave() {
    setDragOver(null);
  }
  function handleDrop(e: React.DragEvent, dayKey: string, h: number, m: number) {
    e.preventDefault();
    setDragOver(null);
    if (!dragBlock.current) return;
    const block = dragBlock.current;
    // Não mover para o mesmo slot
    const currentDayKey = localDayKey(block.scheduled_at);
    const currentHM     = localHourMin(block.scheduled_at);
    if (currentDayKey === dayKey && currentHM.h === h && currentHM.m === m) return;
    moveBlock(block.id, dayKey, h, m);
  }

  // ── Reschedule all ────────────────────────────────────────────────────────
  async function rescheduleAll() {
    if (!dreamId || rescheduling) return;
    setRescheduling(true);
    await fetch("/api/plan/reschedule-all", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        dreamId,
        bestTime:    memory?.execution_profile?.best_time    || "manhã",
        dailyTime:   memory?.execution_profile?.declared_times?.[0] || "1 hora",
        blocksPerWeek: 3,
      }),
    });
    await loadData();
    setRescheduling(false);
  }

  // ── Stats ─────────────────────────────────────────────────────────────────
  const totalBlocks    = blocks.length;
  const totalCompleted = blocks.filter(b => b.status === "completed").length;
  const totalPct       = totalBlocks ? Math.round((totalCompleted/totalBlocks)*100) : 0;
  const weekBlocks     = weekDays.flatMap(d => blocksForDay(d));
  const weekDone       = weekBlocks.filter(b => b.status === "completed").length;

  if (loading) return (
    <div style={{ minHeight:"100vh", background:T.bg, display:"flex", alignItems:"center", justifyContent:"center" }}>
      <p style={{ color:T.silver, fontFamily:"Inter,sans-serif", fontSize:"14px" }}>A carregar agenda...</p>
    </div>
  );

  const hasBlocksThisWeek = weekBlocks.length > 0;

  return (
    <div style={{ minHeight:"100vh", background:T.bg, color:T.light, fontFamily:"Inter,sans-serif" }}>

      {/* Header */}
      <div style={{ borderBottom:`1px solid ${T.border}`, padding:"13px 24px", display:"flex", alignItems:"center", justifyContent:"space-between", position:"sticky", top:0, background:`${T.bg}F8`, backdropFilter:"blur(12px)", zIndex:100, flexWrap:"wrap", gap:"10px" }}>
        <div style={{ display:"flex", alignItems:"center", gap:"14px" }}>
          <button onClick={()=>router.push("/dashboard")} style={{ background:"none", border:"none", color:T.silver, cursor:"pointer", fontSize:"13px", fontFamily:"Inter,sans-serif" }}>← Dashboard</button>
          <span style={{ color:T.border }}>|</span>
          <div>
            <p style={{ margin:0, fontSize:"10px", color:T.silver, textTransform:"uppercase", letterSpacing:"0.1em" }}>Agenda · Arrasta para reagendar</p>
            <p style={{ margin:0, fontFamily:"'Playfair Display',serif", fontSize:"15px" }}>{dream?.title||"—"}</p>
          </div>
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:"8px" }}>
          <div style={{ display:"flex", alignItems:"center", gap:"6px" }}>
            <div style={{ width:"70px", height:"3px", background:T.border, borderRadius:"999px" }}>
              <div style={{ height:"100%", width:`${totalPct}%`, background:`linear-gradient(90deg,${T.blue},${T.green})`, borderRadius:"999px" }} />
            </div>
            <span style={{ fontSize:"11px", color:T.silver }}>{totalCompleted}/{totalBlocks}</span>
          </div>
          <button onClick={rescheduleAll} disabled={rescheduling}
            style={{ padding:"5px 10px", background:rescheduling?T.border:`${T.amber}22`, border:`1px solid ${T.amber}44`, borderRadius:"6px", color:rescheduling?T.silver:T.amber, fontSize:"11px", cursor:rescheduling?"default":"pointer", fontFamily:"Inter,sans-serif" }}>
            {rescheduling?"Redistribuindo...":"Redistribuir"}
          </button>
          <button onClick={()=>router.push(`/timeline?dreamId=${dreamId}`)}
            style={{ padding:"5px 10px", background:"transparent", border:`1px solid ${T.border}`, borderRadius:"6px", color:T.silver, fontSize:"11px", cursor:"pointer", fontFamily:"Inter,sans-serif" }}>Timeline</button>
          <button onClick={()=>router.push(`/objectives?dreamId=${dreamId}`)}
            style={{ padding:"5px 10px", background:T.blue, border:"none", borderRadius:"6px", color:T.light, fontSize:"11px", fontWeight:500, cursor:"pointer", fontFamily:"Inter,sans-serif" }}>Objetivos</button>
        </div>
      </div>

      {/* Navegação de semana */}
      <div style={{ padding:"12px 24px", display:"flex", alignItems:"center", gap:"10px", borderBottom:`1px solid ${T.border}22` }}>
        <button onClick={()=>setWeekStart(d=>addDays(d,-7))} style={{ width:"30px", height:"30px", background:T.surface, border:`1px solid ${T.border}`, borderRadius:"6px", color:T.light, cursor:"pointer", fontSize:"14px", display:"flex", alignItems:"center", justifyContent:"center" }}>‹</button>
        <button onClick={()=>setWeekStart(d=>addDays(d,+7))} style={{ width:"30px", height:"30px", background:T.surface, border:`1px solid ${T.border}`, borderRadius:"6px", color:T.light, cursor:"pointer", fontSize:"14px", display:"flex", alignItems:"center", justifyContent:"center" }}>›</button>
        <button onClick={()=>setWeekStart(startOfWeek(new Date()))} style={{ padding:"4px 10px", background:"transparent", border:`1px solid ${T.border}`, borderRadius:"6px", color:T.silver, fontSize:"11px", cursor:"pointer", fontFamily:"Inter,sans-serif" }}>Hoje</button>
        <span style={{ fontSize:"13px", fontWeight:500 }}>{fmtDate(weekStart)} — {fmtDate(addDays(weekStart,6))}</span>
        <span style={{ fontSize:"11px", color:T.silver, marginLeft:"auto" }}>
          {weekDone}/{weekBlocks.length} esta semana
          {saving && <span style={{ color:T.amber, marginLeft:"8px" }}>A guardar...</span>}
        </span>
      </div>

      {/* Grade semanal — 7 colunas, scroll vertical para 24h */}
      <div ref={gridRef} style={{ overflowX:"auto", overflowY:"auto", maxHeight:"calc(100vh - 120px)" }}>
        <div style={{ display:"grid", gridTemplateColumns:`60px repeat(7,1fr)`, minWidth:"900px", padding:"0 24px 32px" }}>

          {/* Coluna de horas */}
          <div style={{ paddingTop:"52px", position:"sticky", left:0, background:T.bg, zIndex:20 }}>
            {timeSlots.map(({h,m},i) => (
              <div key={i} style={{ height:"72px", display:"flex", alignItems:"flex-start", paddingTop:"6px", paddingRight:"8px", justifyContent:"flex-end" }}>
                <span style={{ fontSize:"11px", color:T.silver, fontFamily:"monospace" }}>{fmtTime(h,m)}</span>
              </div>
            ))}

          </div>

          {/* Colunas dos dias */}
          {weekDays.map((day, dayIdx) => {
            const dayKey  = day.toISOString().slice(0,10);
            const today   = isToday(day);
            const weekend = day.getDay() === 0 || day.getDay() === 6;
            const dayBlocksAll = blocksForDay(day);

            return (
              <div key={dayIdx} style={{ borderLeft:`1px solid ${T.border}22`, background: today ? `${T.blue}04` : "transparent" }}>

                {/* Cabeçalho do dia — sticky */}
                <div style={{ padding:"10px 6px 8px", textAlign:"center", borderBottom:`1px solid ${T.border}22`, minHeight:"48px", position:"sticky", top:0, background: today ? `${T.card}` : T.bg, zIndex:10 }}>
                  <p style={{ margin:"0 0 2px", fontSize:"11px", color: today ? T.blue : weekend ? T.silver+"88" : T.silver, fontWeight: today ? 700 : 400, textTransform:"uppercase", letterSpacing:"0.06em" }}>
                    {DAYS_PT[day.getDay()]}
                  </p>
                  <p style={{ margin:0, fontSize:"16px", fontWeight: today ? 700 : 400, color: today ? T.blue : weekend ? T.silver+"66" : T.light }}>
                    {day.getDate()}
                  </p>
                  {today && <div style={{ width:"4px", height:"4px", borderRadius:"50%", background:T.blue, margin:"4px auto 0" }} />}
                </div>

                {/* Slots de tempo */}
                {timeSlots.map(({h,m}, sIdx) => {
                  const slotKey   = `${dayKey}_${fmtTime(h,m)}`;
                  const slotBlocks = blocksForSlot(dayKey, h, m);
                  const isOver    = dragOver === slotKey;
                  const isDraggingAny = !!dragging;

                  return (
                    <div key={sIdx}
                      onDragOver={e => handleDragOver(e, slotKey)}
                      onDragLeave={handleDragLeave}
                      onDrop={e => handleDrop(e, dayKey, h, m)}
                      style={{
                        height:"72px",
                        borderBottom:`1px solid ${T.border}14`,
                        padding:"3px 4px",
                        background: isOver
                          ? `${T.blue}20`
                          : isDraggingAny && slotBlocks.length === 0
                          ? `${T.blue}04`
                          : (h >= startHour && h < startHour + Math.ceil(bpd / 2) && !weekend)
                          ? `${T.blue}03`
                          : "transparent",
                        transition:"background 100ms ease",
                        position:"relative",
                        outline: isOver ? `2px dashed ${T.blue}66` : "none",
                        outlineOffset:"-2px",
                        borderRadius: isOver ? "4px" : "0",
                      }}>

                      {slotBlocks.map(block => (
                        <TaskCard
                          key={block.id}
                          block={block}
                          isDragging={dragging === block.id}
                          isSaving={saving === block.id}
                          onDragStart={handleDragStart}
                          onDragEnd={handleDragEnd}
                          onClick={() => block.status === "scheduled" && router.push(`/block/${block.id}`)}
                        />
                      ))}

                      {/* Indicador de drop */}
                      {isOver && slotBlocks.length === 0 && (
                        <div style={{ position:"absolute", inset:"4px", border:`1.5px dashed ${T.blue}88`, borderRadius:"6px", display:"flex", alignItems:"center", justifyContent:"center", pointerEvents:"none" }}>
                          <span style={{ fontSize:"10px", color:T.blue, fontWeight:500 }}>Soltar aqui</span>
                        </div>
                      )}
                    </div>
                  );
                })}

  
              </div>
            );
          })}
        </div>
      </div>

      {/* Sem blocos esta semana */}
      {!hasBlocksThisWeek && (
        <div style={{ textAlign:"center", padding:"32px 0", color:T.silver }}>
          <p style={{ fontSize:"14px", marginBottom:"12px" }}>Sem tarefas nesta semana.</p>
          <div style={{ display:"flex", gap:"8px", justifyContent:"center" }}>
            <button onClick={()=>setWeekStart(d=>addDays(d,-7))} style={{ padding:"8px 16px", background:"transparent", border:`1px solid ${T.border}`, borderRadius:"7px", color:T.silver, fontSize:"12px", cursor:"pointer", fontFamily:"Inter,sans-serif" }}>← Anterior</button>
            <button onClick={()=>setWeekStart(d=>addDays(d,+7))} style={{ padding:"8px 16px", background:T.blue, border:"none", borderRadius:"7px", color:T.light, fontSize:"12px", cursor:"pointer", fontFamily:"Inter,sans-serif" }}>Próxima →</button>
          </div>
        </div>
      )}

      {/* Legenda */}
      <div style={{ padding:"12px 24px 24px", display:"flex", gap:"16px", alignItems:"center", flexWrap:"wrap" }}>
        <span style={{ fontSize:"10px", color:T.silver, textTransform:"uppercase", letterSpacing:"0.07em" }}>Tip: Arrasta os cartões para mover</span>
        {[
          { color:T.blue,  label:"Agendada" },
          { color:T.green, label:"Concluída" },
          { color:T.amber, label:"Em curso" },
          { color:T.silver,label:"Perdida" },
        ].map(l => (
          <div key={l.label} style={{ display:"flex", alignItems:"center", gap:"5px" }}>
            <div style={{ width:"8px", height:"8px", borderRadius:"2px", background:l.color }} />
            <span style={{ fontSize:"11px", color:T.silver }}>{l.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TASK CARD — Componente arrastável
// ─────────────────────────────────────────────────────────────────────────────
function TaskCard({ block, isDragging, isSaving, onDragStart, onDragEnd, onClick }: {
  block: any; isDragging: boolean; isSaving: boolean;
  onDragStart: (e: any, b: any) => void;
  onDragEnd: () => void;
  onClick: () => void;
}) {
  const done    = block.status === "completed";
  const missed  = block.status === "missed" || block.status === "skipped";
  const stColor = STATUS_COLOR[block.status] || T.border;
  const sessColor = SESSION_COLOR[block.session_type] || T.silver;
  const canDrag = !done && !missed;

  return (
    <div
      draggable={canDrag}
      onDragStart={e => canDrag && onDragStart(e, block)}
      onDragEnd={onDragEnd}
      onClick={onClick}
      title={block.title}
      style={{
        background: isDragging ? `${T.blue}33` : done ? `${T.green}18` : T.card,
        border: `1px solid ${isDragging ? T.blue : stColor}44`,
        borderLeft: `3px solid ${stColor}`,
        borderRadius: "6px",
        padding: "3px 6px",
        marginBottom: "2px",
        cursor: canDrag ? "grab" : done ? "default" : "pointer",
        opacity: isDragging ? 0.5 : missed ? 0.4 : 1,
        transform: isDragging ? "scale(0.97)" : "scale(1)",
        transition: "opacity 150ms ease, transform 150ms ease",
        userSelect: "none",
        position: "relative",
        overflow: "hidden",
      }}>

      {/* Linha superior: tipo + status */}
      <div style={{ display:"flex", alignItems:"center", gap:"3px", marginBottom:"1px" }}>
        <span style={{ fontSize:"8px", color:sessColor, background:`${sessColor}18`, padding:"0 4px", borderRadius:"2px", flexShrink:0 }}>
          {SESSION_LABEL[block.session_type]?.[0] || "T"}
        </span>
        {done && <span style={{ fontSize:"8px", color:T.green }}>✓</span>}
        {isSaving && <span style={{ fontSize:"8px", color:T.amber }}>⟳</span>}
        {canDrag && !isDragging && (
          <span style={{ fontSize:"9px", color:T.border, marginLeft:"auto" }}>⠿</span>
        )}
      </div>

      {/* Título */}
      <p style={{
        margin:0, fontSize:"10px", lineHeight:1.3,
        color: done ? T.green : T.light,
        overflow:"hidden", textOverflow:"ellipsis",
        display:"-webkit-box", WebkitLineClamp:2, WebkitBoxOrient:"vertical",
        fontWeight: block.is_critical ? 600 : 400,
      }}>
        {block.title}
      </p>

      {/* Objectivo */}
      {block.objective_title && (
        <p style={{ margin:"1px 0 0", fontSize:"9px", color:T.silver, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
          {block.objective_title}
        </p>
      )}
    </div>
  );
}

// ── utilitários ──────────────────────────────────────────────────────────────
function parseDailyBlocks(t: string): number {
  if (!t) return 2;
  const s = t.toLowerCase();
  const h = s.match(/(\d+(?:[.,]\d+)?)\s*h/);
  if (h) return Math.min(6, Math.max(1, Math.floor(parseFloat(h[1].replace(",",".")) * 2)));
  const m = s.match(/(\d+)\s*min/);
  if (m) return Math.min(4, Math.max(1, Math.floor(parseInt(m[1]) / 30)));
  if (s.includes("1 hora") || s.includes("uma hora")) return 2;
  if (s.includes("2 horas")) return 4;
  return 2;
}
function parseStartHour(t: string): number {
  const s = (t||"").toLowerCase();
  if (s.includes("manhã")||s.includes("manha")) return 7;
  if (s.includes("tarde")) return 14;
  if (s.includes("noite")) return 19;
  const m = s.match(/(\d{1,2})(?:h|:)/);
  return m ? parseInt(m[1]) : 9;
}

export default function SchedulePage() {
  return (
    <Suspense fallback={<div style={{ minHeight:"100vh", background:"#0D0D14" }} />}>
      <ScheduleContent />
    </Suspense>
  );
}
