"use client";

import { ErrorScreen } from "@/components/system/error-screen";

export default function RootError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <ErrorScreen error={error} reset={reset} />;
}
