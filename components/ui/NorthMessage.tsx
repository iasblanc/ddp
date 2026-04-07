import { cn } from "@/lib/utils";

type Voice = "ouve" | "pensa" | "provoca";

interface NorthMessageProps {
  voice?: Voice;
  children: React.ReactNode;
  streaming?: boolean;
  className?: string;
}

const voiceConfig: Record<Voice, { weight: string; italic: boolean; border: string }> = {
  ouve:    { weight: "font-light",    italic: true,  border: "border-l-muted-silver" },
  pensa:   { weight: "font-medium",   italic: false, border: "border-l-north-blue/50" },
  provoca: { weight: "font-semibold", italic: false, border: "border-l-north-blue" },
};

export function NorthMessage({ voice = "ouve", children, streaming = false, className }: NorthMessageProps) {
  const cfg = voiceConfig[voice];

  return (
    <div className={cn(
      "px-5 py-4 bg-stellar-gray rounded-lg border-l-2 animate-slide-up",
      cfg.border,
      className
    )}>
      <p className="text-2xs text-muted-silver tracking-widest uppercase mb-2">North</p>
      <p className={cn(
        "text-base text-north-light leading-relaxed",
        cfg.weight,
        cfg.italic && "italic"
      )}>
        {children}
        {streaming && <span className="north-cursor" />}
      </p>
    </div>
  );
}

export function NorthThinking() {
  return (
    <div className="flex items-center gap-2 px-5 py-4">
      <span className="text-2xs text-muted-silver tracking-widest uppercase">North</span>
      <div className="flex gap-1 ml-1">
        {[0, 1, 2].map(i => (
          <span
            key={i}
            className="north-dot w-1.5 h-1.5 rounded-full bg-muted-silver"
            style={{ animationDelay: `${i * 0.2}s` }}
          />
        ))}
      </div>
    </div>
  );
}
