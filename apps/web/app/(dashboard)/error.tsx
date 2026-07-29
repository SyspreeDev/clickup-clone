"use client";

import { ErrorScreen } from "@/components/system/error-screen";

export default function DashboardError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <ErrorScreen
      error={error}
      reset={reset}
      description="An unexpected error occurred while loading this page. You can try again, or head back to the dashboard."
    />
  );
}
