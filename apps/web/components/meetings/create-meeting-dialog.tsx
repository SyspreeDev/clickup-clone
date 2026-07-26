"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Video, Check } from "lucide-react";
import { createMeetingSchema, type CreateMeetingInput } from "@repo/shared-types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { createMeeting } from "@/lib/queries/meetings";
import { listMembers } from "@/lib/queries/workspaces";
import { ApiError } from "@/lib/api-client";
import { cn } from "@/lib/utils";

function toLocalInput(date: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function CreateMeetingDialog({ workspaceId }: { workspaceId: string }) {
  const [open, setOpen] = useState(false);
  const [attendeeIds, setAttendeeIds] = useState<string[]>([]);
  const [generateZoom, setGenerateZoom] = useState(false);
  const queryClient = useQueryClient();

  const { data: members } = useQuery({
    queryKey: ["workspace-members", workspaceId],
    queryFn: () => listMembers(workspaceId),
    enabled: open,
  });

  const defaultStart = new Date(Date.now() + 60 * 60 * 1000);
  const defaultEnd = new Date(defaultStart.getTime() + 30 * 60 * 1000);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CreateMeetingInput>({
    resolver: zodResolver(createMeetingSchema),
    defaultValues: {
      startTime: defaultStart,
      endTime: defaultEnd,
    },
  });

  const mutation = useMutation({
    mutationFn: (input: CreateMeetingInput) =>
      createMeeting(workspaceId, { ...input, attendeeIds, generateZoomLink: generateZoom }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["meetings", workspaceId] });
      queryClient.invalidateQueries({ queryKey: ["dashboard", workspaceId] });
      toast.success("Meeting scheduled");
      setOpen(false);
      reset();
      setAttendeeIds([]);
      setGenerateZoom(false);
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : "Something went wrong"),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-1.5">
          <Plus className="h-3.5 w-3.5" />
          Schedule meeting
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Schedule a meeting</DialogTitle>
        </DialogHeader>
        <form
          onSubmit={handleSubmit((v) =>
            mutation.mutate({
              ...v,
              startTime: new Date(v.startTime),
              endTime: new Date(v.endTime),
            }),
          )}
          className="space-y-4"
        >
          <div className="space-y-2">
            <Label htmlFor="title">Title</Label>
            <Input id="title" placeholder="Weekly sync" {...register("title")} />
            {errors.title && <p className="text-xs text-destructive">{errors.title.message}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">Description (optional)</Label>
            <Input id="description" placeholder="What's this meeting about?" {...register("description")} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="startTime">Starts</Label>
              <Input
                id="startTime"
                type="datetime-local"
                defaultValue={toLocalInput(defaultStart)}
                {...register("startTime")}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="endTime">Ends</Label>
              <Input id="endTime" type="datetime-local" defaultValue={toLocalInput(defaultEnd)} {...register("endTime")} />
            </div>
          </div>
          <div className="space-y-2">
            <button
              type="button"
              onClick={() => setGenerateZoom((v) => !v)}
              className={cn(
                "flex w-full items-center gap-2 rounded-lg border px-3 py-2.5 text-left text-sm transition-colors",
                generateZoom ? "border-primary bg-primary/5" : "border-border hover:bg-accent",
              )}
            >
              <span
                className={cn(
                  "flex h-4 w-4 items-center justify-center rounded border",
                  generateZoom ? "border-primary bg-primary text-primary-foreground" : "border-input",
                )}
              >
                {generateZoom && <Check className="h-3 w-3" />}
              </span>
              <Video className="h-3.5 w-3.5 text-primary" />
              <span className="font-medium">Generate a Zoom link automatically</span>
            </button>
            {!generateZoom && (
              <>
                <Label htmlFor="location" className="flex items-center gap-1.5">
                  <Video className="h-3.5 w-3.5" />
                  Zoom link / location (optional)
                </Label>
                <Input id="location" placeholder="https://zoom.us/j/… or a room name" {...register("location")} />
              </>
            )}
            {generateZoom && (
              <p className="text-xs text-muted-foreground">
                A real Zoom meeting will be created and its join link attached automatically.
              </p>
            )}
          </div>
          {!!members?.length && (
            <div className="space-y-2">
              <Label>Attendees</Label>
              <div className="max-h-32 space-y-1 overflow-y-auto rounded-lg border border-border p-2 scrollbar-thin">
                {members.map((m) => {
                  const checked = attendeeIds.includes(m.userId);
                  return (
                    <button
                      type="button"
                      key={m.userId}
                      onClick={() =>
                        setAttendeeIds((prev) => (checked ? prev.filter((id) => id !== m.userId) : [...prev, m.userId]))
                      }
                      className={cn(
                        "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors hover:bg-accent",
                        checked && "bg-accent",
                      )}
                    >
                      <Avatar className="h-5 w-5">
                        <AvatarImage src={m.user.avatarUrl ?? undefined} />
                        <AvatarFallback className="text-[9px]">{m.user.name[0]}</AvatarFallback>
                      </Avatar>
                      {m.user.name}
                      {checked && <span className="ml-auto text-xs text-primary">Invited</span>}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? "Scheduling…" : "Schedule meeting"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
