import { clsx } from "clsx";

type Tone = "gold" | "olive" | "maroon" | "neutral" | "danger";

const toneClasses: Record<Tone, string> = {
  gold: "bg-gold-400/15 text-gold-500 ring-1 ring-gold-400/30",
  olive: "bg-olive-500/10 text-olive-600 ring-1 ring-olive-500/25",
  maroon: "bg-maroon-600/10 text-maroon-700 ring-1 ring-maroon-600/25",
  neutral: "bg-ink-900/5 text-ink-900/60 ring-1 ring-ink-900/10",
  danger: "bg-red-700/10 text-red-700 ring-1 ring-red-700/25",
};

export function Badge({
  tone = "neutral",
  className,
  children,
}: {
  tone?: Tone;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <span
      className={clsx(
        "inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide",
        toneClasses[tone],
        className
      )}
    >
      {children}
    </span>
  );
}
