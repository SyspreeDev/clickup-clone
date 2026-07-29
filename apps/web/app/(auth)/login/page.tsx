"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { loginSchema, type LoginInput } from "@repo/shared-types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuthStore } from "@/stores/auth-store";
import { login as loginRequest, getMe } from "@/lib/queries/auth";
import { ApiError } from "@/lib/api-client";
import { API_URL } from "@/lib/api-client";

/** Failures during the Google round-trip come back as ?error=… on this page. */
const OAUTH_ERRORS: Record<string, string> = {
  google: "Google sign-in was cancelled or refused. Try again, or use your email and password.",
  oauth: "We couldn't finish signing you in with Google. Try again.",
  "google-unavailable": "Google sign-in isn't set up on this server yet. Use your email and password for now.",
};

/**
 * Kept as its own Suspense-wrapped child so useSearchParams doesn't drag the
 * whole login route out of static rendering.
 */
function OAuthErrorNotice() {
  const message = OAUTH_ERRORS[useSearchParams().get("error") ?? ""];
  if (!message) return null;
  return (
    <p className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
      {message}
    </p>
  );
}

export default function LoginPage() {
  const router = useRouter();
  const setSession = useAuthStore((s) => s.setSession);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({ resolver: zodResolver(loginSchema) });

  async function onSubmit(values: LoginInput) {
    try {
      const result = await loginRequest(values);
      setSession(result.accessToken, null);
      const user = await getMe();
      setSession(result.accessToken, user);
      toast.success(`Welcome back, ${user.name.split(" ")[0]}`);
      router.push("/redirect");
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Something went wrong";
      toast.error(message);
    }
  }

  return (
    <div className="space-y-6">
      <div className="space-y-1.5">
        <h1 className="text-2xl font-semibold tracking-tight">Welcome back</h1>
        <p className="text-sm text-muted-foreground">Sign in to your workspace</p>
      </div>

      <Suspense fallback={null}>
        <OAuthErrorNotice />
      </Suspense>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" placeholder="you@company.com" autoComplete="email" {...register("email")} />
          {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="password">Password</Label>
            <Link href="/forgot-password" className="text-xs text-primary hover:underline">
              Forgot password?
            </Link>
          </div>
          <Input id="password" type="password" autoComplete="current-password" {...register("password")} />
          {errors.password && <p className="text-xs text-destructive">{errors.password.message}</p>}
        </div>
        <Button type="submit" className="w-full" disabled={isSubmitting}>
          {isSubmitting ? "Signing in…" : "Sign in"}
        </Button>
      </form>

      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t border-border" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-background px-2 text-muted-foreground">Or continue with</span>
        </div>
      </div>

      <Button variant="outline" className="w-full" asChild>
        <a href={`${API_URL}/api/auth/google`}>Continue with Google</a>
      </Button>

      <p className="text-center text-sm text-muted-foreground">
        Don&apos;t have an account?{" "}
        <Link href="/register" className="font-medium text-primary hover:underline">
          Sign up
        </Link>
      </p>
    </div>
  );
}
