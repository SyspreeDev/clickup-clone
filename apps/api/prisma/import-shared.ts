/**
 * Pieces shared by the two ClickUp importers (import-clickup.ts for a CSV export,
 * import-clickup-api.ts for a live pull via the ClickUp API). Both recreate the same
 * Space → Folder → List → Task shape against the same SySpree pipeline, so the
 * mapping logic belongs in one place rather than drifting between two copies.
 */

/** Mirrors DEFAULT_WORKFLOW_STATES in project.service.ts — the SySpree pipeline. */
export const PIPELINE: Array<{ name: string; category: "UNSTARTED" | "STARTED" | "COMPLETED"; color: string }> = [
  { name: "Open", category: "UNSTARTED", color: "#87909e" },
  { name: "Design (Figma)", category: "STARTED", color: "#14b8a6" },
  { name: "In Progress / Web Dev", category: "STARTED", color: "#3b82f6" },
  { name: "In Review", category: "STARTED", color: "#f59e0b" },
  { name: "Closed", category: "COMPLETED", color: "#22c55e" },
];

export const LABEL_COLORS = ["#ff9412", "#3b82f6", "#14b8a6", "#a855f7", "#ef4444", "#22c55e", "#f59e0b"];

export const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");

export function flag(args: string[], name: string): string | undefined {
  const raw = args.find((a) => a.startsWith(`--${name}=`));
  return raw?.slice(name.length + 3).trim() || undefined;
}

/**
 * Derives a short list key ("WEB", "AMC") from a list name, since Flowspace shows it
 * in every task reference (WEB-14). Uniqueness is settled by the caller.
 */
export function deriveKey(name: string): string {
  const words = name.replace(/[^a-zA-Z0-9 ]/g, " ").split(/\s+/).filter(Boolean);
  if (!words.length) return "LST";
  const initials = words.map((w) => w[0]).join("").toUpperCase();
  if (initials.length >= 3) return initials.slice(0, 4);
  return words[0].slice(0, 4).toUpperCase();
}

export const PRIORITY_MAP: Record<string, "URGENT" | "HIGH" | "MEDIUM" | "LOW" | "NO_PRIORITY"> = {
  urgent: "URGENT",
  "1": "URGENT",
  high: "HIGH",
  "2": "HIGH",
  normal: "MEDIUM",
  medium: "MEDIUM",
  "3": "MEDIUM",
  low: "LOW",
  "4": "LOW",
};

export type WorkflowStateRef = { id: string; name: string; category: string };

/**
 * Places a ClickUp status on the SySpree pipeline.
 *
 * `categoryHint` comes from the ClickUp API's status `type` field ("open" | "closed"),
 * which is authoritative when present — no guessing needed for those two ends of the
 * pipeline. For anything in between ("custom" statuses, or the CSV path which has no
 * such field), fall back to name matching: an exact match wins, then a few well-known
 * ClickUp defaults, otherwise the task lands on "Open" so nothing is silently filed
 * as finished.
 */
export function mapStatus(raw: string | undefined, states: WorkflowStateRef[], categoryHint?: "UNSTARTED" | "COMPLETED") {
  if (categoryHint === "COMPLETED") return states.find((s) => s.category === "COMPLETED") ?? states[states.length - 1];
  if (categoryHint === "UNSTARTED") return states.find((s) => s.category === "UNSTARTED") ?? states[0];

  const value = norm(raw ?? "");
  const byName = states.find((s) => norm(s.name) === value);
  if (byName) return byName;

  const includes = (needle: string) => value.includes(needle);
  if (includes("complete") || includes("closed") || includes("done")) {
    return states.find((s) => s.category === "COMPLETED") ?? states[0];
  }
  if (includes("review") || includes("qa")) {
    return states.find((s) => norm(s.name).includes("review")) ?? states[0];
  }
  if (includes("design") || includes("figma")) {
    return states.find((s) => norm(s.name).includes("design")) ?? states[0];
  }
  if (includes("progress") || includes("doing") || includes("dev") || includes("active")) {
    return states.find((s) => norm(s.name).includes("progress")) ?? states[0];
  }
  return states.find((s) => s.category === "UNSTARTED") ?? states[0];
}

/**
 * Wraps a flat description string as a Tiptap doc, one paragraph per line, so it
 * opens directly in the rich-text editor instead of appearing as a raw string the
 * editor has to migrate on first open. Shared because both importers hit exactly the
 * same shape of source data: a single block of plain text per task.
 */
export function textToDoc(text: string): { type: "doc"; content: unknown[] } {
  const content = text
    .split(/\r?\n/)
    .map((line) =>
      line.trim() ? { type: "paragraph", content: [{ type: "text", text: line }] } : { type: "paragraph" },
    );
  return { type: "doc", content };
}
