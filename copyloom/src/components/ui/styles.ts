/**
 * Shared class recipes.
 *
 * Kept in a plain module (no "use client") so both server and client components
 * can import them, and so the class strings live in exactly one place.
 */

export type ClassValue = string | false | null | undefined;

export function cn(...values: ClassValue[]): string {
  return values.filter(Boolean).join(" ");
}

export type ButtonVariant =
  | "primary"
  | "secondary"
  | "ghost"
  | "danger"
  | "link";
export type ButtonSize = "sm" | "md" | "lg";

const BASE =
  "inline-flex items-center justify-center gap-2 rounded-lg font-medium " +
  "transition-colors duration-150 select-none whitespace-nowrap " +
  "disabled:pointer-events-none disabled:opacity-50 " +
  "focus-visible:outline-2 focus-visible:outline-offset-2";

const VARIANTS: Record<ButtonVariant, string> = {
  primary: "bg-accent text-accent-fg hover:bg-accent-hover shadow-xs",
  secondary:
    "bg-surface text-fg border border-border-strong hover:bg-surface-2",
  ghost: "text-muted hover:text-fg hover:bg-surface-2",
  danger:
    "bg-transparent text-danger border border-border hover:bg-danger-soft hover:border-danger",
  link: "text-accent-text underline underline-offset-4 hover:opacity-80 rounded-sm",
};

const SIZES: Record<ButtonSize, string> = {
  sm: "h-8 px-3 text-[13px]",
  md: "h-10 px-4 text-sm",
  lg: "h-12 px-6 text-[15px]",
};

export function buttonClasses(
  variant: ButtonVariant = "primary",
  size: ButtonSize = "md",
  extra?: ClassValue,
): string {
  return cn(
    BASE,
    VARIANTS[variant],
    variant === "link" ? "h-auto p-0" : SIZES[size],
    extra,
  );
}

export const fieldClasses =
  "w-full rounded-lg border border-border-strong bg-surface px-3 py-2 text-sm " +
  "text-fg shadow-xs transition-colors placeholder:text-faint " +
  "hover:border-faint focus:border-accent focus-visible:outline-2 " +
  "focus-visible:outline-offset-1 disabled:opacity-60";

export const cardClasses =
  "rounded-xl border border-border bg-surface";

export const labelClasses = "block text-sm font-medium text-fg";
