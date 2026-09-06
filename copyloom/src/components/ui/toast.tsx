"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "./styles";

export type ToastTone = "success" | "danger" | "info";

export interface ToastMessage {
  id: number;
  text: string;
  tone: ToastTone;
}

let nextId = 0;

export function useToasts() {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const timers = useRef<number[]>([]);

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((t) => t.id !== id));
  }, []);

  const show = useCallback(
    (text: string, tone: ToastTone = "info") => {
      const id = ++nextId;
      setToasts((current) => [...current, { id, text, tone }]);
      const timer = window.setTimeout(() => dismiss(id), 4500);
      timers.current.push(timer);
    },
    [dismiss],
  );

  useEffect(() => {
    const pending = timers.current;
    return () => {
      pending.forEach((t) => window.clearTimeout(t));
    };
  }, []);

  return { toasts, show, dismiss };
}

const TONES: Record<ToastTone, string> = {
  success: "border-success/40 text-success",
  danger: "border-danger/40 text-danger",
  info: "border-border text-fg",
};

export function ToastViewport({
  toasts,
  onDismiss,
}: {
  toasts: ToastMessage[];
  onDismiss: (id: number) => void;
}) {
  return (
    <div
      aria-live="polite"
      aria-atomic="false"
      className="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex flex-col items-center gap-2 p-4 sm:items-end sm:p-6"
    >
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={cn(
            "animate-rise pointer-events-auto flex w-full max-w-sm items-start gap-3",
            "rounded-lg border bg-surface px-4 py-3 text-sm shadow-soft",
            TONES[toast.tone],
          )}
        >
          <p className="min-w-0 flex-1 break-words">{toast.text}</p>
          <button
            type="button"
            onClick={() => onDismiss(toast.id)}
            className="-mr-1 shrink-0 rounded px-1 text-faint hover:text-fg"
          >
            <span className="sr-only">Dismiss</span>
            <span aria-hidden="true">×</span>
          </button>
        </div>
      ))}
    </div>
  );
}
