"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId, useState } from "react";
import { EMPTY_BRAND, type BrandKit, type BrandKitInput } from "@/lib/types";
import { Alert } from "./ui/alert";
import { Button } from "./ui/button";
import { Field, Input, Textarea } from "./ui/field";
import { EmptyState } from "./ui/empty-state";
import { ToastViewport, useToasts } from "./ui/toast";
import { buttonClasses, cardClasses, cn } from "./ui/styles";
import { formatDate } from "./format";

type FieldKey = keyof BrandKitInput;

interface FieldSpec {
  key: FieldKey;
  label: string;
  placeholder: string;
  help?: string;
  multiline?: boolean;
  rows?: number;
  required?: boolean;
}

/**
 * Placeholders do real work here: they are the difference between a kit that
 * shapes the copy and one that reads like a form someone rushed.
 */
const FIELDS: FieldSpec[] = [
  {
    key: "name",
    label: "Brand name",
    placeholder: "Northwind Analytics",
    required: true,
  },
  {
    key: "website",
    label: "Website",
    placeholder: "https://northwind.com",
  },
  {
    key: "oneLiner",
    label: "One-liner",
    placeholder:
      "Scheduled reporting for finance teams who close the books every month.",
    help: "What you sell and who it is for, in one sentence a stranger would understand.",
    multiline: true,
    rows: 2,
  },
  {
    key: "audience",
    label: "Audience",
    placeholder:
      "Controllers and FP&A leads at 50–500 person B2B companies. They live in spreadsheets, distrust dashboards, and get judged on close speed.",
    help: "Role, company size, and what they are measured on. Specific beats broad.",
    multiline: true,
    rows: 3,
  },
  {
    key: "tone",
    label: "Voice and tone",
    placeholder:
      "Plain and specific. A little dry. Short sentences. No exclamation marks, no hype, no metaphors about journeys.",
    help: "Describe how you sound the way you would brief a new copywriter.",
    multiline: true,
    rows: 3,
  },
  {
    key: "valueProps",
    label: "Value propositions",
    placeholder:
      "One per line:\nCuts month-end close from five days to two\nEvery number traces back to the source ledger\nFinance owns the reports without waiting on data engineering",
    help: "Outcomes, not features. One per line.",
    multiline: true,
    rows: 4,
  },
  {
    key: "differentiators",
    label: "Differentiators",
    placeholder:
      "Unlike generic BI tools, we ship a finance data model out of the box, so there is no six-week modelling project before the first report.",
    help: "Why you win against the alternative people are actually comparing you to.",
    multiline: true,
    rows: 3,
  },
  {
    key: "bannedWords",
    label: "Words to avoid",
    placeholder: "leverage, seamless, revolutionary, game-changing, unlock, empower",
    help: "Comma-separated. These never appear in your output.",
    multiline: true,
    rows: 2,
  },
  {
    key: "exampleCopy",
    label: "Example copy",
    placeholder:
      "Paste 100–300 words you are happy with — a homepage section, a good email, a post that landed. It is used as the voice reference.",
    help: "The single highest-leverage field. Real approved copy beats any adjective.",
    multiline: true,
    rows: 6,
  },
  {
    key: "defaultCta",
    label: "Default call to action",
    placeholder: "Book a 20-minute walkthrough",
    help: "Used when a generation needs a CTA and the brief does not give one.",
  },
];

function toInput(brand: BrandKit): BrandKitInput {
  const { id: _id, createdAt: _createdAt, updatedAt: _updatedAt, ...rest } = brand;
  return rest;
}

export function BrandManager({
  initialBrands,
  limit,
  planName,
}: {
  initialBrands: BrandKit[];
  /** -1 means unlimited. */
  limit: number;
  planName: string;
}) {
  const router = useRouter();
  const ids = useId();
  const { toasts, show, dismiss } = useToasts();

  const [brands, setBrands] = useState<BrandKit[]>(initialBrands);
  const [editingId, setEditingId] = useState<string | null>(
    initialBrands.length ? null : "new",
  );
  const [values, setValues] = useState<BrandKitInput>({ ...EMPTY_BRAND });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const atLimit = limit !== -1 && brands.length >= limit;
  const isNew = editingId === "new";
  const editing = isNew
    ? null
    : (brands.find((brand) => brand.id === editingId) ?? null);
  const formOpen = editingId !== null;

  function startNew() {
    setValues({ ...EMPTY_BRAND });
    setEditingId("new");
    setError(null);
  }

  function startEdit(brand: BrandKit) {
    setValues(toInput(brand));
    setEditingId(brand.id);
    setError(null);
  }

  function closeForm() {
    setEditingId(null);
    setError(null);
  }

  function setValue(key: FieldKey, value: string) {
    setValues((current) => ({ ...current, [key]: value }));
  }

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (!values.name.trim()) {
      setError("Give the kit a name so you can tell your brands apart.");
      return;
    }

    setSaving(true);
    try {
      const response = await fetch(
        isNew ? "/api/brands" : `/api/brands/${editingId}`,
        {
          method: isNew ? "POST" : "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(values),
        },
      );
      const payload = (await response.json().catch(() => null)) as {
        brand?: BrandKit;
        error?: string;
      } | null;

      if (!response.ok || !payload?.brand) {
        // 400 covers the "upgrade to add more" plan-limit response.
        throw new Error(payload?.error ?? "Could not save that brand kit.");
      }

      const saved = payload.brand;
      setBrands((current) =>
        isNew
          ? [...current, saved]
          : current.map((brand) => (brand.id === saved.id ? saved : brand)),
      );
      setEditingId(saved.id);
      show(isNew ? "Brand kit created." : "Brand kit saved.", "success");
      router.refresh();
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Could not save that brand kit.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function remove(brand: BrandKit) {
    setDeletingId(brand.id);
    try {
      const response = await fetch(`/api/brands/${brand.id}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(payload?.error ?? "Could not delete that brand kit.");
      }
      setBrands((current) => current.filter((item) => item.id !== brand.id));
      if (editingId === brand.id) setEditingId(null);
      show("Brand kit deleted.", "success");
      router.refresh();
    } catch (caught) {
      show(
        caught instanceof Error
          ? caught.message
          : "Could not delete that brand kit.",
        "danger",
      );
    } finally {
      setDeletingId(null);
      setConfirmingId(null);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,320px)_minmax(0,1fr)]">
      {/* Kits ------------------------------------------------------------- */}
      <div className="min-w-0 space-y-4">
        <div className={cn(cardClasses, "p-4")}>
          <div className="flex items-baseline justify-between gap-2">
            <h2 className="text-[15px] font-semibold tracking-tight">
              Your kits
            </h2>
            <span className="text-[13px] text-faint tabular-nums">
              {brands.length}
              {limit === -1 ? "" : ` / ${limit}`}
            </span>
          </div>
          <p className="mt-1 text-[13px] text-muted">
            {limit === -1
              ? `${planName} includes unlimited brand kits.`
              : `${planName} includes ${limit} brand kit${limit === 1 ? "" : "s"}.`}
          </p>

          {brands.length ? (
            <ul className="mt-4 space-y-2">
              {brands.map((brand) => {
                const active = editingId === brand.id;
                const confirming = confirmingId === brand.id;
                return (
                  <li key={brand.id}>
                    <div
                      className={cn(
                        "rounded-lg border p-3 transition-colors",
                        active
                          ? "border-accent-soft-border bg-accent-soft"
                          : "border-border hover:bg-surface-2",
                      )}
                    >
                      <button
                        type="button"
                        onClick={() => startEdit(brand)}
                        className="block w-full rounded text-left"
                      >
                        <span
                          className={cn(
                            "block truncate text-sm font-medium",
                            active && "text-accent-text",
                          )}
                        >
                          {brand.name || "Untitled kit"}
                        </span>
                        <span className="mt-0.5 block truncate text-[12px] text-faint">
                          {brand.oneLiner || `Updated ${formatDate(brand.updatedAt)}`}
                        </span>
                      </button>

                      <div className="mt-2 flex items-center gap-2">
                        {confirming ? (
                          <>
                            <span className="text-[12px] text-danger">
                              Delete?
                            </span>
                            <Button
                              variant="danger"
                              size="sm"
                              loading={deletingId === brand.id}
                              onClick={() => remove(brand)}
                            >
                              Yes, delete
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setConfirmingId(null)}
                            >
                              Cancel
                            </Button>
                          </>
                        ) : (
                          <>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => startEdit(brand)}
                            >
                              Edit
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setConfirmingId(brand.id)}
                            >
                              Delete
                              <span className="sr-only"> {brand.name}</span>
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="mt-4 text-[13px] text-faint">
              No kits yet. Create your first one on the right.
            </p>
          )}

          <div className="mt-4">
            {atLimit ? (
              <Alert tone="info">
                You have used every brand kit on {planName}.{" "}
                <Link
                  href="/app/billing"
                  className="rounded underline underline-offset-2"
                >
                  Upgrade
                </Link>{" "}
                to add more.
              </Alert>
            ) : (
              <Button
                variant="secondary"
                className="w-full"
                onClick={startNew}
                disabled={isNew}
              >
                New brand kit
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Form ------------------------------------------------------------- */}
      <div className="min-w-0">
        {formOpen ? (
          <form
            onSubmit={save}
            aria-label={isNew ? "Create brand kit" : "Edit brand kit"}
            className={cardClasses}
          >
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4">
              <div>
                <h2 className="text-[15px] font-semibold tracking-tight">
                  {isNew ? "New brand kit" : `Editing ${editing?.name || "kit"}`}
                </h2>
                <p className="mt-1 text-[13px] text-muted">
                  Everything here is prepended to every generation.
                </p>
              </div>
              {!isNew || brands.length > 0 ? (
                <Button variant="ghost" size="sm" onClick={closeForm}>
                  Close
                </Button>
              ) : null}
            </div>

            <div className="space-y-5 p-5">
              {error ? <Alert tone="danger">{error}</Alert> : null}

              {FIELDS.map((spec) => {
                const inputId = `${ids}-${spec.key}`;
                return (
                  <Field
                    key={spec.key}
                    id={inputId}
                    label={spec.label}
                    help={spec.help}
                    required={spec.required}
                  >
                    {spec.multiline ? (
                      <Textarea
                        id={inputId}
                        name={spec.key}
                        rows={spec.rows ?? 3}
                        placeholder={spec.placeholder}
                        value={values[spec.key]}
                        onChange={(event) =>
                          setValue(spec.key, event.target.value)
                        }
                      />
                    ) : (
                      <Input
                        id={inputId}
                        name={spec.key}
                        placeholder={spec.placeholder}
                        required={spec.required}
                        value={values[spec.key]}
                        onChange={(event) =>
                          setValue(spec.key, event.target.value)
                        }
                      />
                    )}
                  </Field>
                );
              })}
            </div>

            <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border px-5 py-4">
              <Button variant="ghost" onClick={closeForm} disabled={saving}>
                Cancel
              </Button>
              <Button type="submit" loading={saving}>
                {isNew ? "Create brand kit" : "Save changes"}
              </Button>
            </div>
          </form>
        ) : (
          <EmptyState
            icon="◈"
            title="Pick a kit to edit"
            description="Or create a new one. Kits are what keep every newsletter, ad and landing page sounding like the same company."
            action={
              !atLimit ? (
                <button
                  type="button"
                  onClick={startNew}
                  className={buttonClasses("primary", "md")}
                >
                  New brand kit
                </button>
              ) : undefined
            }
          />
        )}
      </div>

      <ToastViewport toasts={toasts} onDismiss={dismiss} />
    </div>
  );
}
