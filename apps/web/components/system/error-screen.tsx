"use client";

import { useEffect } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

const RELOAD_GUARD = "teamspree:stale-bundle-reloaded";

/**
 * A deploy renames every content-hashed chunk. A tab that was open across the
 * deploy still holds the old shell, so the first route it code-splits into asks
 * for a chunk that no longer exists on the CDN and the boundary trips.
 *
 * reset() can never fix that — it re-renders a tree whose JavaScript is gone.
 * Only a document reload can, so detect this class of failure and do it.
 */
function isStaleBundleError(error: Error) {
  const text = `${error.name} ${error.message}`;
  return (
    error.name === "ChunkLoadError" ||
    /Loading (CSS )?chunk .* failed/i.test(text) ||
    /Failed to (load|fetch) (dynamically imported module|chunk)/i.test(text) ||
    /error loading dynamically imported module/i.test(text)
  );
}

export function ErrorScreen({
  error,
  reset,
  description = "An unexpected error occurred while loading this page.",
}: {
  error: Error & { digest?: string };
  reset: () => void;
  description?: string;
}) {
  const stale = isStaleBundleError(error);

  useEffect(() => {
    console.error(error);
  }, [error]);

  useEffect(() => {
    if (!stale) return;
    // Time-based rather than once-per-tab: a reload that fixes things makes the
    // stamp irrelevant, while a chunk that is genuinely gone fails again within
    // a second or two and gets held back instead of looping.
    const last = Number(sessionStorage.getItem(RELOAD_GUARD) ?? 0);
    if (Date.now() - last < 10_000) return;
    sessionStorage.setItem(RELOAD_GUARD, String(Date.now()));
    window.location.reload();
  }, [stale]);

  if (stale) {
    return (
      <div className="flex h-screen w-screen flex-col items-center justify-center gap-3 bg-background p-6 text-center">
        <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
        <p className="text-sm font-medium">Updating to the latest version…</p>
        <p className="max-w-sm text-sm text-muted-foreground">
          A new version was just released. If this doesn&apos;t clear on its own, reload the page.
        </p>
        <Button variant="secondary" onClick={() => window.location.reload()}>
          Reload now
        </Button>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-screen flex-col items-center justify-center gap-3 bg-background p-6 text-center">
      <AlertTriangle className="h-8 w-8 text-destructive" />
      <p className="text-sm font-medium">Something went wrong</p>
      <p className="max-w-sm text-sm text-muted-foreground">{description}</p>
      <div className="flex items-center gap-2">
        <Button onClick={reset}>Try again</Button>
        <Button variant="secondary" onClick={() => window.location.reload()}>
          Reload page
        </Button>
      </div>
      {error.digest && <p className="mt-1 text-xs text-muted-foreground">Reference: {error.digest}</p>}
    </div>
  );
}
