"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/stores/auth-store";

export default function RedirectPage() {
  const router = useRouter();
  const status = useAuthStore((s) => s.status);
  const user = useAuthStore((s) => s.user);

  useEffect(() => {
    if (status === "idle" || status === "loading") return;
    if (status === "unauthenticated" || !user) {
      router.replace("/login");
      return;
    }
    if (!user.workspaces?.length) {
      router.replace("/create-workspace");
      return;
    }
    router.replace(`/workspace/${user.workspaces[0].id}`);
  }, [status, user, router]);

  return (
    <div className="flex h-screen w-screen items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
    </div>
  );
}
