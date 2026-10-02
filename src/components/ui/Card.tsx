import { clsx } from "clsx";

export function Card({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={clsx(
        // The card shadow is a tint of the primary colour, so it follows the theme
        // rather than staying the maroon it started life as.
        "rounded-2xl border border-gold-400/25 bg-white/60 backdrop-blur-sm",
        "shadow-[0_2px_20px_-4px_color-mix(in_srgb,var(--color-maroon-600)_14%,transparent)]",
        className
      )}
    >
      {children}
    </div>
  );
}
