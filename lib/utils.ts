import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

// ── CLASS MERGE ───────────────────────────────────────────────
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// ── FORMATAÇÃO DE DATA ────────────────────────────────────────
export function formatDate(date: string | Date, locale = "en"): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(d);
}

export function formatTime(date: string | Date, locale = "en"): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat(locale, {
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

export function formatRelativeTime(date: string | Date, locale = "en"): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return locale === "pt-BR" ? "hoje" : "today";
  if (diffDays === 1) return locale === "pt-BR" ? "ontem" : "yesterday";
  if (diffDays < 7) {
    return locale === "pt-BR"
      ? `há ${diffDays} dias`
      : `${diffDays} days ago`;
  }
  return formatDate(d, locale);
}

// ── CÁLCULO DE STREAK ─────────────────────────────────────────
export function calculateStreak(completedDates: Date[]): number {
  if (!completedDates.length) return 0;

  const sorted = [...completedDates].sort(
    (a, b) => b.getTime() - a.getTime()
  );

  let streak = 0;
  let currentDate = new Date();
  currentDate.setHours(0, 0, 0, 0);

  for (const date of sorted) {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);

    const diffDays = Math.floor(
      (currentDate.getTime() - d.getTime()) / (1000 * 60 * 60 * 24)
    );

    if (diffDays === 0 || diffDays === 1) {
      streak++;
      currentDate = d;
    } else {
      break;
    }
  }

  return streak;
}

// ── CÁLCULO DE PROGRESSO DO PLANO ────────────────────────────
export function calculateProgress(
  completedBlocks: number,
  totalBlocks: number
): number {
  if (totalBlocks === 0) return 0;
  return Math.round((completedBlocks / totalBlocks) * 100);
}

// ── DIAS RESTANTES ────────────────────────────────────────────
export function daysRemaining(deadline: string | Date | null): number | null {
  if (!deadline) return null;
  const d = typeof deadline === "string" ? new Date(deadline) : deadline;
  const now = new Date();
  const diffMs = d.getTime() - now.getTime();
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
}

// ── TRUNCAR TEXTO ─────────────────────────────────────────────
export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength).trimEnd() + "…";
}

// ── DELAY PARA ANIMAÇÕES ──────────────────────────────────────
export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ── DETECTAR IDIOMA DO BROWSER ────────────────────────────────
export function detectLocale(): "en" | "pt-BR" | "es" {
  if (typeof navigator === "undefined") return "en";
  const lang = navigator.language.toLowerCase();
  if (lang.startsWith("pt")) return "pt-BR";
  if (lang.startsWith("es")) return "es";
  return "en";
}

// ── VALIDAÇÃO DE EMAIL ────────────────────────────────────────
export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}
