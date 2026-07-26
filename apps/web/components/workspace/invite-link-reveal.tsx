"use client";

import { toast } from "sonner";
import { Copy, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";

export function InviteLinkReveal({ email, link, alreadyHasAccount }: { email: string; link: string; alreadyHasAccount: boolean }) {
  return (
    <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 text-sm">
      <p className="mb-1.5 flex items-center gap-1.5 font-medium text-primary">
        <Mail className="h-3.5 w-3.5" />
        {alreadyHasAccount ? `${email} already has an account` : `Invite created for ${email}`}
      </p>
      <p className="mb-2 text-xs text-muted-foreground">
        No email server is configured yet, so nothing was actually emailed — copy this link and send it to them yourself
        (Slack, WhatsApp, etc). Once you configure a real email provider, this happens automatically.
      </p>
      <div className="flex items-center gap-2">
        <code className="flex-1 truncate rounded bg-background px-2 py-1 text-xs">{link}</code>
        <Button
          size="icon"
          variant="ghost"
          className="h-7 w-7 shrink-0"
          onClick={() => {
            navigator.clipboard.writeText(link);
            toast.success("Invite link copied");
          }}
        >
          <Copy className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}
