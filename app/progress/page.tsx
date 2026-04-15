// @ts-nocheck
"use client";
import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuthGuard } from "@/lib/auth-guard";

// ── Tokens ───────────────────────────────────────────────────────────────────
const T = {
  bg:"#0D0D14", surface:"#141420", card:"#1A1A2E", light:"#E8E4DC",
  silver:"#6B6B80", dim:"#252538", blue:"#4A6FA5", green:"#2D6A4F",
  amber:"#C9853A", mauve:"#7B5EA7", border:"#252538",
  blueGlow:"rgba(74,111,165,0.15)", greenGlow:"rgba(45,106,79,0.15)",
};

// ── Helpers ───────────────────────────────────────────────────────────────────
const MONTHS = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
const DAYS   = ["D","S","T","Q","Q","S","S"];

function fmtHours(h: number) { return h >= 1 ? `${h}h` : `${Math.round(h*60)}min`; }
function fmtDays(d: number)  { return d === 1 ? "1 dia" : `${d} dias`; }
function lerp(a: number, b: number, t: number) { return a + (b - a) * t; }

// ── SVG Components ────────────────────────────────────────────────────────────

// Anel de progresso animado
function Ring({ pct, size=140, stroke=10, color=T.blue, label="", sublabel="" }: any) {
  const r = (size - stroke * 2) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (pct / 100) * circ;
  const [animated, setAnimated] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => setAnimated(pct), 100);
    return () => clearTimeout(t);
  }, [pct]);
  const animOffset = circ - (animated / 100) * circ;

  return (
    <div style={{ position:"relative", width:size, height:size, flexShrink:0 }}>
      <svg width={size} height={size} style={{ transform:"rotate(-90deg)" }}>
        {/* Track */}
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={T.dim} strokeWidth={stroke} />
        {/* Glow */}
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color}
          strokeWidth={stroke+4} strokeDasharray={circ} strokeDashoffset={animOffset}
          strokeLinecap="round" opacity={0.15}
          style={{ transition:"stroke-dashoffset 1.2s cubic-bezier(0.4,0,0.2,1)" }} />
        {/* Fill */}
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color}
          strokeWidth={stroke} strokeDasharray={circ} strokeDashoffset={animOffset}
          strokeLinecap="round"
          style={{ transition:"stroke-dashoffset 1.2s cubic-bezier(0.4,0,0.2,1)" }} />
      </svg>
      <div style={{ position:"absolute", inset:0, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", textAlign:"center" }}>
        <p style={{ margin:0, fontSize:size*0.17, fontWeight:700, color, fontFamily:"monospace", lineHeight:1 }}>{label}</p>
        {sublabel && <p style={{ margin:"3px 0 0", fontSize:size*0.08, color:T.silver, lineHeight:1.2 }}>{sublabel}</p>}
      </div>
    </div>
  );
}

// Gráfico de barras semanal (SVG)
function WeeklyChart({ done, planned }: { done:number[]; planned:number[] }) {
  const weeks = done.length;
  const maxVal = Math.max(...planned, 1);
  const W = 520, H = 120, BAR_W = Math.floor(W / weeks) - 6, PAD = 3;

  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H+24}`} style={{ overflow:"visible" }}>
      {/* Linha de guia */}
      {[0, Math.ceil(maxVal/2), maxVal].map((v,i) => {
        const y = H - (v/maxVal)*H;
        return (
          <g key={i}>
            <line x1={0} y1={y} x2={W} y2={y} stroke={T.dim} strokeWidth={0.5} strokeDasharray="4 4" />
            <text x={-4} y={y+4} textAnchor="end" fontSize={9} fill={T.silver}>{v}</text>
          </g>
        );
      })}
      {done.map((d, i) => {
        const x = i * (W/weeks) + PAD;
        const hPlanned = planned[i] ? (planned[i]/maxVal)*H : 0;
        const hDone    = d ? (d/maxVal)*H : 0;
        const isRecent = i >= weeks-2;
        const label    = i === weeks-1 ? "Hoje" : i === weeks-2 ? "-1s" : i === weeks-4 ? "-1m" : "";
        return (
          <g key={i}>
            {/* Barra planeada (fundo) */}
            {hPlanned > 0 && (
              <rect x={x} y={H-hPlanned} width={BAR_W} height={hPlanned}
                rx={3} fill={T.dim} opacity={0.6} />
            )}
            {/* Barra concluída (frente) */}
            {hDone > 0 && (
              <rect x={x} y={H-hDone} width={BAR_W} height={hDone}
                rx={3} fill={isRecent ? T.blue : T.green} opacity={0.85} />
            )}
            {/* Label */}
            {label && (
              <text x={x + BAR_W/2} y={H+16} textAnchor="middle" fontSize={9} fill={T.silver}>{label}</text>
            )}
          </g>
        );
      })}
      {/* Legenda */}
      <g transform={`translate(${W-120}, ${H+18})`}>
        <rect x={0} y={-6} width={10} height={10} rx={2} fill={T.green} />
        <text x={14} y={4} fontSize={9} fill={T.silver}>Concluído</text>
        <rect x={70} y={-6} width={10} height={10} rx={2} fill={T.dim} opacity={0.6} />
        <text x={84} y={4} fontSize={9} fill={T.silver}>Planeado</text>
      </g>
    </svg>
  );
}

// Heatmap estilo GitHub (12 semanas)
function Heatmap({ heatmap }: { heatmap: Record<string,number> }) {
  const days = Object.entries(heatmap).sort(([a],[b]) => a > b ? 1 : -1);
  const maxVal = Math.max(...days.map(([,v])=>v), 1);

  // Organizar em semanas (colunas)
  const weeks: Array<Array<{ key:string; val:number }>> = [];
  let week: Array<{ key:string; val:number }> = [];

  // Preencher até termos múltiplo de 7 desde domingo
  const firstDate = new Date(days[0]?.[0] || new Date());
  const startPad  = firstDate.getDay(); // dia da semana do primeiro dia (0=Dom)
  for (let i = 0; i < startPad; i++) week.push({ key:"", val:0 });

  for (const [key, val] of days) {
    week.push({ key, val });
    if (week.length === 7) { weeks.push(week); week = []; }
  }
  if (week.length) { while (week.length < 7) week.push({ key:"", val:0 }); weeks.push(week); }

  const CELL = 12, GAP = 3, W_TOTAL = (CELL+GAP)*weeks.length;

  function color(val: number): string {
    if (!val) return T.surface;
    const t = val / maxVal;
    if (t < 0.33) return `${T.green}55`;
    if (t < 0.66) return `${T.green}99`;
    return T.green;
  }

  return (
    <div style={{ overflowX:"auto" }}>
      <div style={{ display:"flex", gap:"3px", alignItems:"flex-start" }}>
        {/* Labels dias */}
        <div style={{ display:"flex", flexDirection:"column", gap:GAP+"px", paddingTop:"16px", flexShrink:0 }}>
          {DAYS.map((d,i) => (
            <div key={i} style={{ height:CELL, display:"flex", alignItems:"center" }}>
              <span style={{ fontSize:"8px", color:i%2===0?T.silver:"transparent", width:"10px" }}>{d}</span>
            </div>
          ))}
        </div>
        {/* Colunas de semanas */}
        <div style={{ display:"flex", gap:GAP+"px", flexDirection:"row" }}>
          {weeks.map((wk, wi) => {
            // Label do mês na primeira semana de cada mês
            const firstReal = wk.find(d=>d.key);
            const showMonth = firstReal && (wi===0 || new Date(firstReal.key).getDate() <= 7);
            const monthLabel = firstReal ? MONTHS[new Date(firstReal.key).getMonth()] : "";
            return (
              <div key={wi} style={{ display:"flex", flexDirection:"column", gap:GAP+"px" }}>
                <div style={{ height:"14px", display:"flex", alignItems:"center" }}>
                  {showMonth && <span style={{ fontSize:"8px", color:T.silver, whiteSpace:"nowrap" }}>{monthLabel}</span>}
                </div>
                {wk.map((day, di) => (
                  <div key={di} title={day.key ? `${day.key}: ${day.val} blocos` : ""}
                    style={{ width:CELL, height:CELL, borderRadius:"2px", background:day.key?color(day.val):T.surface, opacity:day.key?1:0.3 }} />
                ))}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// Barra horizontal de progresso por objectivo
function ObjBar({ obj, max }: { obj:any; max:number }) {
  const [animated, setAnimated] = useState(0);
  useEffect(() => { const t = setTimeout(()=>setAnimated(obj.pct), 200+obj.order*80); return ()=>clearTimeout(t); }, [obj.pct]);
  const barColor = obj.pct === 100 ? T.green : obj.pct > 0 ? T.blue : T.dim;

  return (
    <div style={{ marginBottom:"10px" }}>
      <div style={{ display:"flex", justifyContent:"space-between", marginBottom:"4px" }}>
        <p style={{ margin:0, fontSize:"12px", color: obj.pct===100?T.green:T.light, fontWeight: obj.pct>0?500:400, maxWidth:"72%", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
          {obj.pct===100 && "✓ "}{obj.title}
        </p>
        <span style={{ fontSize:"11px", color:barColor, fontFamily:"monospace", fontWeight:600 }}>{obj.pct}%</span>
      </div>
      <div style={{ height:"5px", background:T.dim, borderRadius:"999px", overflow:"hidden" }}>
        <div style={{ height:"100%", width:`${animated}%`, background:barColor, borderRadius:"999px",
          transition:"width 0.9s cubic-bezier(0.4,0,0.2,1)", boxShadow: obj.pct>0?`0 0 8px ${barColor}66`:"none" }} />
      </div>
      <p style={{ margin:"2px 0 0", fontSize:"10px", color:T.silver }}>{obj.done}/{obj.total} blocos</p>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
function ProgressContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const dreamId = searchParams.get("dreamId");
  useAuthGuard();

  const [data,    setData]    = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [dreamInfo, setDreamInfo] = useState<any>(null);

  useEffect(() => { loadProgress(); }, [dreamId]);

  async function loadProgress() {
    setLoading(true);
    // Buscar sonho activo se não tiver dreamId
    let id = dreamId;
    if (!id) {
      const dr = await fetch("/api/dreams").then(r=>r.json()).catch(()=>({}));
      const active = dr.dreams?.find((d:any)=>d.status==="active");
      if (active) { id = active.id; setDreamInfo(active); router.replace(`/progress?dreamId=${id}`); }
    } else {
      const dr = await fetch("/api/dreams").then(r=>r.json()).catch(()=>({}));
      setDreamInfo(dr.dreams?.find((d:any)=>d.id===id));
    }
    if (id) {
      const res = await fetch(`/api/progress?dreamId=${id}`);
      if (res.ok) setData(await res.json());
    }
    setLoading(false);
  }

  if (loading) return (
    <div style={{ minHeight:"100vh", background:T.bg, display:"flex", alignItems:"center", justifyContent:"center" }}>
      <p style={{ fontFamily:"'Playfair Display',serif", fontSize:"18px", color:T.silver }}>A calcular a sua jornada...</p>
    </div>
  );

  if (!data) return (
    <div style={{ minHeight:"100vh", background:T.bg, display:"flex", alignItems:"center", justifyContent:"center" }}>
      <p style={{ color:T.silver, fontFamily:"Inter,sans-serif" }}>Sem dados disponíveis.</p>
    </div>
  );

  const { summary, heatmap, weekly, objectives, byType, milestones, dream } = data;
  const nextMilestone = milestones.find((m:any) => !m.reached);
  const maxObjTotal   = Math.max(...objectives.map((o:any)=>o.total), 1);

  // Cor do "ânimo" baseada no progresso
  const moodColor = summary.pct >= 75 ? T.green : summary.pct >= 30 ? T.blue : summary.pct > 0 ? T.amber : T.silver;
  const moodLabel = summary.pct >= 75 ? "Quase lá." : summary.pct >= 50 ? "Mais da metade." : summary.pct >= 25 ? "Tração real." : summary.pct > 0 ? "A jornada começou." : "O primeiro passo está à espera.";

  const daysLabel = dream?.activated_at
    ? `Dia ${summary.daysActive} da jornada`
    : "Jornada em curso";

  // Tipo de sessão labels
  const typeLabels: Record<string,string> = { learn:"Aprender", practice:"Praticar", review:"Rever", test:"Testar" };
  const typeColors: Record<string,string> = { learn:T.blue, practice:T.amber, review:T.mauve, test:T.green };
  const totalByType = Object.values(byType as Record<string,number>).reduce((a:number,b:number)=>a+b, 0) || 1;

  return (
    <div style={{ minHeight:"100vh", background:T.bg, color:T.light, fontFamily:"Inter,sans-serif" }}>

      {/* Header */}
      <header style={{ borderBottom:`1px solid ${T.border}`, padding:"12px 28px", display:"flex", alignItems:"center", justifyContent:"space-between", position:"sticky", top:0, background:`${T.bg}F2`, backdropFilter:"blur(16px)", zIndex:60, flexWrap:"wrap", gap:"8px" }}>
        <div style={{ display:"flex", alignItems:"center", gap:"14px" }}>
          <button onClick={()=>router.push("/dashboard")} style={{ background:"none", border:"none", color:T.silver, cursor:"pointer", fontSize:"13px", fontFamily:"Inter,sans-serif" }}>← Dashboard</button>
          <div>
            <p style={{ margin:0, fontSize:"10px", color:T.silver, textTransform:"uppercase", letterSpacing:"0.1em" }}>Progresso · {daysLabel}</p>
            <p style={{ margin:0, fontFamily:"'Playfair Display',serif", fontSize:"15px" }}>{dream?.title || dreamInfo?.title}</p>
          </div>
        </div>
        <div style={{ display:"flex", gap:"6px" }}>
          {dreamId && [
            { label:"Agenda",    path:`/schedule?dreamId=${dreamId}` },
            { label:"Objetivos", path:`/objectives?dreamId=${dreamId}` },
          ].map(n=>(
            <button key={n.label} onClick={()=>router.push(n.path)}
              style={{ padding:"6px 12px", background:"transparent", border:`1px solid ${T.border}`, borderRadius:"7px", color:T.silver, fontSize:"12px", cursor:"pointer", fontFamily:"Inter,sans-serif" }}>
              {n.label}
            </button>
          ))}
        </div>
      </header>

      <div style={{ maxWidth:"1100px", margin:"0 auto", padding:"28px 28px 48px" }}>

        {/* ── HERO — Visão geral ─────────────────────────────────────────────── */}
        <div style={{ display:"grid", gridTemplateColumns:"auto 1fr", gap:"28px", alignItems:"center", marginBottom:"28px", padding:"28px 32px", background:T.card, borderRadius:"16px", border:`1px solid ${T.border}`, position:"relative", overflow:"hidden" }}>
          {/* Gradient de fundo */}
          <div style={{ position:"absolute", top:0, right:0, width:"300px", height:"100%", background:`linear-gradient(135deg, transparent, ${moodColor}08)`, pointerEvents:"none" }} />

          <Ring pct={summary.pct} size={160} stroke={12} color={moodColor}
            label={`${summary.pct}%`} sublabel="concluído" />

          <div>
            <p style={{ margin:"0 0 6px", fontSize:"22px", fontFamily:"'Playfair Display',serif", fontWeight:400, color:moodColor, lineHeight:1.2 }}>
              {moodLabel}
            </p>
            <p style={{ margin:"0 0 20px", fontSize:"13px", color:T.silver, lineHeight:1.6 }}>
              {summary.done > 0
                ? `Você investiu ${fmtHours(summary.hours)} em ${summary.done} bloco${summary.done!==1?"s":""} de trabalho focado.`
                : "O primeiro bloco vai transformar isso em realidade."}
              {summary.projectedDays && ` Ao ritmo atual, concluirá em ~${fmtDays(summary.projectedDays)}.`}
            </p>

            {/* 4 métricas */}
            <div style={{ display:"grid", gridTemplateColumns:"repeat(4, 1fr)", gap:"10px" }}>
              {[
                { val:`${fmtHours(summary.hours)}`,        label:"investidas",    color:T.blue,  sub:"horas" },
                { val:`${summary.done}`,                   label:"blocos feitos", color:T.green, sub:"" },
                { val:summary.streak > 0 ? `${summary.streak}d` : "—", label:"streak atual",  color:T.amber, sub:"" },
                { val:summary.velocity > 0 ? `${summary.velocity}/s` : "—", label:"blocos/semana", color:T.mauve, sub:"" },
              ].map((m,i)=>(
                <div key={i} style={{ padding:"12px 14px", background:T.surface, borderRadius:"10px", borderTop:`2px solid ${m.color}` }}>
                  <p style={{ margin:"0 0 2px", fontSize:"22px", fontWeight:700, color:m.color, fontFamily:"monospace", lineHeight:1 }}>{m.val}</p>
                  <p style={{ margin:0, fontSize:"10px", color:T.silver, lineHeight:1.3 }}>{m.label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── PRÓXIMO MARCO ─────────────────────────────────────────────────── */}
        {nextMilestone && (
          <div style={{ marginBottom:"20px", padding:"14px 20px", background:`${T.amber}0A`, border:`1px solid ${T.amber}33`, borderRadius:"12px", display:"flex", alignItems:"center", gap:"16px" }}>
            <div style={{ fontSize:"28px", flexShrink:0 }}>🏁</div>
            <div style={{ flex:1 }}>
              <p style={{ margin:"0 0 2px", fontSize:"12px", color:T.amber, fontWeight:600, textTransform:"uppercase", letterSpacing:"0.07em" }}>Próximo marco — {nextMilestone.pct}%</p>
              <p style={{ margin:0, fontSize:"13px", color:T.light, lineHeight:1.5 }}>
                {nextMilestone.blocksNeeded > 0
                  ? `Faltam ${nextMilestone.blocksNeeded} bloco${nextMilestone.blocksNeeded!==1?"s":""} para atingir ${nextMilestone.pct}% do sonho.`
                  : `Marco de ${nextMilestone.pct}% a ser atingido agora.`}
              </p>
            </div>
            <div style={{ textAlign:"right", flexShrink:0 }}>
              <p style={{ margin:"0 0 1px", fontSize:"28px", fontWeight:700, color:T.amber, fontFamily:"monospace" }}>{nextMilestone.pct}%</p>
              <p style={{ margin:0, fontSize:"10px", color:T.silver }}>meta</p>
            </div>
          </div>
        )}

        {/* ── LINHA DO TEMPO DOS MARCOS ─────────────────────────────────────── */}
        <div style={{ marginBottom:"24px", padding:"18px 22px", background:T.card, borderRadius:"14px", border:`1px solid ${T.border}` }}>
          <p style={{ margin:"0 0 14px", fontSize:"11px", color:T.silver, textTransform:"uppercase", letterSpacing:"0.1em" }}>Milestones do sonho</p>
          <div style={{ display:"flex", alignItems:"center", gap:0, position:"relative" }}>
            {/* Linha de fundo */}
            <div style={{ position:"absolute", top:"12px", left:"12px", right:"12px", height:"2px", background:T.dim }} />
            {/* Linha de progresso */}
            <div style={{ position:"absolute", top:"12px", left:"12px", width:`${Math.min(summary.pct, 99)}%`, height:"2px", background:`linear-gradient(90deg, ${T.green}, ${T.blue})`, transition:"width 1s ease" }} />
            {milestones.map((m:any, i:number) => (
              <div key={i} style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", zIndex:1 }}>
                <div style={{ width:"24px", height:"24px", borderRadius:"50%", background: m.reached ? (m.pct===100?T.green:T.blue) : T.surface, border:`2px solid ${m.reached?(m.pct===100?T.green:T.blue):T.dim}`, display:"flex", alignItems:"center", justifyContent:"center", marginBottom:"6px", transition:"all 400ms ease", boxShadow: m.reached?`0 0 12px ${m.pct===100?T.green:T.blue}55`:"none" }}>
                  {m.reached && <span style={{ fontSize:"10px", color:T.light }}>✓</span>}
                </div>
                <span style={{ fontSize:"9px", color:m.reached?T.light:T.silver, fontWeight:m.reached?600:400 }}>{m.pct}%</span>
              </div>
            ))}
          </div>
        </div>

        {/* ── GRID: Actividade semanal + Objectivos ─────────────────────────── */}
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"16px", marginBottom:"16px" }}>

          {/* Gráfico de barras semanal */}
          <div style={{ padding:"18px 20px", background:T.card, borderRadius:"14px", border:`1px solid ${T.border}` }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"14px" }}>
              <p style={{ margin:0, fontSize:"11px", color:T.silver, textTransform:"uppercase", letterSpacing:"0.1em" }}>Atividade semanal</p>
              <span style={{ fontSize:"11px", color:T.silver }}>últimas 12 semanas</span>
            </div>
            <WeeklyChart done={weekly.done} planned={weekly.planned} />
            {/* Consistência */}
            {weekly.done.length > 0 && (
              <div style={{ marginTop:"12px", paddingTop:"12px", borderTop:`1px solid ${T.border}`, display:"flex", gap:"16px" }}>
                {(() => {
                  const active = weekly.planned.filter(p=>p>0).length;
                  const consistent = weekly.done.filter((d,i)=>weekly.planned[i]>0&&d>0).length;
                  const rate = active ? Math.round(consistent/active*100) : 0;
                  return (
                    <>
                      <div>
                        <p style={{ margin:"0 0 1px", fontSize:"18px", fontWeight:700, color:rate>=70?T.green:rate>=40?T.amber:T.silver, fontFamily:"monospace" }}>{rate}%</p>
                        <p style={{ margin:0, fontSize:"10px", color:T.silver }}>consistência</p>
                      </div>
                      <div>
                        <p style={{ margin:"0 0 1px", fontSize:"18px", fontWeight:700, color:T.blue, fontFamily:"monospace" }}>{summary.maxStreak || 0}d</p>
                        <p style={{ margin:0, fontSize:"10px", color:T.silver }}>maior streak</p>
                      </div>
                      <div>
                        <p style={{ margin:"0 0 1px", fontSize:"18px", fontWeight:700, color:T.light, fontFamily:"monospace" }}>{summary.daysActive}</p>
                        <p style={{ margin:0, fontSize:"10px", color:T.silver }}>dias de jornada</p>
                      </div>
                    </>
                  );
                })()}
              </div>
            )}
          </div>

          {/* Progresso por objectivo */}
          <div style={{ padding:"18px 20px", background:T.card, borderRadius:"14px", border:`1px solid ${T.border}` }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"14px" }}>
              <p style={{ margin:0, fontSize:"11px", color:T.silver, textTransform:"uppercase", letterSpacing:"0.1em" }}>Por objetivo</p>
              <span style={{ fontSize:"11px", color:T.silver }}>{objectives.filter((o:any)=>o.pct===100).length}/{objectives.length} concluídos</span>
            </div>
            <div style={{ overflowY:"auto", maxHeight:"260px" }}>
              {objectives.map((obj:any) => (
                <ObjBar key={obj.id} obj={obj} max={maxObjTotal} />
              ))}
            </div>
          </div>
        </div>

        {/* ── HEATMAP ─────────────────────────────────────────────────────── */}
        <div style={{ padding:"18px 22px", background:T.card, borderRadius:"14px", border:`1px solid ${T.border}`, marginBottom:"16px" }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"14px" }}>
            <p style={{ margin:0, fontSize:"11px", color:T.silver, textTransform:"uppercase", letterSpacing:"0.1em" }}>Mapa de atividade — últimas 12 semanas</p>
            <div style={{ display:"flex", alignItems:"center", gap:"4px" }}>
              <span style={{ fontSize:"9px", color:T.silver }}>menos</span>
              {[T.surface, `${T.green}55`, `${T.green}99`, T.green].map((c,i)=>(
                <div key={i} style={{ width:"10px", height:"10px", borderRadius:"2px", background:c }} />
              ))}
              <span style={{ fontSize:"9px", color:T.silver }}>mais</span>
            </div>
          </div>
          <Heatmap heatmap={heatmap} />
          {/* Insight de streak */}
          {summary.streak > 0 && (
            <div style={{ marginTop:"12px", padding:"10px 14px", background:`${T.amber}0A`, borderRadius:"8px", border:`1px solid ${T.amber}22` }}>
              <p style={{ margin:0, fontSize:"12px", color:T.amber }}>
                🔥 <strong>{summary.streak} dia{summary.streak!==1?"s":""} seguidos.</strong> Manter o ritmo é o que transforma intenção em identidade.
              </p>
            </div>
          )}
        </div>

        {/* ── Mix de tipos de sessão + Stats finais ──────────────────────── */}
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"16px" }}>

          {/* Tipos de sessão */}
          <div style={{ padding:"18px 20px", background:T.card, borderRadius:"14px", border:`1px solid ${T.border}` }}>
            <p style={{ margin:"0 0 14px", fontSize:"11px", color:T.silver, textTransform:"uppercase", letterSpacing:"0.1em" }}>Como você trabalha</p>
            {Object.entries(byType as Record<string,number>).length === 0 ? (
              <p style={{ fontSize:"12px", color:T.silver, fontStyle:"italic" }}>Ainda sem sessões concluídas.</p>
            ) : (
              Object.entries(byType as Record<string,number>)
                .sort(([,a],[,b])=>b-a)
                .map(([type, count]) => {
                  const pct = Math.round((count/totalByType)*100);
                  const color = typeColors[type] || T.blue;
                  return (
                    <div key={type} style={{ marginBottom:"10px" }}>
                      <div style={{ display:"flex", justifyContent:"space-between", marginBottom:"4px" }}>
                        <span style={{ fontSize:"12px", color:T.light }}>{typeLabels[type]||type}</span>
                        <span style={{ fontSize:"11px", color, fontFamily:"monospace", fontWeight:600 }}>{count} ({pct}%)</span>
                      </div>
                      <div style={{ height:"4px", background:T.dim, borderRadius:"999px" }}>
                        <div style={{ height:"100%", width:`${pct}%`, background:color, borderRadius:"999px", transition:"width 0.8s ease" }} />
                      </div>
                    </div>
                  );
                })
            )}
          </div>

          {/* Projecção e números finais */}
          <div style={{ padding:"18px 20px", background:T.card, borderRadius:"14px", border:`1px solid ${T.border}` }}>
            <p style={{ margin:"0 0 14px", fontSize:"11px", color:T.silver, textTransform:"uppercase", letterSpacing:"0.1em" }}>O caminho que falta</p>
            <div style={{ display:"flex", flexDirection:"column", gap:"10px" }}>
              {[
                { label:"Blocos restantes",    val:`${summary.remaining}`,                       color:T.light },
                { label:"Horas restantes",     val:`${fmtHours(summary.remaining*0.5)}`,         color:T.silver },
                { label:"Previsão de conclusão", val: summary.projectedDays ? `~${fmtDays(summary.projectedDays)}` : "acelera um pouco", color:summary.projectedDays?T.blue:T.amber },
                { label:"Ritmo atual",         val: summary.velocity > 0 ? `${summary.velocity} blocos/semana` : "aguarda o 1º bloco", color:T.silver },
                { label:"Total de horas ao concluir", val:`${fmtHours(summary.total*0.5)}`,      color:T.silver },
              ].map((r,i)=>(
                <div key={i} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", paddingBottom:"8px", borderBottom:`1px solid ${T.border}22` }}>
                  <span style={{ fontSize:"12px", color:T.silver }}>{r.label}</span>
                  <span style={{ fontSize:"13px", color:r.color, fontWeight:500, fontFamily:"monospace" }}>{r.val}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}

export default function ProgressPage() {
  return (
    <Suspense fallback={<div style={{ minHeight:"100vh", background:"#0D0D14" }} />}>
      <ProgressContent />
    </Suspense>
  );
}
