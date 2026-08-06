import { ButtonHTMLAttributes, forwardRef } from "react";
import { clsx } from "clsx";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

const variantClasses: Record<Variant, string> = {
  primary:
    "bg-maroon-600 text-blush-50 hover:bg-maroon-700 shadow-sm shadow-maroon-600/20",
  secondary:
    "bg-transparent border border-gold-400 text-maroon-700 hover:bg-blush-100",
  ghost: "bg-transparent text-maroon-700 hover:bg-blush-100",
  danger: "bg-red-700 text-white hover:bg-red-800",
};

const sizeClasses: Record<Size, string> = {
  sm: "px-3 py-1.5 text-sm",
  md: "px-5 py-2.5 text-sm",
  lg: "px-7 py-3 text-base",
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", ...props }, ref) => (
    <button
      ref={ref}
      className={clsx(
        "inline-flex items-center justify-center gap-2 rounded-full font-medium tracking-wide transition-colors disabled:opacity-50 disabled:pointer-events-none cursor-pointer",
        variantClasses[variant],
        sizeClasses[size],
        className
      )}
      {...props}
    />
  )
);
Button.displayName = "Button";
