import Link from "next/link";
import { BRAND } from "@/lib/brand";
import { cn } from "./ui/styles";

/** The mark: warp threads crossed by a weft — a loom, abstracted. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className={cn("size-6 shrink-0", className)}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
    >
      <path d="M5 3v18M12 3v18M19 3v18" opacity="0.45" />
      <path d="M2.5 8.5c3 2 6.5 2 9.5 0s6.5-2 9.5 0" />
      <path d="M2.5 15.5c3 2 6.5 2 9.5 0s6.5-2 9.5 0" />
    </svg>
  );
}

export function Wordmark({
  href = "/",
  className,
}: {
  href?: string;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "inline-flex items-center gap-2 rounded-md text-fg",
        className,
      )}
    >
      <LogoMark className="text-accent" />
      <span className="text-[17px] font-semibold tracking-tight">
        {BRAND.name}
      </span>
    </Link>
  );
}
