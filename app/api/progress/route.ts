// @ts-nocheck
export const dynamic = "force-dynamic";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const dreamId = searchParams.get("dreamId");
    if (!dreamId) return Response.json({ error: "dreamId required" }, { status: 400 });

    const [blocksRes, objRes, dreamRes] = await Promise.all([
      supabase.from("blocks").select("id,status,scheduled_at,updated_at,duration_minutes,session_type,objective_id")
        .eq("dream_id", dreamId).eq("user_id", user.id),
      supabase.from("objectives").select("id,title,order_index,status,blocks_count,blocks_completed")
        .eq("dream_id", dreamId).eq("user_id", user.id).order("order_index"),
      supabase.from("dreams").select("id,title,activated_at,created_at").eq("id", dreamId).single(),
    ]);

    const blocks     = blocksRes.data || [];
    const objectives = objRes.data    || [];
    const dream      = dreamRes.data;

    const done   = blocks.filter(b => b.status === "completed");
    const total  = blocks.length;
    const pct    = total ? Math.round((done.length / total) * 100) : 0;
    const hours  = parseFloat((done.length * 0.5).toFixed(1));
    const daysActive = dream?.activated_at
      ? Math.max(1, Math.floor((Date.now() - new Date(dream.activated_at).getTime()) / 86400000))
      : 1;

    // Heatmap: últimos 84 dias (12 semanas) — contar blocos concluídos por dia
    const heatmap: Record<string, number> = {};
    for (let i = 0; i < 84; i++) {
      const d = new Date(Date.now() - i * 86400000);
      heatmap[d.toISOString().slice(0, 10)] = 0;
    }
    for (const b of done) {
      const key = new Date(b.updated_at || b.scheduled_at).toISOString().slice(0, 10);
      if (key in heatmap) heatmap[key]++;
    }

    // Semanas: blocos concluídos por semana (últimas 12)
    const weeklyDone: number[] = Array(12).fill(0);
    const weeklyPlanned: number[] = Array(12).fill(0);
    const now = Date.now();
    for (const b of blocks) {
      const daysAgo = Math.floor((now - new Date(b.scheduled_at).getTime()) / 86400000);
      const weekIdx = Math.floor(daysAgo / 7);
      if (weekIdx >= 0 && weekIdx < 12) {
        weeklyPlanned[weekIdx]++;
        if (b.status === "completed") weeklyDone[weekIdx]++;
      }
    }

    // Streak actual
    const doneByDay = new Set(done.map(b =>
      new Date(b.updated_at || b.scheduled_at).toISOString().slice(0, 10)
    ));
    let streak = 0;
    for (let i = 0; i < 365; i++) {
      const key = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10);
      if (doneByDay.has(key)) streak++;
      else if (i > 0) break;
    }

    // Maior streak histórico
    const sortedDays = Array.from(doneByDay).sort();
    let maxStreak = 0, cur = 0, prev: string | null = null;
    for (const day of sortedDays) {
      if (prev) {
        const diff = (new Date(day).getTime() - new Date(prev).getTime()) / 86400000;
        cur = diff === 1 ? cur + 1 : 1;
      } else cur = 1;
      maxStreak = Math.max(maxStreak, cur);
      prev = day;
    }

    // Velocity: média de blocos/semana (últimas 4 semanas)
    const recent4 = weeklyDone.slice(0, 4).filter((_,i) => weeklyPlanned[i] > 0);
    const velocity = recent4.length ? parseFloat((recent4.reduce((a,b)=>a+b,0)/Math.max(1,recent4.length)).toFixed(1)) : 0;

    // Projeção: dias restantes ao ritmo actual
    const remaining = total - done.length;
    const dailyRate = done.length / daysActive;
    const projectedDays = dailyRate > 0 ? Math.ceil(remaining / dailyRate) : null;

    // Por tipo de sessão
    const byType: Record<string, number> = {};
    for (const b of done) {
      const t = b.session_type || "practice";
      byType[t] = (byType[t] || 0) + 1;
    }

    // Milestones (5%, 10%, 25%, 50%, 75%, 90%, 100%)
    const milestones = [5,10,25,50,75,90,100].map(m => ({
      pct: m,
      reached: pct >= m,
      blocksNeeded: Math.ceil(m/100*total) - done.length,
    }));

    return Response.json({
      dream: { title: dream?.title, activated_at: dream?.activated_at },
      summary: { done: done.length, total, pct, hours, daysActive, streak, maxStreak, velocity, projectedDays, remaining },
      heatmap,
      weekly: { done: weeklyDone.reverse(), planned: weeklyPlanned.reverse() },
      objectives: objectives.map(o => ({
        id: o.id, title: o.title, order: o.order_index,
        done: o.blocks_completed || 0, total: o.blocks_count || 0,
        pct: o.blocks_count ? Math.round((o.blocks_completed||0)/o.blocks_count*100) : 0,
        status: o.status,
      })),
      byType,
      milestones,
    });
  } catch (e: any) {
    console.error("Progress API:", e?.message);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
