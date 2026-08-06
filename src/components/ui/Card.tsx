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
        "rounded-2xl border border-gold-400/25 bg-white/60 shadow-[0_2px_20px_-4px_rgba(124,48,56,0.12)] backdrop-blur-sm",
        className
      )}
    >
      {children}
    </div>
  );
}
