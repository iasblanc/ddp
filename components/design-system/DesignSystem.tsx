"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

// ── TOKENS ────────────────────────────────────────────────────
const tokens = {
  colors: {
    deepNight: "#0D0D14",
    stellarGray: "#1A1A2E",
    surface: "#141420",
    northLight: "#E8E4DC",
    mutedSilver: "#6B6B80",
    border: "#252538",
    borderSubtle: "#1C1C2C",
    northBlue: "#4A6FA5",
    northBlueDim: "#2E4A72",
    executeGreen: "#2D6A4F",
    executeGreenDim: "#1A3D2E",
    pauseAmber: "#C9853A",
    pauseAmberDim: "#7A4F22",
    archiveMauve: "#7B5EA7",
    archiveMauveDim: "#4A3866",
  },
};

// ── PRIMITIVOS ────────────────────────────────────────────────
function DS_Text({
  size = "md",
  weight = "regular",
  color = "primary",
  style = {},
  className = "",
  children,
  as: Tag = "p",
}: {
  size?: string;
  weight?: string;
  color?: string;
  style?: React.CSSProperties;
  className?: string;
  children: React.ReactNode;
  as?: keyof JSX.IntrinsicElements;
}) {
  const sizes: Record<string, string> = {
    "2xs": "11px", xs: "13px", sm: "14px", md: "15px",
    lg: "18px", xl: "22px", "2xl": "28px", "3xl": "36px",
  };
  const weights: Record<string, number> = {
    light: 300, regular: 400, medium: 500, semibold: 600, bold: 700,
  };
  const colors: Record<string, string> = {
    primary: tokens.colors.northLight,
    secondary: tokens.colors.mutedSilver,
    accent: tokens.colors.northBlue,
    green: tokens.colors.executeGreen,
    amber: tokens.colors.pauseAmber,
    mauve: tokens.colors.archiveMauve,
  };

  return (
    <Tag
      className={className}
      style={{
        fontSize: sizes[size] || size,
        fontWeight: weights[weight] || 400,
        color: colors[color] || color,
        lineHeight: 1.6,
        margin: 0,
        fontFamily: "var(--font-inter), -apple-system, sans-serif",
        ...style,
      }}
    >
      {children}
    </Tag>
  );
}

function DS_Display({ size = "2xl", bold = false, children }: { size?: string; bold?: boolean; children: React.ReactNode }) {
  const sizes: Record<string, string> = {
    sm: "18px", md: "22px", lg: "28px", xl: "36px",
    "2xl": "42px", "3xl": "56px", "4xl": "72px",
  };
  return (
    <p style={{
      fontFamily: "var(--font-playfair), Georgia, serif",
      fontSize: sizes[size] || size,
      fontWeight: bold ? 700 : 400,
      color: tokens.colors.northLight,
      letterSpacing: "0.04em",
      lineHeight: 1.2,
      margin: 0,
    }}>{children}</p>
  );
}

function DS_Badge({ variant = "default", children }: { variant?: string; children: React.ReactNode }) {
  const variants: Record<string, { bg: string; color: string; border: string }> = {
    default: { bg: tokens.colors.stellarGray, color: tokens.colors.mutedSilver, border: tokens.colors.border },
    active: { bg: `${tokens.colors.northBlue}22`, color: tokens.colors.northBlue, border: `${tokens.colors.northBlue}44` },
    complete: { bg: `${tokens.colors.executeGreen}22`, color: tokens.colors.executeGreen, border: `${tokens.colors.executeGreen}44` },
    pause: { bg: `${tokens.colors.pauseAmber}22`, color: tokens.colors.pauseAmber, border: `${tokens.colors.pauseAmber}44` },
    archive: { bg: `${tokens.colors.archiveMauve}22`, color: tokens.colors.archiveMauve, border: `${tokens.colors.archiveMauve}44` },
    maturing: { bg: `${tokens.colors.northBlue}11`, color: `${tokens.colors.northBlue}CC`, border: `${tokens.colors.northBlue}22` },
  };
  const v = variants[variant] || variants.default;
  return (
    <span style={{
      display: "inline-block",
      padding: "2px 10px",
      borderRadius: "999px",
      fontSize: "11px",
      fontWeight: 500,
      letterSpacing: "0.06em",
      textTransform: "uppercase" as const,
      background: v.bg,
      color: v.color,
      border: `1px solid ${v.border}`,
      fontFamily: "var(--font-inter), sans-serif",
    }}>{children}</span>
  );
}

function DS_Button({
  variant = "primary",
  size = "md",
  disabled = false,
  onClick,
  children,
}: {
  variant?: string;
  size?: string;
  disabled?: boolean;
  onClick?: () => void;
  children: React.ReactNode;
}) {
  const [hovered, setHovered] = useState(false);
  const [pressed, setPressed] = useState(false);

  const variants: Record<string, { bg: string; color: string; border: string }> = {
    primary: {
      bg: hovered ? tokens.colors.northBlueDim : tokens.colors.northBlue,
      color: tokens.colors.northLight,
      border: "transparent",
    },
    secondary: {
      bg: hovered ? tokens.colors.stellarGray : "transparent",
      color: tokens.colors.northLight,
      border: tokens.colors.border,
    },
    ghost: {
      bg: hovered ? `${tokens.colors.northLight}0A` : "transparent",
      color: tokens.colors.mutedSilver,
      border: "transparent",
    },
    danger: {
      bg: hovered ? tokens.colors.pauseAmberDim : "transparent",
      color: tokens.colors.pauseAmber,
      border: `${tokens.colors.pauseAmber}44`,
    },
  };

  const sizes: Record<string, { padding: string; fontSize: string }> = {
    sm: { padding: "8px 16px", fontSize: "12px" },
    md: { padding: "10px 20px", fontSize: "14px" },
    lg: { padding: "14px 28px", fontSize: "15px" },
  };

  const v = variants[variant] || variants.primary;
  const s = sizes[size] || sizes.md;

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => { setHovered(false); setPressed(false); }}
      onMouseDown={() => setPressed(true)}
      onMouseUp={() => setPressed(false)}
      disabled={disabled}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "8px",
        padding: s.padding,
        fontSize: s.fontSize,
        fontWeight: 500,
        fontFamily: "var(--font-inter), sans-serif",
        color: disabled ? tokens.colors.mutedSilver : v.color,
        background: disabled ? tokens.colors.stellarGray : v.bg,
        border: `1px solid ${disabled ? tokens.colors.border : v.border}`,
        borderRadius: "10px",
        cursor: disabled ? "not-allowed" : "pointer",
        transition: "all 280ms cubic-bezier(0.4, 0, 0.2, 1)",
        transform: pressed && !disabled ? "scale(0.98)" : "scale(1)",
        opacity: disabled ? 0.5 : 1,
        outline: "none",
      }}
    >{children}</button>
  );
}

function DS_NorthMessage({ voice = "ouve", children }: { voice?: string; children: React.ReactNode }) {
  const voiceConfig: Record<string, { weight: number; italic: boolean; border: string; label: string }> = {
    ouve: { weight: 300, italic: true, border: tokens.colors.mutedSilver, label: "North Ouve" },
    pensa: { weight: 500, italic: false, border: `${tokens.colors.northBlue}88`, label: "North Pensa" },
    provoca: { weight: 600, italic: false, border: tokens.colors.northBlue, label: "North Provoca" },
  };
  const cfg = voiceConfig[voice] || voiceConfig.ouve;

  return (
    <div style={{
      padding: "20px 24px",
      background: tokens.colors.stellarGray,
      borderRadius: "16px",
      borderLeft: `2px solid ${cfg.border}`,
    }}>
      <div style={{ marginBottom: "8px" }}>
        <DS_Badge variant={voice === "provoca" ? "active" : "default"}>{cfg.label}</DS_Badge>
      </div>
      <p style={{
        margin: 0,
        fontSize: "15px",
        fontWeight: cfg.weight,
        color: tokens.colors.northLight,
        lineHeight: 1.7,
        fontFamily: "var(--font-inter), sans-serif",
        fontStyle: cfg.italic ? "italic" : "normal",
      }}>{children}</p>
    </div>
  );
}

function DS_UserMessage({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      padding: "16px 20px",
      background: tokens.colors.deepNight,
      borderRadius: "16px",
      border: `1px solid ${tokens.colors.borderSubtle}`,
      marginLeft: "auto",
      maxWidth: "80%",
    }}>
      <p style={{
        margin: 0,
        fontSize: "15px",
        color: tokens.colors.northLight,
        lineHeight: 1.6,
        fontFamily: "var(--font-inter), sans-serif",
      }}>{children}</p>
    </div>
  );
}

function DS_DreamCard({ title, status = "active", progress = 0, days = 0, streak = 0 }: {
  title: string; status?: string; progress?: number; days?: number; streak?: number;
}) {
  const [hovered, setHovered] = useState(false);
  const statusConfig: Record<string, { label: string; variant: string; accent: string }> = {
    active: { label: "Ativo", variant: "active", accent: tokens.colors.northBlue },
    queued: { label: "Na Fila", variant: "default", accent: tokens.colors.mutedSilver },
    maturing: { label: "Maturando", variant: "maturing", accent: tokens.colors.northBlue },
    completed: { label: "Realizado", variant: "complete", accent: tokens.colors.executeGreen },
    archived: { label: "Arquivado", variant: "archive", accent: tokens.colors.archiveMauve },
    paused: { label: "Pausado", variant: "pause", accent: tokens.colors.pauseAmber },
  };
  const cfg = statusConfig[status] || statusConfig.active;

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: hovered ? tokens.colors.stellarGray : tokens.colors.surface,
        border: `1px solid ${hovered ? cfg.accent + "44" : tokens.colors.border}`,
        borderRadius: "16px",
        padding: "24px",
        transition: "all 280ms cubic-bezier(0.4, 0, 0.2, 1)",
        cursor: "pointer",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "16px" }}>
        <DS_Badge variant={cfg.variant}>{cfg.label}</DS_Badge>
        {streak > 0 && <DS_Text size="sm" color="secondary">{streak} dias seguidos</DS_Text>}
      </div>
      <p style={{
        margin: "0 0 20px",
        fontFamily: "var(--font-playfair), Georgia, serif",
        fontSize: "28px",
        fontWeight: 400,
        color: hovered ? tokens.colors.northLight : `${tokens.colors.northLight}CC`,
        letterSpacing: "0.04em",
        lineHeight: 1.2,
        transition: "all 280ms cubic-bezier(0.4, 0, 0.2, 1)",
      }}>{title}</p>
      {status === "active" && (
        <>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
            <DS_Text size="sm" color="secondary">Progresso</DS_Text>
            <DS_Text size="sm" color="secondary">{progress}%</DS_Text>
          </div>
          <div style={{ height: "2px", background: tokens.colors.border, borderRadius: "999px", overflow: "hidden" }}>
            <div style={{
              height: "100%", width: `${progress}%`,
              background: cfg.accent, borderRadius: "999px",
              transition: "width 600ms ease-out",
            }} />
          </div>
          <div style={{ marginTop: "16px" }}>
            <DS_Text size="sm" color="secondary">{days} dias restantes no plano</DS_Text>
          </div>
        </>
      )}
    </div>
  );
}

function DS_BlockCard({ time, task, status = "scheduled" }: { time: string; task: string; status?: string }) {
  const statusConfig: Record<string, { color: string; label: string; bg: string }> = {
    scheduled: { color: tokens.colors.northBlue, label: "Agendado", bg: `${tokens.colors.northBlue}11` },
    completed: { color: tokens.colors.executeGreen, label: "Concluído", bg: `${tokens.colors.executeGreen}11` },
    missed: { color: tokens.colors.mutedSilver, label: "Não realizado", bg: "transparent" },
    active: { color: tokens.colors.pauseAmber, label: "Em andamento", bg: `${tokens.colors.pauseAmber}11` },
  };
  const cfg = statusConfig[status] || statusConfig.scheduled;
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: "16px",
      padding: "16px 20px",
      background: cfg.bg,
      border: `1px solid ${cfg.color}22`,
      borderRadius: "10px",
      borderLeft: `3px solid ${cfg.color}`,
    }}>
      <div style={{ minWidth: "52px" }}>
        <DS_Text size="sm" weight="medium" color="secondary">{time}</DS_Text>
      </div>
      <div style={{ flex: 1 }}>
        <DS_Text size="md" style={{ opacity: status === "missed" ? 0.5 : 1 }}>{task}</DS_Text>
      </div>
      <DS_Text size="2xs" style={{ color: cfg.color }}>{cfg.label}</DS_Text>
    </div>
  );
}

function DS_ProgressBar({ value = 0, label = "" }: { value?: number; label?: string }) {
  return (
    <div>
      {label && (
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
          <DS_Text size="sm" color="secondary">{label}</DS_Text>
          <DS_Text size="sm" color="secondary">{value}%</DS_Text>
        </div>
      )}
      <div style={{ height: "3px", background: tokens.colors.border, borderRadius: "999px", overflow: "hidden" }}>
        <div style={{
          height: "100%", width: `${value}%`,
          background: `linear-gradient(90deg, ${tokens.colors.northBlue}, ${tokens.colors.northBlue}CC)`,
          borderRadius: "999px",
          transition: "width 800ms ease-out",
        }} />
      </div>
    </div>
  );
}

// ── SEÇÃO ─────────────────────────────────────────────────────
function Section({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: "56px" }}>
      <div style={{ marginBottom: "32px" }}>
        <DS_Text size="2xs" weight="medium" color="secondary"
          style={{ letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: "8px" }}>
          {title}
        </DS_Text>
        {subtitle && <DS_Text size="sm" color="secondary">{subtitle}</DS_Text>}
        <div style={{ marginTop: "16px", height: "1px", background: tokens.colors.border }} />
      </div>
      {children}
    </div>
  );
}

// ── NAVEGAÇÃO ─────────────────────────────────────────────────
const navItems = [
  { id: "brand", label: "Marca" },
  { id: "colors", label: "Cores" },
  { id: "typography", label: "Tipografia" },
  { id: "components", label: "Componentes" },
  { id: "north", label: "North" },
  { id: "dreams", label: "Sonhos" },
  { id: "blocks", label: "Blocos" },
  { id: "motion", label: "Motion" },
];

// ── MAIN ──────────────────────────────────────────────────────
export default function DesignSystem() {
  const [activeTab, setActiveTab] = useState("brand");

  const renderContent = () => {
    switch (activeTab) {

      case "brand":
        return (
          <div>
            <Section title="Identidade" subtitle="A tensão entre sonho e execução como princípio visual.">
              <div style={{
                background: tokens.colors.deepNight,
                borderRadius: "16px",
                padding: "64px",
                marginBottom: "24px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                border: `1px solid ${tokens.colors.border}`,
              }}>
                <div style={{ textAlign: "center" }}>
                  <p style={{ fontFamily: "var(--font-playfair), Georgia, serif", fontSize: "52px", fontWeight: 400, color: tokens.colors.northLight, letterSpacing: "0.08em", margin: 0, lineHeight: 1.1 }}>DONT DREAM.</p>
                  <p style={{ fontFamily: "var(--font-playfair), Georgia, serif", fontSize: "52px", fontWeight: 700, color: tokens.colors.northLight, letterSpacing: "0.04em", margin: 0, lineHeight: 1.1 }}>PLAN.</p>
                </div>
              </div>
              <div style={{
                background: tokens.colors.stellarGray,
                borderRadius: "16px",
                padding: "40px",
                marginBottom: "24px",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                border: `1px solid ${tokens.colors.border}`,
                flexWrap: "wrap" as const,
                gap: "16px",
              }}>
                <div>
                  <p style={{ fontFamily: "var(--font-playfair), Georgia, serif", fontSize: "28px", fontWeight: 400, color: tokens.colors.northLight, margin: "0 0 4px", letterSpacing: "0.06em" }}>DONT DREAM.</p>
                  <p style={{ fontFamily: "var(--font-playfair), Georgia, serif", fontSize: "28px", fontWeight: 700, color: tokens.colors.northLight, margin: 0, letterSpacing: "0.03em" }}>PLAN.</p>
                </div>
                <DS_Text size="sm" color="secondary" style={{ fontStyle: "italic", fontFamily: "var(--font-playfair), Georgia, serif" }}>Find your North.</DS_Text>
              </div>
              <div style={{ display: "flex", gap: "16px", flexWrap: "wrap" as const }}>
                {[72, 48, 32, 24].map(size => (
                  <div key={size} style={{
                    width: size, height: size,
                    background: tokens.colors.deepNight,
                    border: `1px solid ${tokens.colors.border}`,
                    borderRadius: size * 0.22,
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                    <p style={{ fontFamily: "var(--font-playfair), Georgia, serif", fontSize: size * 0.3, fontWeight: 700, color: tokens.colors.northLight, margin: 0, letterSpacing: "0.02em" }}>DP.</p>
                  </div>
                ))}
              </div>
            </Section>
            <Section title="Princípios Visuais">
              {[
                { title: "Contraste Intencional", desc: "Escuro e claro. Suave e sharp. Não como inconsistência — como argumento visual." },
                { title: "Espaço como Elemento", desc: "Muito espaço negativo. O usuário chega sobrecarregado. O espaço é o primeiro respiro." },
                { title: "Tipografia como Voz", desc: "North fala em texto. O peso da fonte sinaliza qual das três vozes está falando." },
                { title: "Cor como Estado Emocional", desc: "Cada cor tem um momento específico. O app muda conforme a jornada emocional." },
                { title: "Nada Celebratório Demais", desc: "Sem confetes. Conquistas são reconhecidas com peso — não com festa." },
              ].map((p, i) => (
                <div key={i} style={{
                  padding: "20px 24px",
                  background: tokens.colors.surface,
                  border: `1px solid ${tokens.colors.border}`,
                  borderRadius: "10px",
                  marginBottom: "8px",
                  display: "flex", gap: "20px", alignItems: "flex-start",
                }}>
                  <DS_Text size="sm" color="secondary" style={{ minWidth: "24px", paddingTop: "2px" }}>{String(i + 1).padStart(2, "0")}</DS_Text>
                  <div>
                    <DS_Text size="md" weight="medium" style={{ marginBottom: "4px" }}>{p.title}</DS_Text>
                    <DS_Text size="sm" color="secondary">{p.desc}</DS_Text>
                  </div>
                </div>
              ))}
            </Section>
          </div>
        );

      case "colors":
        return (
          <div>
            <Section title="Paleta Escura" subtitle="O Mundo do Sonho — base da experiência.">
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: "12px", marginBottom: "32px" }}>
                {[
                  { name: "DEEP NIGHT", value: tokens.colors.deepNight, desc: "Fundo principal" },
                  { name: "STELLAR GRAY", value: tokens.colors.stellarGray, desc: "Superfícies e cards" },
                  { name: "SURFACE", value: tokens.colors.surface, desc: "Camada intermediária" },
                  { name: "NORTH LIGHT", value: tokens.colors.northLight, desc: "Texto principal" },
                  { name: "MUTED SILVER", value: tokens.colors.mutedSilver, desc: "Texto secundário" },
                  { name: "BORDER", value: tokens.colors.border, desc: "Separadores" },
                ].map(c => (
                  <div key={c.name} style={{ background: tokens.colors.surface, border: `1px solid ${tokens.colors.border}`, borderRadius: "10px", overflow: "hidden" }}>
                    <div style={{ height: "72px", background: c.value }} />
                    <div style={{ padding: "12px" }}>
                      <DS_Text size="sm" weight="medium" style={{ marginBottom: "2px" }}>{c.name}</DS_Text>
                      <DS_Text size="2xs" color="secondary" style={{ fontFamily: "monospace" }}>{c.value}</DS_Text>
                      <DS_Text size="2xs" color="secondary" style={{ marginTop: "4px" }}>{c.desc}</DS_Text>
                    </div>
                  </div>
                ))}
              </div>
            </Section>
            <Section title="Paleta de Acento" subtitle="O Mundo da Execução — usada com parcimônia.">
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: "12px" }}>
                {[
                  { name: "NORTH BLUE", value: tokens.colors.northBlue, desc: "CTAs, progresso, marcos" },
                  { name: "EXECUTE GREEN", value: tokens.colors.executeGreen, desc: "Bloco completado" },
                  { name: "PAUSE AMBER", value: tokens.colors.pauseAmber, desc: "Sonho em pausa" },
                  { name: "ARCHIVE MAUVE", value: tokens.colors.archiveMauve, desc: "Sonhos arquivados" },
                ].map(c => (
                  <div key={c.name} style={{ background: tokens.colors.surface, border: `1px solid ${tokens.colors.border}`, borderRadius: "10px", overflow: "hidden" }}>
                    <div style={{ height: "72px", background: c.value }} />
                    <div style={{ padding: "12px" }}>
                      <DS_Text size="sm" weight="medium" style={{ marginBottom: "2px" }}>{c.name}</DS_Text>
                      <DS_Text size="2xs" color="secondary" style={{ fontFamily: "monospace" }}>{c.value}</DS_Text>
                      <DS_Text size="2xs" color="secondary" style={{ marginTop: "4px" }}>{c.desc}</DS_Text>
                    </div>
                  </div>
                ))}
              </div>
            </Section>
          </div>
        );

      case "typography":
        return (
          <div>
            <Section title="Fontes" subtitle="Duas fontes. Cada uma com papel específico e intransferível.">
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "32px" }}>
                <div style={{ padding: "32px", background: tokens.colors.surface, border: `1px solid ${tokens.colors.border}`, borderRadius: "16px" }}>
                  <DS_Text size="2xs" color="secondary" style={{ letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: "16px" }}>Interface + North</DS_Text>
                  <p style={{ fontFamily: "var(--font-inter), sans-serif", fontSize: "28px", fontWeight: 300, color: tokens.colors.northLight, margin: "0 0 4px" }}>Inter Light</p>
                  <p style={{ fontFamily: "var(--font-inter), sans-serif", fontSize: "28px", fontWeight: 500, color: tokens.colors.northLight, margin: "0 0 4px" }}>Inter Medium</p>
                  <p style={{ fontFamily: "var(--font-inter), sans-serif", fontSize: "28px", fontWeight: 600, color: tokens.colors.northLight, margin: "0 0 16px" }}>Inter SemiBold</p>
                  <DS_Text size="sm" color="secondary">UI, mensagens de North, labels</DS_Text>
                </div>
                <div style={{ padding: "32px", background: tokens.colors.surface, border: `1px solid ${tokens.colors.border}`, borderRadius: "16px" }}>
                  <DS_Text size="2xs" color="secondary" style={{ letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: "16px" }}>Sonhos + Marcos</DS_Text>
                  <p style={{ fontFamily: "var(--font-playfair), Georgia, serif", fontSize: "28px", fontWeight: 400, color: tokens.colors.northLight, margin: "0 0 4px", letterSpacing: "0.04em" }}>Playfair Regular</p>
                  <p style={{ fontFamily: "var(--font-playfair), Georgia, serif", fontSize: "28px", fontWeight: 700, color: tokens.colors.northLight, margin: "0 0 16px" }}>Playfair Bold</p>
                  <DS_Text size="sm" color="secondary">Logotipo, títulos de sonhos, marcos</DS_Text>
                </div>
              </div>
            </Section>
            <Section title="Peso como Voz" subtitle="O peso da fonte sinaliza qual voz de North está ativa.">
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {[
                  { weight: 300, label: "Light (300)", voice: "North Ouve", sample: "Me conta mais sobre isso.", variant: "default" },
                  { weight: 500, label: "Medium (500)", voice: "North Pensa", sample: "Com base no que você disse, seu plano tem três fases.", variant: "active" },
                  { weight: 600, label: "SemiBold (600)", voice: "North Provoca", sample: "Você disse que quer isso há cinco anos. O que mudou agora?", variant: "active" },
                ].map(item => (
                  <div key={item.weight} style={{
                    padding: "16px 20px",
                    background: tokens.colors.surface,
                    border: `1px solid ${tokens.colors.border}`,
                    borderRadius: "10px",
                    display: "flex", alignItems: "center", gap: "16px", flexWrap: "wrap" as const,
                  }}>
                    <div style={{ minWidth: "130px", display: "flex", flexDirection: "column", gap: "4px" }}>
                      <DS_Text size="2xs" color="secondary" style={{ fontFamily: "monospace" }}>{item.label}</DS_Text>
                      <DS_Badge variant={item.variant}>{item.voice}</DS_Badge>
                    </div>
                    <p style={{
                      margin: 0, flex: 1,
                      fontFamily: "var(--font-inter), sans-serif",
                      fontSize: "15px",
                      fontWeight: item.weight,
                      color: tokens.colors.northLight,
                      fontStyle: item.weight === 300 ? "italic" : "normal",
                    }}>{item.sample}</p>
                  </div>
                ))}
              </div>
            </Section>
          </div>
        );

      case "components":
        return (
          <div>
            <Section title="Botões" subtitle="Quatro variantes, cada uma com contexto de uso específico.">
              <div style={{ display: "flex", flexWrap: "wrap" as const, gap: "12px", marginBottom: "16px" }}>
                <DS_Button variant="primary">Conectar calendário</DS_Button>
                <DS_Button variant="secondary">Ver plano completo</DS_Button>
                <DS_Button variant="ghost">Cancelar</DS_Button>
                <DS_Button variant="danger">Arquivar sonho</DS_Button>
                <DS_Button variant="primary" disabled>Indisponível</DS_Button>
              </div>
              <div style={{ display: "flex", flexWrap: "wrap" as const, gap: "12px" }}>
                <DS_Button variant="primary" size="sm">Small</DS_Button>
                <DS_Button variant="primary" size="md">Medium</DS_Button>
                <DS_Button variant="primary" size="lg">Large</DS_Button>
              </div>
            </Section>
            <Section title="Badges" subtitle="Estado de cada sonho e bloco.">
              <div style={{ display: "flex", flexWrap: "wrap" as const, gap: "8px" }}>
                <DS_Badge variant="active">Ativo</DS_Badge>
                <DS_Badge variant="complete">Realizado</DS_Badge>
                <DS_Badge variant="pause">Pausado</DS_Badge>
                <DS_Badge variant="archive">Arquivado</DS_Badge>
                <DS_Badge variant="maturing">Maturando</DS_Badge>
                <DS_Badge variant="default">Na Fila</DS_Badge>
              </div>
            </Section>
            <Section title="Progress Bars" subtitle="Apenas blocos executados — nunca percentual de planejamento.">
              <div style={{ display: "flex", flexDirection: "column", gap: "20px", maxWidth: "480px" }}>
                <DS_ProgressBar value={23} label="Blocos executados" />
                <DS_ProgressBar value={67} label="Progresso geral" />
                <DS_ProgressBar value={100} label="Fase 1 concluída" />
              </div>
            </Section>
          </div>
        );

      case "north":
        return (
          <div>
            <Section title="Conversa com North" subtitle="O coração do produto. Cada mensagem tem peso e intenção.">
              <div style={{ display: "flex", flexDirection: "column", gap: "12px", maxWidth: "560px" }}>
                <DS_NorthMessage voice="ouve">Qual é o sonho que você não para de adiar?</DS_NorthMessage>
                <DS_UserMessage>Quero finalmente abrir minha empresa. Tenho esse plano na gaveta há três anos.</DS_UserMessage>
                <DS_NorthMessage voice="pensa">Você quer construir algo seu — e parou de acreditar que vai realmente fazer isso. Isso ressoa?</DS_NorthMessage>
                <div style={{ display: "flex", gap: "8px" }}>
                  <DS_Button variant="secondary" size="sm">Sim, é isso</DS_Button>
                  <DS_Button variant="ghost" size="sm">Não exatamente</DS_Button>
                </div>
              </div>
            </Section>
            <Section title="As Três Vozes">
              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                <DS_NorthMessage voice="ouve">Desde quando esse sonho está com você?</DS_NorthMessage>
                <DS_NorthMessage voice="pensa">Com base no que você me disse, seu plano tem três fases. A primeira começa amanhã.</DS_NorthMessage>
                <DS_NorthMessage voice="provoca">Você disse que quer isso há cinco anos. O que mudou agora para ser diferente?</DS_NorthMessage>
              </div>
            </Section>
            <Section title="Apresentação de North" subtitle="Primeiro contato — presença sem pressa.">
              <div style={{ maxWidth: "400px" }}>
                <div style={{ padding: "40px", background: tokens.colors.deepNight, borderRadius: "16px", border: `1px solid ${tokens.colors.border}`, textAlign: "center" }}>
                  <p style={{ fontFamily: "var(--font-playfair), Georgia, serif", fontSize: "24px", fontWeight: 400, color: tokens.colors.northLight, letterSpacing: "0.08em", margin: "0 0 24px" }}>N</p>
                  <p style={{ fontFamily: "var(--font-inter), sans-serif", fontSize: "16px", fontWeight: 300, color: tokens.colors.northLight, lineHeight: 1.8, margin: "0 0 8px", fontStyle: "italic" }}>
                    Olá. Eu sou North.<br />Vou te ajudar a transformar isso em algo real.
                  </p>
                  <p style={{ fontFamily: "var(--font-inter), sans-serif", fontSize: "16px", fontWeight: 300, color: tokens.colors.mutedSilver, lineHeight: 1.8, margin: 0, fontStyle: "italic" }}>
                    Não tenho pressa.<br />Pode começar.
                  </p>
                </div>
              </div>
            </Section>
            <Section title="Inatividade" subtitle="Presença sem cobrança.">
              <div style={{ maxWidth: "400px" }}>
                <div style={{ padding: "28px", background: tokens.colors.stellarGray, borderRadius: "16px", border: `1px solid ${tokens.colors.border}` }}>
                  <p style={{ fontFamily: "var(--font-playfair), Georgia, serif", fontSize: "13px", color: tokens.colors.mutedSilver, letterSpacing: "0.08em", margin: "0 0 16px" }}>North · 3 dias sem atividade</p>
                  <p style={{ fontFamily: "var(--font-inter), sans-serif", fontSize: "16px", fontWeight: 300, color: tokens.colors.northLight, lineHeight: 1.7, margin: "0 0 20px", fontStyle: "italic" }}>
                    Oi. Não precisei de você esses dias,<br />mas pensei em como você estava.<br />Está tudo bem?
                  </p>
                  <div style={{ display: "flex", gap: "8px" }}>
                    <DS_Button variant="secondary" size="sm">Sim, tudo certo</DS_Button>
                    <DS_Button variant="ghost" size="sm">Foi uma semana difícil</DS_Button>
                  </div>
                </div>
              </div>
            </Section>
          </div>
        );

      case "dreams":
        return (
          <div>
            <Section title="Dream Cards" subtitle="Seis estados de um sonho.">
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: "16px" }}>
                <DS_DreamCard title="Abrir minha empresa" status="active" progress={34} days={87} streak={12} />
                <DS_DreamCard title="Escrever meu livro" status="queued" />
                <DS_DreamCard title="Mudar de carreira" status="maturing" />
                <DS_DreamCard title="Aprender violão" status="completed" />
                <DS_DreamCard title="Aprender alemão" status="paused" />
                <DS_DreamCard title="Sair do emprego CLT" status="archived" />
              </div>
            </Section>
            <Section title="Estágios de Maturidade" subtitle="North classifica internamente — o usuário nunca vê o estágio.">
              {[
                { stage: "01", label: "Intuição", desc: "Sonho vago.", example: '"Quero mudar minha vida"', north: "O que você está fazendo quando sente que está no lugar certo?" },
                { stage: "02", label: "Clareza", desc: "Sonho com forma.", example: '"Quero abrir um negócio"', north: "Por que isso importa para você agora?" },
                { stage: "03", label: "Comprometimento", desc: "Pronto para plano.", example: '"Quero lançar meu SaaS em 6 meses"', north: "Vou construir seu plano agora." },
              ].map(s => (
                <div key={s.stage} style={{ padding: "24px", background: tokens.colors.surface, border: `1px solid ${tokens.colors.border}`, borderRadius: "10px", marginBottom: "8px" }}>
                  <div style={{ display: "flex", gap: "20px", alignItems: "flex-start" }}>
                    <DS_Text size="2xl" weight="light" color="secondary" style={{ fontFamily: "monospace", minWidth: "32px" }}>{s.stage}</DS_Text>
                    <div style={{ flex: 1 }}>
                      <DS_Text size="lg" weight="medium" style={{ marginBottom: "4px" }}>{s.label}</DS_Text>
                      <DS_Text size="sm" color="secondary" style={{ marginBottom: "16px" }}>{s.desc}</DS_Text>
                      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                        <div style={{ padding: "12px 16px", background: tokens.colors.deepNight, borderRadius: "6px" }}>
                          <DS_Text size="2xs" color="secondary" style={{ marginBottom: "4px", letterSpacing: "0.08em", textTransform: "uppercase" }}>Usuário diz</DS_Text>
                          <DS_Text size="sm" style={{ fontStyle: "italic" }}>{s.example}</DS_Text>
                        </div>
                        <div style={{ padding: "12px 16px", background: tokens.colors.stellarGray, borderRadius: "6px", borderLeft: `2px solid ${tokens.colors.mutedSilver}` }}>
                          <DS_Text size="2xs" color="secondary" style={{ marginBottom: "4px", letterSpacing: "0.08em", textTransform: "uppercase" }}>North responde</DS_Text>
                          <DS_Text size="sm" weight="light" style={{ fontStyle: "italic" }}>{s.north}</DS_Text>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </Section>
          </div>
        );

      case "blocks":
        return (
          <div>
            <Section title="Blocos de Execução" subtitle="Quatro estados visuais.">
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                <DS_BlockCard time="07:30" task="Pesquisar concorrentes no mercado" status="completed" />
                <DS_BlockCard time="19:00" task="Rascunhar proposta de valor do produto" status="active" />
                <DS_BlockCard time="20:30" task="Mapear primeiros clientes potenciais" status="scheduled" />
                <DS_BlockCard time="07:30" task="Revisão do plano financeiro" status="missed" />
              </div>
            </Section>
            <Section title="Execução Ativa" subtitle="Interface durante os 30 minutos.">
              <div style={{ maxWidth: "360px" }}>
                <div style={{ background: tokens.colors.stellarGray, border: `1px solid ${tokens.colors.border}`, borderRadius: "16px", padding: "32px", textAlign: "center" }}>
                  <DS_Badge variant="active">Em andamento</DS_Badge>
                  <div style={{ margin: "24px 0" }}>
                    <p style={{ fontFamily: "monospace", fontSize: "52px", fontWeight: 300, color: tokens.colors.northLight, margin: 0, letterSpacing: "0.04em" }}>18:42</p>
                    <DS_Text size="sm" color="secondary" style={{ marginTop: "4px" }}>restantes</DS_Text>
                  </div>
                  <div style={{ padding: "16px", background: tokens.colors.deepNight, borderRadius: "10px", marginBottom: "24px" }}>
                    <DS_Text size="sm" style={{ fontStyle: "italic" }}>Rascunhar proposta de valor do produto</DS_Text>
                  </div>
                  <DS_ProgressBar value={38} />
                  <div style={{ marginTop: "24px" }}>
                    <DS_Button variant="ghost" size="sm">Chamar North</DS_Button>
                  </div>
                </div>
              </div>
            </Section>
            <Section title="Bloco Concluído" subtitle="Silenciosa. Com peso. Sem confetes.">
              <div style={{ maxWidth: "360px" }}>
                <div style={{ background: `${tokens.colors.executeGreen}11`, border: `1px solid ${tokens.colors.executeGreen}33`, borderRadius: "16px", padding: "32px", textAlign: "center" }}>
                  <div style={{ width: "48px", height: "2px", background: tokens.colors.executeGreen, borderRadius: "999px", margin: "0 auto 24px" }} />
                  <DS_Text size="lg" weight="medium" style={{ marginBottom: "8px" }}>Bloco concluído.</DS_Text>
                  <DS_Text size="sm" color="secondary" style={{ marginBottom: "24px" }}>12 dias consecutivos. Você está construindo algo real.</DS_Text>
                  <DS_Button variant="secondary" size="sm">O que você concluiu?</DS_Button>
                </div>
              </div>
            </Section>
          </div>
        );

      case "motion":
        return (
          <div>
            <Section title="Princípios de Motion" subtitle="Cada movimento tem intenção — nunca decorativo.">
              {[
                { name: "Transição de Tela", value: "280ms ease-out", desc: "Urgência que se resolve em calma." },
                { name: "Mensagem de North", value: "Palavra por palavra", desc: "Replica leitura natural. North pensa antes de falar." },
                { name: "Bloco Completado", value: "600ms + pausa 1s", desc: "Linha avança → pausa → North aparece. O silêncio é parte da celebração." },
                { name: "Hover em cards", value: "280ms all", desc: "Background e borda. Sem transform — sem layout shift." },
                { name: "Micro-interações", value: "150-300ms", desc: "Botões: scale(0.98) no press. Suave. Nunca abrupto." },
              ].map((m, i) => (
                <div key={i} style={{
                  display: "flex", gap: "20px", padding: "20px 24px",
                  background: tokens.colors.surface, border: `1px solid ${tokens.colors.border}`,
                  borderRadius: "10px", marginBottom: "8px", alignItems: "flex-start",
                }}>
                  <div style={{ minWidth: "180px" }}>
                    <DS_Text size="sm" weight="medium" style={{ marginBottom: "4px" }}>{m.name}</DS_Text>
                    <DS_Text size="2xs" style={{ fontFamily: "monospace", color: tokens.colors.northBlue }}>{m.value}</DS_Text>
                  </div>
                  <DS_Text size="sm" color="secondary">{m.desc}</DS_Text>
                </div>
              ))}
            </Section>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div style={{ background: tokens.colors.deepNight, minHeight: "100vh", fontFamily: "var(--font-inter), -apple-system, sans-serif", color: tokens.colors.northLight }}>
      {/* Header */}
      <div style={{
        borderBottom: `1px solid ${tokens.colors.border}`,
        padding: "20px 32px",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        position: "sticky" as const, top: 0,
        background: `${tokens.colors.deepNight}F0`,
        backdropFilter: "blur(12px)",
        zIndex: 100, flexWrap: "wrap" as const, gap: "16px",
      }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: "12px" }}>
          <p style={{ fontFamily: "var(--font-playfair), Georgia, serif", fontSize: "18px", fontWeight: 700, color: tokens.colors.northLight, margin: 0, letterSpacing: "0.04em" }}>DP.</p>
          <DS_Text size="sm" color="secondary">Design System</DS_Text>
        </div>
        <DS_Text size="2xs" color="secondary" style={{ letterSpacing: "0.06em", textTransform: "uppercase" }}>v1.0</DS_Text>
      </div>

      <div style={{ display: "flex", minHeight: "calc(100vh - 65px)" }}>
        {/* Sidebar */}
        <div style={{
          width: "200px", borderRight: `1px solid ${tokens.colors.border}`,
          padding: "24px 0", flexShrink: 0,
          position: "sticky" as const, top: "65px",
          height: "calc(100vh - 65px)", overflowY: "auto" as const,
        }}>
          {navItems.map(item => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              style={{
                display: "block", width: "100%",
                padding: "10px 24px",
                background: activeTab === item.id ? tokens.colors.stellarGray : "transparent",
                color: activeTab === item.id ? tokens.colors.northLight : tokens.colors.mutedSilver,
                border: "none",
                borderLeft: `2px solid ${activeTab === item.id ? tokens.colors.northBlue : "transparent"}`,
                textAlign: "left" as const,
                fontSize: "13px",
                fontFamily: "var(--font-inter), sans-serif",
                fontWeight: activeTab === item.id ? 500 : 400,
                cursor: "pointer",
                transition: "all 280ms cubic-bezier(0.4, 0, 0.2, 1)",
              }}
            >{item.label}</button>
          ))}
        </div>

        {/* Content */}
        <div style={{ flex: 1, padding: "40px 48px", overflowY: "auto" as const, maxWidth: "900px" }}>
          {renderContent()}
        </div>
      </div>
    </div>
  );
}
