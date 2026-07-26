"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { resetPassword } from "@/lib/queries/auth";
import { ApiError } from "@/lib/api-client";

const formSchema = z.object({ password: z.string().min(8).max(72) });
type FormInput = z.infer<typeof formSchema>;

export default function ResetPasswordPage() {
  const { token } = useParams<{ token: string }>();
  const router = useRouter();
  const [done, setDone] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormInput>({ resolver: zodResolver(formSchema) });

  async function onSubmit(values: FormInput) {
    try {
      await resetPassword({ token, password: values.password });
      setDone(true);
      toast.success("Password updated — sign in with your new password");
      setTimeout(() => router.push("/login"), 1500);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Something went wrong");
    }
  }

  if (done) {
    return <p className="text-sm text-muted-foreground">Redirecting to sign in…</p>;
  }

  return (
    <div className="space-y-6">
      <div className="space-y-1.5">
        <h1 className="text-2xl font-semibold tracking-tight">Set a new password</h1>
        <p className="text-sm text-muted-foreground">Choose a strong password for your account</p>
      </div>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="password">New password</Label>
          <Input id="password" type="password" autoComplete="new-password" {...register("password")} />
          {errors.password && <p className="text-xs text-destructive">{errors.password.message}</p>}
        </div>
        <Button type="submit" className="w-full" disabled={isSubmitting}>
          {isSubmitting ? "Updating…" : "Update password"}
        </Button>
      </form>
    </div>
  );
}
