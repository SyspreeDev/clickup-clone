import Link from "next/link";
import { redirect } from "next/navigation";
import { CheckCircle2 } from "lucide-react";

const HIGHLIGHTS = [
  "Kanban, list, table, calendar & timeline views on one dataset",
  "Real-time collaboration with your whole team",
  "Built for speed — every action feels instant",
];

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  // Public access mode auto-signs everyone in — the login/signup screens never render.
  if (process.env.NEXT_PUBLIC_PUBLIC_ACCESS_MODE === "true") {
    redirect("/redirect");
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="relative hidden flex-col justify-between overflow-hidden bg-foreground p-10 text-background lg:flex">
        <div
          className="pointer-events-none absolute inset-0 opacity-40"
          style={{
            backgroundImage:
              "radial-gradient(circle at 20% 20%, hsl(var(--primary) / 0.6), transparent 40%), radial-gradient(circle at 80% 70%, hsl(var(--primary) / 0.4), transparent 45%)",
          }}
        />
        <Link href="/" className="relative z-10 flex items-center gap-2 text-lg font-semibold">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">F</span>
          Teamspree
        </Link>
        <div className="relative z-10 space-y-6">
          <blockquote className="text-2xl font-medium leading-snug">
            "Everything our team needs to plan, track, and ship — in one beautifully fast workspace."
          </blockquote>
          <ul className="space-y-3">
            {HIGHLIGHTS.map((h) => (
              <li key={h} className="flex items-start gap-2 text-sm text-background/80">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                {h}
              </li>
            ))}
          </ul>
        </div>
        <p className="relative z-10 text-xs text-background/50">© {new Date().getFullYear()} Teamspree, Inc.</p>
      </div>
      <div className="flex items-center justify-center p-6 sm:p-10">
        <div className="w-full max-w-sm">{children}</div>
      </div>
    </div>
  );
}
