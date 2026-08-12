"use client";

import * as React from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "sonner";
import { createQueryClient } from "@/lib/query-client";
import { ThemeProvider } from "@/components/theme/theme-provider";
import { useAuthStore } from "@/stores/auth-store";
import { refreshAccessToken } from "@/lib/api-client";
import { getMe, publicSession } from "@/lib/queries/auth";

/**
 * Off by default everywhere. When an environment sets this at build time, anyone
 * who lands here with no session is auto-signed-in server-side — see
 * apps/api PUBLIC_ACCESS_MODE. A deliberate, explicit per-environment opt-in.
 */
const PUBLIC_ACCESS_MODE = process.env.NEXT_PUBLIC_PUBLIC_ACCESS_MODE === "true";

function AuthBootstrap({ children }: { children: React.ReactNode }) {
  const setStatus = useAuthStore((s) => s.setStatus);
  const setSession = useAuthStore((s) => s.setSession);
  const status = useAuthStore((s) => s.status);

  React.useEffect(() => {
    let cancelled = false;
    async function bootstrap() {
      setStatus("loading");
      const token = await refreshAccessToken();
      if (cancelled) return;
      if (!token) {
        if (PUBLIC_ACCESS_MODE) {
          try {
            const result = await publicSession();
            if (cancelled) return;
            setSession(result.accessToken, null);
            const user = await getMe();
            if (cancelled) return;
            setSession(result.accessToken, user);
            return;
          } catch {
            // Falls through to unauthenticated — e.g. the configured account is missing.
          }
        }
        setStatus("unauthenticated");
        return;
      }
      try {
        const user = await getMe();
        if (cancelled) return;
        setSession(token, user);
      } catch {
        setStatus("unauthenticated");
      }
    }
    bootstrap();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (status === "idle" || status === "loading") {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }
  return <>{children}</>;
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = React.useState(createQueryClient);

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
        <AuthBootstrap>{children}</AuthBootstrap>
        <Toaster richColors position="top-right" />
      </ThemeProvider>
    </QueryClientProvider>
  );
}
