"use client";

import { useState } from "react";
import { Markdown } from "./markdown";
import { CopyButton } from "./copy-button";
import { Button } from "./ui/button";
import { cn } from "./ui/styles";

function slugify(value: string): string {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "copyloom-asset"
  );
}

function download(content: string, filename: string, mime: string) {
  const blob = new Blob([content], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  // Give the browser a tick to start the download before revoking.
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function ContentView({
  content,
  format,
  title,
  toolbarExtra,
  className,
}: {
  content: string;
  format: "markdown" | "html";
  title: string;
  toolbarExtra?: React.ReactNode;
  className?: string;
}) {
  const [tab, setTab] = useState<"rendered" | "source">("rendered");
  const isHtml = format === "html";
  const renderedLabel = isHtml ? "Preview" : "Reading view";
  const sourceLabel = isHtml ? "HTML" : "Markdown";

  return (
    <div className={cn("flex min-h-0 flex-col", className)}>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-2.5">
        <div
          role="tablist"
          aria-label="Content view"
          className="inline-flex rounded-lg border border-border bg-surface-2 p-0.5"
        >
          {(["rendered", "source"] as const).map((value) => (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={tab === value}
              onClick={() => setTab(value)}
              className={cn(
                "rounded-[6px] px-3 py-1 text-[13px] font-medium transition-colors",
                tab === value
                  ? "bg-surface text-fg shadow-xs"
                  : "text-muted hover:text-fg",
              )}
            >
              {value === "rendered" ? renderedLabel : sourceLabel}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {toolbarExtra}
          <CopyButton value={content} />
          <Button
            variant="secondary"
            size="sm"
            onClick={() =>
              download(
                content,
                `${slugify(title)}.${isHtml ? "html" : "md"}`,
                isHtml ? "text/html" : "text/markdown",
              )
            }
          >
            Download
          </Button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-auto">
        {tab === "source" ? (
          <div className="scroll-x">
            <pre className="p-4 font-mono text-[13px] leading-relaxed">
              <code>{content}</code>
            </pre>
          </div>
        ) : isHtml ? (
          <iframe
            title={`Preview of ${title}`}
            sandbox="allow-scripts"
            srcDoc={content}
            className="h-full min-h-[60vh] w-full border-0 bg-white"
          />
        ) : (
          <div className="mx-auto max-w-[68ch] px-5 py-6 text-[15px] text-fg">
            <Markdown content={content} />
          </div>
        )}
      </div>
    </div>
  );
}
