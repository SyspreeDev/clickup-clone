"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { verifyEmail } from "@/lib/queries/auth";

export default function VerifyEmailPage() {
  const { token } = useParams<{ token: string }>();
  const [state, setState] = useState<"loading" | "success" | "error">("loading");

  useEffect(() => {
    verifyEmail(token)
      .then(() => setState("success"))
      .catch(() => setState("error"));
  }, [token]);

  return (
    <div className="space-y-3">
      <h1 className="text-2xl font-semibold tracking-tight">
        {state === "loading" ? "Verifying…" : state === "success" ? "Email verified" : "Link expired"}
      </h1>
      <p className="text-sm text-muted-foreground">
        {state === "loading" && "Hang tight while we confirm your email address."}
        {state === "success" && "Your email is now verified. You're all set."}
        {state === "error" && "This verification link is invalid or has expired."}
      </p>
      <Link href="/login" className="text-sm font-medium text-primary hover:underline">
        Back to sign in
      </Link>
    </div>
  );
}
