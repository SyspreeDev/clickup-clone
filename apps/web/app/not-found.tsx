"use client";

import Link from "next/link";
import { Compass } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex h-screen w-screen flex-col items-center justify-center gap-3 bg-background p-6 text-center">
      <Compass className="h-8 w-8 text-muted-foreground" />
      <p className="text-sm font-medium">Page not found</p>
      <p className="max-w-sm text-sm text-muted-foreground">The page you&apos;re looking for doesn&apos;t exist or was moved.</p>
      <Button asChild>
        <Link href="/redirect">Back to Teamspree</Link>
      </Button>
    </div>
  );
}
