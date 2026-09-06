"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import type { Field as GeneratorField } from "@/lib/generators";
import type { AccountView, BrandKit } from "@/lib/types";
import { ContentView } from "./content-view";
import { PageHeader } from "./page-header";
import { Alert } from "./ui/alert";
import { Button } from "./ui/button";
import { Field, Input, Select, Textarea } from "./ui/field";
import { EmptyState } from "./ui/empty-state";
import { Spinner } from "./ui/spinner";
import { buttonClasses, cardClasses, cn } from "./ui/styles";
import { formatNumber } from "./format";

/** The serialisable half of a Generator — `instruction` stays on the server. */
export interface GeneratorView {
  id: string;
  name: string;
  icon: string;
  category: string;
  blurb: string;
  format: "markdown" | "html";
  maxTokens: number;
  fields: GeneratorField[];
}

interface DoneResult {
  assetId: string;
  title: string;
  creditsUsed: number;
  creditsRemaining: number;
}

type StreamEvent =
  | { type: "start" }
  | { type: "delta"; text: string }
  | {
      type: "done";
      assetId: string;
      title: string;
      creditsUsed: number;
      creditsRemaining: number;
    }
  | { type: "error"; message: string };

function parseEvent(raw: string): StreamEvent | null {
  const line = raw
    .split("\n")
    .map((part) => part.trim())
    .find((part) => part.startsWith("data:"));
  if (!line) return null;
  try {
    const parsed: unknown = JSON.parse(line.slice(5).trim());
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      "type" in parsed &&
      typeof (parsed as { type: unknown }).type === "string"
    ) {
      return parsed as StreamEvent;
    }
  } catch {
    // A truncated or non-JSON frame is skipped rather than killing the stream.
  }
  return null;
}

function defaultValues(fields: GeneratorField[]): Record<string, string> {
  const values: Record<string, string> = {};
  for (const field of fields) {
    values[field.name] =
      field.type === "select" && field.required ? (field.options?.[0] ?? "") : "";
  }
  return values;
}

export function StudioClient({
  generator,
  brands,
  account,
  estimate,
}: {
  generator: GeneratorView;
  brands: BrandKit[];
  account: AccountView;
  estimate: number;
}) {
  const router = useRouter();
  const ids = useId();

  const [values, setValues] = useState<Record<string, string>>(() =>
    defaultValues(generator.fields),
  );
  const [brandId, setBrandId] = useState<string>(brands[0]?.id ?? "");
  const [output, setOutput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [result, setResult] = useState<DoneResult | null>(null);

  const abortRef = useRef<AbortController | null>(null);
  const liveRef = useRef<HTMLDivElement | null>(null);
  const stickRef = useRef(true);

  // Auto-scroll the live output unless the reader has scrolled away from the end.
  useEffect(() => {
    const node = liveRef.current;
    if (!node || !stickRef.current) return;
    node.scrollTop = node.scrollHeight;
  }, [output]);

  useEffect(() => () => abortRef.current?.abort(), []);

  const onScroll = useCallback(() => {
    const node = liveRef.current;
    if (!node) return;
    stickRef.current =
      node.scrollHeight - node.scrollTop - node.clientHeight < 48;
  }, []);

  function setValue(name: string, value: string) {
    setValues((current) => ({ ...current, [name]: value }));
  }

  function stop() {
    abortRef.current?.abort();
    abortRef.current = null;
    setStreaming(false);
  }

  async function run(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setFieldError(null);

    const missing = generator.fields.find(
      (field) => field.required && !values[field.name]?.trim(),
    );
    if (missing) {
      setFieldError(`"${missing.label}" is required.`);
      document.getElementById(`${ids}-${missing.name}`)?.focus();
      return;
    }

    const controller = new AbortController();
    abortRef.current = controller;
    setStreaming(true);
    setOutput("");
    setResult(null);
    stickRef.current = true;

    try {
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          generatorId: generator.id,
          brandId: brandId || null,
          inputs: values,
        }),
      });

      // Failures before the stream opens come back as ordinary JSON.
      if (!response.ok || !response.body) {
        const payload = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(
          payload?.error ??
            (response.status === 401
              ? "Your session expired. Sign in again."
              : "The generator could not be started."),
        );
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let finished = false;

      while (!finished) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        let split = buffer.indexOf("\n\n");
        while (split !== -1) {
          const frame = buffer.slice(0, split);
          buffer = buffer.slice(split + 2);
          const parsed = parseEvent(frame);
          if (parsed) {
            if (parsed.type === "delta") {
              setOutput((current) => current + parsed.text);
            } else if (parsed.type === "done") {
              setResult({
                assetId: parsed.assetId,
                title: parsed.title,
                creditsUsed: parsed.creditsUsed,
                creditsRemaining: parsed.creditsRemaining,
              });
              finished = true;
            } else if (parsed.type === "error") {
              setError(parsed.message);
              finished = true;
            }
          }
          split = buffer.indexOf("\n\n");
        }
      }

      if (finished) {
        await reader.cancel().catch(() => undefined);
        // Refresh so the shell's credit meter reflects the new balance.
        router.refresh();
      }
    } catch (caught) {
      if (!(caught instanceof DOMException && caught.name === "AbortError")) {
        setError(
          caught instanceof Error
            ? caught.message
            : "Something went wrong while generating.",
        );
      }
    } finally {
      abortRef.current = null;
      setStreaming(false);
    }
  }

  const outOfCredits = account.credits <= 0;
  const hasOutput = output.length > 0;

  return (
    <>
      <PageHeader
        breadcrumb={
          <Link href="/app" className="rounded hover:text-fg">
            ← All generators
          </Link>
        }
        title={generator.name}
        description={generator.blurb}
        actions={
          <span className="rounded-full border border-border px-3 py-1 text-[13px] text-muted tabular-nums">
            ~{estimate} credits · {formatNumber(account.credits)} left
          </span>
        }
      />

      <div className="grid min-w-0 gap-6 px-5 py-6 lg:grid-cols-[minmax(320px,380px)_minmax(0,1fr)] lg:px-8">
        {/* Brief ---------------------------------------------------------- */}
        <div className="min-w-0">
          <form
            onSubmit={run}
            className={cn(cardClasses, "space-y-5 p-5 lg:sticky lg:top-6")}
            aria-label={`${generator.name} brief`}
          >
            <div>
              <h2 className="text-[15px] font-semibold tracking-tight">Brief</h2>
              <p className="mt-1 text-[13px] text-muted">
                The more specific you are, the less editing you will do.
              </p>
            </div>

            {brands.length ? (
              <Field
                id={`${ids}-brand`}
                label="Brand kit"
                help="Its voice, audience and banned words are prepended to the prompt."
              >
                <Select
                  id={`${ids}-brand`}
                  value={brandId}
                  onChange={(event) => setBrandId(event.target.value)}
                >
                  <option value="">No brand kit</option>
                  {brands.map((brand) => (
                    <option key={brand.id} value={brand.id}>
                      {brand.name || "Untitled kit"}
                    </option>
                  ))}
                </Select>
              </Field>
            ) : (
              <div className="rounded-lg border border-dashed border-border-strong bg-surface-2/60 p-4">
                <p className="text-sm font-medium">No brand kit yet</p>
                <p className="mt-1 text-[13px] text-muted">
                  Output stays generic until you brief it on your brand.
                </p>
                <Link
                  href="/app/brand"
                  className={buttonClasses("secondary", "sm", "mt-3")}
                >
                  Create a brand kit
                </Link>
              </div>
            )}

            {generator.fields.map((field) => {
              const inputId = `${ids}-${field.name}`;
              return (
                <Field
                  key={field.name}
                  id={inputId}
                  label={field.label}
                  help={field.help}
                  required={field.required}
                >
                  {field.type === "textarea" ? (
                    <Textarea
                      id={inputId}
                      name={field.name}
                      rows={4}
                      required={field.required}
                      placeholder={field.placeholder}
                      value={values[field.name] ?? ""}
                      onChange={(event) =>
                        setValue(field.name, event.target.value)
                      }
                    />
                  ) : field.type === "select" ? (
                    <Select
                      id={inputId}
                      name={field.name}
                      value={values[field.name] ?? ""}
                      onChange={(event) =>
                        setValue(field.name, event.target.value)
                      }
                    >
                      {!field.required ? <option value="">No preference</option> : null}
                      {(field.options ?? []).map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </Select>
                  ) : (
                    <Input
                      id={inputId}
                      name={field.name}
                      required={field.required}
                      placeholder={field.placeholder}
                      value={values[field.name] ?? ""}
                      onChange={(event) =>
                        setValue(field.name, event.target.value)
                      }
                    />
                  )}
                </Field>
              );
            })}

            {fieldError ? (
              <p role="alert" className="text-[13px] text-danger">
                {fieldError}
              </p>
            ) : null}

            {outOfCredits ? (
              <Alert
                tone="warning"
                title="No credits left"
                action={
                  <Link
                    href="/app/billing"
                    className={buttonClasses("primary", "sm")}
                  >
                    Upgrade
                  </Link>
                }
              >
                Your allowance refills at the end of the period.
              </Alert>
            ) : null}

            <div className="flex gap-2">
              <Button
                type="submit"
                size="lg"
                className="flex-1"
                loading={streaming}
                disabled={streaming || outOfCredits}
              >
                {streaming ? "Writing…" : hasOutput ? "Run again" : "Generate"}
              </Button>
              {streaming ? (
                <Button variant="secondary" size="lg" onClick={stop}>
                  Stop
                </Button>
              ) : null}
            </div>
          </form>
        </div>

        {/* Output --------------------------------------------------------- */}
        <div className={cn(cardClasses, "flex min-h-[60vh] min-w-0 flex-col")}>
          {error ? (
            <div className="border-b border-border p-4">
              <Alert tone="danger" title="Generation failed">
                {error}
              </Alert>
            </div>
          ) : null}

          {result && !streaming ? (
            <div className="flex flex-wrap items-center gap-3 border-b border-border bg-success-soft px-4 py-3 text-[13px] text-success">
              <span className="font-medium">Saved to your library</span>
              <span aria-hidden="true">·</span>
              <span className="tabular-nums">
                {formatNumber(result.creditsUsed)} credits used,{" "}
                {formatNumber(result.creditsRemaining)} left
              </span>
              <Link
                href={`/app/assets/${result.assetId}`}
                className="ml-auto rounded underline underline-offset-4 hover:opacity-80"
              >
                Open asset
              </Link>
            </div>
          ) : null}

          {!hasOutput && !streaming ? (
            <div className="flex flex-1 items-center justify-center p-6">
              <EmptyState
                className="w-full border-0 bg-transparent"
                icon={generator.icon}
                title="Your draft will appear here"
                description={`Fill in the brief and hit generate. ${generator.format === "html" ? "You will get a live preview and the raw HTML." : "You will get a clean reading view and the raw markdown."}`}
              />
            </div>
          ) : streaming || !result ? (
            <>
              <div className="flex items-center gap-2 border-b border-border px-4 py-2.5 text-[13px] text-muted">
                {streaming ? (
                  <>
                    <Spinner className="size-3.5 text-accent" />
                    <span>Writing…</span>
                  </>
                ) : (
                  <span>Stopped — partial draft</span>
                )}
                <span className="ml-auto tabular-nums text-faint">
                  {formatNumber(output.length)} characters
                </span>
              </div>
              <div
                ref={liveRef}
                onScroll={onScroll}
                aria-live="polite"
                aria-atomic="false"
                aria-busy={streaming}
                className="scroll-x min-h-0 flex-1 overflow-y-auto p-4"
              >
                <pre className="font-mono text-[13px] leading-relaxed whitespace-pre-wrap">
                  {output}
                  {streaming ? (
                    <span
                      aria-hidden="true"
                      className="ml-0.5 inline-block h-4 w-[2px] animate-caret bg-accent align-text-bottom"
                    />
                  ) : null}
                </pre>
              </div>
              {!streaming && hasOutput ? (
                <div className="border-t border-border px-4 py-3">
                  <p className="text-[13px] text-muted">
                    This draft was stopped early and was not saved. Run again to
                    finish it.
                  </p>
                </div>
              ) : null}
            </>
          ) : (
            <ContentView
              className={cn("min-h-0 flex-1")}
              content={output}
              format={generator.format}
              title={result.title || generator.name}
              toolbarExtra={
                <Link
                  href={`/app/assets/${result.assetId}`}
                  className={buttonClasses("ghost", "sm")}
                >
                  Open asset
                </Link>
              }
            />
          )}
        </div>
      </div>
    </>
  );
}
