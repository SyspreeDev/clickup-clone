"use client";

import * as React from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "sonner";
import { createQueryClient } from "@/lib/query-client";
import { ThemeProvider } from "@/components/theme/theme-provider";
import { useAuthStore } from "@/stores/auth-store";
import { refreshAccessToken } from "@/lib/api-client";
import { getMe } from "@/lib/queries/auth";

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
