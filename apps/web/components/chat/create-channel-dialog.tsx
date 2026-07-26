"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { createChannel } from "@/lib/queries/chat";
import { ApiError } from "@/lib/api-client";

export function CreateChannelDialog({ workspaceId }: { workspaceId: string }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const router = useRouter();
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: () => createChannel(workspaceId, { name, type: "PUBLIC" }),
    onSuccess: (channel) => {
      queryClient.invalidateQueries({ queryKey: ["channels", workspaceId] });
      toast.success(`#${channel.name} created`);
      setOpen(false);
      setName("");
      router.push(`/workspace/${workspaceId}/chat/${channel.id}`);
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : "Something went wrong"),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button className="rounded p-0.5 text-muted-foreground hover:bg-accent hover:text-foreground" aria-label="Create channel">
          <Plus className="h-3.5 w-3.5" />
        </button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create a channel</DialogTitle>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="channel-name">Channel name</Label>
          <Input
            id="channel-name"
            placeholder="general"
            value={name}
            onChange={(e) => setName(e.target.value.toLowerCase().replace(/\s+/g, "-"))}
            onKeyDown={(e) => e.key === "Enter" && name.trim() && mutation.mutate()}
          />
        </div>
        <DialogFooter>
          <Button disabled={!name.trim() || mutation.isPending} onClick={() => mutation.mutate()}>
            {mutation.isPending ? "Creating…" : "Create channel"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
