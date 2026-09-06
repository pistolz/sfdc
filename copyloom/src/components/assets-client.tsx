"use client";

import Link from "next/link";
import { useState } from "react";
import type { Asset } from "@/lib/types";
import { getGenerator } from "@/lib/generators";
import { Button } from "./ui/button";
import { EmptyState } from "./ui/empty-state";
import { ToastViewport, useToasts } from "./ui/toast";
import { buttonClasses, cn } from "./ui/styles";
import { formatDateTime, formatNumber } from "./format";

const PAGE_SIZE = 30;

export function AssetsClient({
  initialAssets,
  pageSize = PAGE_SIZE,
}: {
  initialAssets: Asset[];
  pageSize?: number;
}) {
  const { toasts, show, dismiss } = useToasts();
  const [assets, setAssets] = useState<Asset[]>(initialAssets);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [exhausted, setExhausted] = useState(initialAssets.length < pageSize);

  async function remove(asset: Asset) {
    setDeletingId(asset.id);
    try {
      const response = await fetch(`/api/assets/${asset.id}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(payload?.error ?? "Could not delete that asset.");
      }
      setAssets((current) => current.filter((item) => item.id !== asset.id));
      show("Asset deleted.", "success");
    } catch (caught) {
      show(
        caught instanceof Error ? caught.message : "Could not delete that asset.",
        "danger",
      );
    } finally {
      setDeletingId(null);
      setConfirmingId(null);
    }
  }

  async function loadMore() {
    const last = assets[assets.length - 1];
    if (!last) return;
    setLoadingMore(true);
    try {
      const response = await fetch(
        `/api/assets?limit=${pageSize}&before=${last.createdAt}`,
      );
      if (!response.ok) throw new Error("Could not load more assets.");
      const payload = (await response.json()) as { assets?: Asset[] };
      const next = payload.assets ?? [];
      setAssets((current) => [...current, ...next]);
      if (next.length < pageSize) setExhausted(true);
    } catch (caught) {
      show(
        caught instanceof Error ? caught.message : "Could not load more assets.",
        "danger",
      );
    } finally {
      setLoadingMore(false);
    }
  }

  if (assets.length === 0) {
    return (
      <>
        <EmptyState
          icon="✳"
          title="No assets yet"
          description="Every generation is saved here with the brief that produced it, so you can revisit, copy or rerun it."
          action={
            <Link href="/app" className={buttonClasses("primary", "md")}>
              Pick a generator
            </Link>
          }
        />
        <ToastViewport toasts={toasts} onDismiss={dismiss} />
      </>
    );
  }

  return (
    <>
      <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface">
        {assets.map((asset) => {
          const generator = getGenerator(asset.generatorId);
          const confirming = confirmingId === asset.id;
          const busy = deletingId === asset.id;
          return (
            <li
              key={asset.id}
              className={cn(
                "flex flex-wrap items-center gap-x-4 gap-y-3 px-4 py-3.5 transition-colors sm:px-5",
                confirming ? "bg-danger-soft" : "hover:bg-surface-2",
              )}
            >
              <span aria-hidden="true" className="text-lg">
                {generator?.icon ?? "◆"}
              </span>

              <Link
                href={`/app/assets/${asset.id}`}
                className="min-w-0 flex-1 rounded"
              >
                <span className="block truncate text-sm font-medium">
                  {asset.title}
                </span>
                <span className="mt-0.5 block truncate text-[13px] text-faint">
                  {generator?.name ?? asset.generatorId} ·{" "}
                  {formatDateTime(asset.createdAt)} ·{" "}
                  {formatNumber(asset.creditsUsed)} credits
                </span>
              </Link>

              {confirming ? (
                <div className="flex items-center gap-2">
                  <span className="text-[13px] text-danger">Delete this?</span>
                  <Button
                    variant="danger"
                    size="sm"
                    loading={busy}
                    onClick={() => remove(asset)}
                  >
                    Delete
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={busy}
                    onClick={() => setConfirmingId(null)}
                  >
                    Cancel
                  </Button>
                </div>
              ) : (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setConfirmingId(asset.id)}
                >
                  Delete
                  <span className="sr-only"> {asset.title}</span>
                </Button>
              )}
            </li>
          );
        })}
      </ul>

      {!exhausted ? (
        <div className="mt-5 flex justify-center">
          <Button variant="secondary" onClick={loadMore} loading={loadingMore}>
            Load more
          </Button>
        </div>
      ) : null}

      <ToastViewport toasts={toasts} onDismiss={dismiss} />
    </>
  );
}
