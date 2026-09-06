"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "./ui/button";
import type { ButtonSize, ButtonVariant } from "./ui/styles";

export function CopyButton({
  value,
  label = "Copy",
  variant = "secondary",
  size = "sm",
  className,
}: {
  value: string;
  label?: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
}) {
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");
  const timer = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (timer.current) window.clearTimeout(timer.current);
    },
    [],
  );

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setState("copied");
    } catch {
      setState("failed");
    }
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setState("idle"), 2000);
  }

  return (
    <>
      <Button
        variant={variant}
        size={size}
        className={className}
        onClick={copy}
        disabled={!value}
      >
        {state === "copied" ? "Copied" : state === "failed" ? "Press ⌘C" : label}
      </Button>
      <span className="sr-only" role="status" aria-live="polite">
        {state === "copied"
          ? "Copied to clipboard"
          : state === "failed"
            ? "Copying failed, copy manually"
            : ""}
      </span>
    </>
  );
}
