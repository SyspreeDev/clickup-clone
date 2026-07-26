"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/stores/auth-store";
import { getMe } from "@/lib/queries/auth";

export default function AuthCallbackPage() {
  const router = useRouter();
  const setSession = useAuthStore((s) => s.setSession);

  useEffect(() => {
    const hash = new URLSearchParams(window.location.hash.slice(1));
    const accessToken = hash.get("accessToken");
    if (!accessToken) {
      router.replace("/login?error=oauth");
      return;
    }
    setSession(accessToken, null);
    getMe()
      .then((user) => {
        setSession(accessToken, user);
        router.replace("/redirect");
      })
      .catch(() => router.replace("/login?error=oauth"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex h-screen w-screen items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
    </div>
  );
}
