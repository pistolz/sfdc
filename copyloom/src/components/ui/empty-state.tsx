import type { ReactNode } from "react";
import { cn } from "./styles";

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: ReactNode;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-xl border border-dashed",
        "border-border-strong bg-surface-2/60 px-6 py-12 text-center",
        className,
      )}
    >
      {icon ? (
        <div
          aria-hidden="true"
          className="mb-3 flex size-10 items-center justify-center rounded-lg border border-border bg-surface text-lg"
        >
          {icon}
        </div>
      ) : null}
      <p className="text-[15px] font-semibold">{title}</p>
      {description ? (
        <p className="mt-1.5 max-w-md text-sm text-muted">{description}</p>
      ) : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}
