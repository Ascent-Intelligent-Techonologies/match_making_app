import { InputHTMLAttributes, LabelHTMLAttributes, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";
import { clsx } from "clsx";

const fieldBase =
  "w-full rounded-lg border border-blush-300 bg-white/70 px-3.5 py-2.5 text-[15px] text-ink-900 placeholder:text-ink-900/40 focus:border-maroon-600 focus:outline-none focus:ring-2 focus:ring-maroon-600/15 transition-colors";

export function Field({
  label,
  htmlFor,
  error,
  hint,
  children,
}: {
  label: string;
  htmlFor?: string;
  error?: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <FieldLabel htmlFor={htmlFor}>{label}</FieldLabel>
      {children}
      {hint && !error && <p className="text-xs text-ink-900/50">{hint}</p>}
      {error && <p className="text-xs text-red-700">{error}</p>}
    </div>
  );
}

export function FieldLabel(props: LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label
      {...props}
      className="text-xs font-semibold uppercase tracking-wider text-maroon-700/80"
    />
  );
}

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={clsx(fieldBase, className)} {...props} />;
}

export function Textarea({
  className,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={clsx(fieldBase, "min-h-24 resize-y", className)} {...props} />;
}

export function Select({ className, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={clsx(fieldBase, "cursor-pointer", className)} {...props} />;
}
