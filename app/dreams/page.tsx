// @ts-nocheck
"use client";
import { useAuthGuard } from "@/lib/auth-guard";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const tokens = {
  deepNight: "#0D0D14", stellarGray: "#1A1A2E", northLight: "#E8E4DC",
  mutedSilver: "#6B6B80", northBlue: "#4A6FA5", executeGreen: "#2D6A4F",
  pauseAmber: "#C9853A", archiveMauve: "#7B5EA7", border: "#252538",
};

const statusConfig: Record<string, { label: string; color: string; bg: string }> = {
  active:    { label: "Activo",    color: tokens.northBlue,    bg: `${tokens.northBlue}22` },
  queued:    { label: "Na Fila",   color: tokens.mutedSilver,  bg: "transparent" },
  maturing:  { label: "Maturando", color: tokens.northBlue,    bg: `${tokens.northBlue}11` },
  completed: { label: "Realizado", color: tokens.executeGreen, bg: `${tokens.executeGreen}22` },
  paused:    { label: "Pausado",   color: tokens.pauseAmber,   bg: `${tokens.pauseAmber}22` },
  archived:  { label: "Arquivado", color: tokens.archiveMauve, bg: `${tokens.archiveMauve}22` },
};

export default function DreamsPage() {
  const router = useRouter();
  useAuthGuard();
  const [dreams, setDreams] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [creating, setCreating] = useState(false);
  const [filter, setFilter] = useState<string>("all");

  useEffect(() => { loadDreams(); }, []);

  async function loadDreams() {
    setLoading(true);
    const res = await fetch("/api/dreams");
    if (res.ok) {
      const data = await res.json();
      setDreams(data.dreams || []);
    }
    setLoading(false);
  }

  async function createDream() {
    if (!newTitle.trim()) return;
    setCreating(true);
    const res = await fetch("/api/dreams", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: newTitle.trim() }),
    });
    if (res.ok) {
      setNewTitle(""); setShowNew(false);
      await loadDreams();
    }
    setCreating(false);
  }

  async function updateStatus(id: string, status: string) {
    await fetch(`/api/dreams/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    await loadDreams();
  }

  const filters = [
    { key: "all", label: "Todos" },
    { key: "active", label: "Activo" },
    { key: "queued", label: "Fila" },
    { key: "maturing", label: "Maturando" },
    { key: "completed", label: "Realizados" },
    { key: "archived", label: "Arquivados" },
  ];

  const filtered = filter === "all" ? dreams : dreams.filter(d => d.status === filter);

  return (
    <div style={{ minHeight: "100vh", background: tokens.deepNight, color: tokens.northLight, fontFamily: "Inter, sans-serif" }}>
      {/* Header */}
      <div style={{ borderBottom: `1px solid ${tokens.border}`, padding: "20px 32px", display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, background: `${tokens.deepNight}F0`, backdropFilter: "blur(12px)", zIndex: 50 }}>
        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          <button onClick={() => router.push("/dashboard")} style={{ background: "none", border: "none", color: tokens.mutedSilver, cursor: "pointer", fontSize: "14px" }}>← Dashboard</button>
          <span style={{ color: tokens.border }}>|</span>
          <span style={{ fontFamily: "'Playfair Display', serif", fontSize: "18px", letterSpacing: "0.04em" }}>Sonhos</span>
        </div>
        <button
          onClick={() => setShowNew(true)}
          style={{ padding: "8px 18px", background: tokens.northBlue, border: "none", borderRadius: "8px", color: tokens.northLight, fontSize: "13px", fontWeight: 500, cursor: "pointer" }}
        >
          + Novo Sonho
        </button>
      </div>

      <div style={{ maxWidth: "800px", margin: "0 auto", padding: "40px 32px" }}>
        {/* Filtros */}
        <div style={{ display: "flex", gap: "8px", marginBottom: "32px", flexWrap: "wrap" }}>
          {filters.map(f => (
            <button key={f.key} onClick={() => setFilter(f.key)}
              style={{ padding: "6px 14px", border: `1px solid ${filter === f.key ? tokens.northBlue : tokens.border}`, borderRadius: "999px", background: filter === f.key ? `${tokens.northBlue}22` : "transparent", color: filter === f.key ? tokens.northBlue : tokens.mutedSilver, fontSize: "12px", fontWeight: filter === f.key ? 500 : 400, cursor: "pointer", fontFamily: "Inter, sans-serif", letterSpacing: "0.04em" }}
            >{f.label}</button>
          ))}
        </div>

        {/* Modal novo sonho */}
        {showNew && (
          <div style={{ padding: "28px", background: tokens.stellarGray, borderRadius: "12px", border: `1px solid ${tokens.northBlue}44`, marginBottom: "24px" }}>
            <p style={{ margin: "0 0 16px", fontSize: "15px", fontWeight: 300, fontStyle: "italic", color: tokens.northLight }}>
              Qual é o sonho que queres transformar em plano real?
            </p>
            <textarea
              value={newTitle} onChange={e => setNewTitle(e.target.value)}
              onKeyDown={e => e.key === "Enter" && !e.shiftKey && createDream()}
              placeholder="Escreve aqui..."
              rows={3}
              style={{ width: "100%", background: tokens.deepNight, border: `1px solid ${tokens.border}`, borderRadius: "8px", padding: "12px", color: tokens.northLight, fontSize: "15px", fontFamily: "Inter, sans-serif", resize: "none", outline: "none", boxSizing: "border-box" }}
            />
            <div style={{ display: "flex", gap: "8px", marginTop: "12px" }}>
              <button onClick={createDream} disabled={creating || !newTitle.trim()}
                style={{ padding: "10px 20px", background: newTitle.trim() ? tokens.northBlue : tokens.border, border: "none", borderRadius: "8px", color: tokens.northLight, fontSize: "14px", fontWeight: 500, cursor: newTitle.trim() ? "pointer" : "default", fontFamily: "Inter, sans-serif" }}
              >{creating ? "A criar..." : "Criar sonho"}</button>
              <button onClick={() => { setShowNew(false); setNewTitle(""); }}
                style={{ padding: "10px 20px", background: "transparent", border: `1px solid ${tokens.border}`, borderRadius: "8px", color: tokens.mutedSilver, fontSize: "14px", cursor: "pointer", fontFamily: "Inter, sans-serif" }}
              >Cancelar</button>
            </div>
          </div>
        )}

        {loading ? (
          <div style={{ textAlign: "center", padding: "60px", color: tokens.mutedSilver, fontSize: "14px" }}>
            A carregar sonhos...
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: "center", padding: "80px 40px" }}>
            <p style={{ fontFamily: "'Playfair Display', serif", fontSize: "28px", color: `${tokens.northLight}66`, marginBottom: "16px" }}>
              {filter === "all" ? "Nenhum sonho ainda." : `Nenhum sonho ${filters.find(f => f.key === filter)?.label.toLowerCase()}.`}
            </p>
            {filter === "all" && (
              <p style={{ color: tokens.mutedSilver, fontSize: "14px" }}>
                Começa por adicionar o sonho que vens a adiar.
              </p>
            )}
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {filtered.map((dream: any) => {
              const cfg = statusConfig[dream.status] || statusConfig.queued;
              return (
                <div key={dream.id}
                  style={{ padding: "24px", background: tokens.stellarGray, border: `1px solid ${dream.status === "active" ? tokens.northBlue + "44" : tokens.border}`, borderRadius: "12px", cursor: "pointer", transition: "all 280ms ease" }}
                  onClick={() => router.push(`/dashboard?dream=${dream.id}`)}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "16px" }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "10px" }}>
                        <span style={{ padding: "2px 10px", background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.color}44`, borderRadius: "999px", fontSize: "11px", fontWeight: 500, letterSpacing: "0.06em", textTransform: "uppercase" }}>
                          {cfg.label}
                        </span>
                        {dream.maturity_stage && (
                          <span style={{ fontSize: "11px", color: tokens.mutedSilver }}>
                            Estágio {dream.maturity_stage}
                          </span>
                        )}
                      </div>
                      <p style={{ fontFamily: "'Playfair Display', serif", fontSize: "20px", margin: "0 0 8px", color: tokens.northLight, lineHeight: 1.3 }}>
                        {dream.title}
                      </p>
                      {dream.description && (
                        <p style={{ fontSize: "13px", color: tokens.mutedSilver, margin: "0 0 12px", lineHeight: 1.5 }}>
                          {dream.description}
                        </p>
                      )}
                      {dream.status === "active" && dream.blocks_total > 0 && (
                        <div>
                          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
                            <span style={{ fontSize: "12px", color: tokens.mutedSilver }}>{dream.blocks_completed} blocos completados</span>
                            <span style={{ fontSize: "12px", color: tokens.mutedSilver }}>{dream.progress}%</span>
                          </div>
                          <div style={{ height: "2px", background: tokens.border, borderRadius: "999px" }}>
                            <div style={{ height: "100%", width: `${dream.progress}%`, background: tokens.northBlue, borderRadius: "999px", transition: "width 600ms ease-out" }} />
                          </div>
                        </div>
                      )}
                    </div>
                    {/* Acções rápidas */}
                    <div style={{ display: "flex", flexDirection: "column", gap: "6px" }} onClick={e => e.stopPropagation()}>
                      {dream.status === "queued" && (
                        <button onClick={() => updateStatus(dream.id, "active")}
                          style={{ padding: "6px 12px", background: `${tokens.northBlue}22`, border: `1px solid ${tokens.northBlue}44`, borderRadius: "6px", color: tokens.northBlue, fontSize: "11px", cursor: "pointer", fontFamily: "Inter, sans-serif", whiteSpace: "nowrap" }}
                        >Activar</button>
                      )}
                      {dream.status === "active" && (
                        <button onClick={() => updateStatus(dream.id, "paused")}
                          style={{ padding: "6px 12px", background: "transparent", border: `1px solid ${tokens.border}`, borderRadius: "6px", color: tokens.mutedSilver, fontSize: "11px", cursor: "pointer", fontFamily: "Inter, sans-serif" }}
                        >Pausar</button>
                      )}
                      {dream.status === "paused" && (
                        <button onClick={() => updateStatus(dream.id, "active")}
                          style={{ padding: "6px 12px", background: `${tokens.pauseAmber}22`, border: `1px solid ${tokens.pauseAmber}44`, borderRadius: "6px", color: tokens.pauseAmber, fontSize: "11px", cursor: "pointer", fontFamily: "Inter, sans-serif" }}
                        >Retomar</button>
                      )}
                      {["active", "queued", "paused"].includes(dream.status) && (
                        <button onClick={() => updateStatus(dream.id, "archived")}
                          style={{ padding: "6px 12px", background: "transparent", border: `1px solid ${tokens.border}`, borderRadius: "6px", color: tokens.mutedSilver, fontSize: "11px", cursor: "pointer", fontFamily: "Inter, sans-serif" }}
                        >Arquivar</button>
                      )}
                    </div>
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
