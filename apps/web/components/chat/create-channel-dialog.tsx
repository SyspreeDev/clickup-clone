"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { createChannel } from "@/lib/queries/chat";
import { listMembers } from "@/lib/queries/workspaces";
import { useAuthStore } from "@/stores/auth-store";
import { ApiError } from "@/lib/api-client";
import { cn } from "@/lib/utils";

export function CreateChannelDialog({ workspaceId }: { workspaceId: string }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [memberIds, setMemberIds] = useState<string[]>([]);
  const router = useRouter();
  const queryClient = useQueryClient();
  const currentUserId = useAuthStore((s) => s.user?.id);

  const { data: members } = useQuery({
    queryKey: ["members", workspaceId],
    queryFn: () => listMembers(workspaceId),
    enabled: open,
  });

  const mutation = useMutation({
    mutationFn: () => createChannel(workspaceId, { name, type: "PUBLIC", memberIds }),
    onSuccess: (channel) => {
      queryClient.invalidateQueries({ queryKey: ["channels", workspaceId] });
      toast.success(`#${channel.name} created`);
      setOpen(false);
      setName("");
      setMemberIds([]);
      router.push(`/workspace/${workspaceId}/chat/${channel.id}`);
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : "Something went wrong"),
  });

  function toggle(userId: string) {
    setMemberIds((ids) => (ids.includes(userId) ? ids.filter((id) => id !== userId) : [...ids, userId]));
  }

  const others = (members ?? []).filter((m) => m.userId !== currentUserId && m.status === "ACTIVE");

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

        <div className="space-y-2">
          <Label>Add people {memberIds.length > 0 && `(${memberIds.length} selected)`}</Label>
          <div className="max-h-56 space-y-0.5 overflow-y-auto rounded-lg border border-input p-1.5 scrollbar-thin">
            {!others.length && <p className="px-2 py-3 text-center text-xs text-muted-foreground">No other members yet</p>}
            {others.map((m) => {
              const selected = memberIds.includes(m.userId);
              return (
                <button
                  key={m.userId}
                  type="button"
                  onClick={() => toggle(m.userId)}
                  className={cn(
                    "flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left text-sm transition-colors hover:bg-accent",
                    selected && "bg-accent",
                  )}
                >
                  <Avatar className="h-6 w-6 shrink-0">
                    <AvatarImage src={m.user.avatarUrl ?? undefined} />
                    <AvatarFallback className="text-[10px]">{m.user.name[0]}</AvatarFallback>
                  </Avatar>
                  <span className="min-w-0 flex-1 truncate">{m.user.name}</span>
                  {selected && <Check className="h-4 w-4 shrink-0 text-primary" />}
                </button>
              );
            })}
          </div>
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
