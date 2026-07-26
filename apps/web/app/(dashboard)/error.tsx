"use client";

import { useEffect } from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function DashboardError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex h-screen w-screen flex-col items-center justify-center gap-3 bg-background p-6 text-center">
      <AlertTriangle className="h-8 w-8 text-destructive" />
      <p className="text-sm font-medium">Something went wrong</p>
      <p className="max-w-sm text-sm text-muted-foreground">
        An unexpected error occurred while loading this page. You can try again, or head back to the dashboard.
      </p>
      <Button onClick={reset}>Try again</Button>
    </div>
  );
}
