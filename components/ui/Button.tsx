import { cn } from "@/lib/utils";
import { forwardRef } from "react";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
  loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = "primary", size = "md", loading = false, disabled, className, children, ...props }, ref) => {
    const base = "inline-flex items-center justify-center gap-2 font-medium rounded-md transition-all duration-280 outline-none focus-visible:ring-2 focus-visible:ring-north-blue focus-visible:ring-offset-2 focus-visible:ring-offset-deep-night active:scale-[0.98]";

    const variants = {
      primary:    "bg-north-blue hover:bg-north-blue-dim text-north-light border border-transparent",
      secondary:  "bg-transparent hover:bg-stellar-gray text-north-light border border-border",
      ghost:      "bg-transparent hover:bg-north-light/5 text-muted-silver border border-transparent",
      danger:     "bg-transparent hover:bg-pause-amber-dim text-pause-amber border border-pause-amber/30",
    };

    const sizes = {
      sm: "px-4 py-2 text-xs",
      md: "px-5 py-2.5 text-sm",
      lg: "px-7 py-3.5 text-base",
    };

    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={cn(base, variants[variant], sizes[size], (disabled || loading) && "opacity-50 cursor-not-allowed", className)}
        {...props}
      >
        {loading ? (
          <>
            <span className="flex gap-0.5">
              {[0, 1, 2].map(i => (
                <span
                  key={i}
                  className="north-dot w-1 h-1 rounded-full bg-current"
                  style={{ animationDelay: `${i * 0.2}s` }}
                />
              ))}
            </span>
          </>
        ) : children}
      </button>
    );
  }
);

Button.displayName = "Button";
