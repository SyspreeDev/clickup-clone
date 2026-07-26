"use client";

import { use, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format, isToday } from "date-fns";
import { toast } from "sonner";
import { CalendarClock, Video, Trash2, Check, X } from "lucide-react";
import { TopNav } from "@/components/layout/top-nav";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { CreateMeetingDialog } from "@/components/meetings/create-meeting-dialog";
import { listMeetings, deleteMeeting, rsvpMeeting, type Meeting } from "@/lib/queries/meetings";
import { useAuthStore } from "@/stores/auth-store";
import { cn } from "@/lib/utils";

function MeetingCard({ meeting, workspaceId }: { meeting: Meeting; workspaceId: string }) {
  const currentUserId = useAuthStore((s) => s.user?.id);
  const queryClient = useQueryClient();

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["meetings", workspaceId] });
    queryClient.invalidateQueries({ queryKey: ["dashboard", workspaceId] });
  };

  const deleteMutation = useMutation({
    mutationFn: () => deleteMeeting(meeting.id),
    onSuccess: () => {
      invalidate();
      toast.success("Meeting cancelled");
    },
  });

  const rsvpMutation = useMutation({
    mutationFn: (status: "ACCEPTED" | "DECLINED") => rsvpMeeting(meeting.id, status),
    onSuccess: invalidate,
  });

  const myAttendance = meeting.attendees.find((a) => a.userId === currentUserId);
  const canManage = meeting.createdById === currentUserId;

  return (
    <Card>
      <CardContent className="flex items-start justify-between gap-4 py-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="font-medium">{meeting.title}</p>
            {isToday(new Date(meeting.startTime)) && <Badge variant="success">Today</Badge>}
          </div>
          {meeting.description && <p className="mt-0.5 text-sm text-muted-foreground">{meeting.description}</p>}
          <p className="mt-1 text-sm text-muted-foreground">
            {format(new Date(meeting.startTime), "EEE, MMM d · h:mm a")} – {format(new Date(meeting.endTime), "h:mm a")}
          </p>
          {meeting.location && (
            <a
              href={meeting.location.startsWith("http") ? meeting.location : undefined}
              target="_blank"
              rel="noreferrer"
              className={cn(
                "mt-1 flex items-center gap-1.5 text-sm",
                meeting.location.startsWith("http") ? "text-primary hover:underline" : "text-muted-foreground",
              )}
            >
              <Video className="h-3.5 w-3.5" />
              {meeting.zoomJoinUrl ? "Join Zoom meeting" : meeting.location}
            </a>
          )}
          <div className="mt-2 flex -space-x-2">
            {meeting.attendees.map((a) => (
              <Avatar key={a.id} className="h-6 w-6 border-2 border-card" title={`${a.user.name} · ${a.rsvpStatus.toLowerCase()}`}>
                <AvatarImage src={a.user.avatarUrl ?? undefined} />
                <AvatarFallback className="text-[9px]">{a.user.name[0]}</AvatarFallback>
              </Avatar>
            ))}
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-2">
          {myAttendance && myAttendance.rsvpStatus === "PENDING" && (
            <div className="flex gap-1">
              <Button size="icon" variant="ghost" className="h-7 w-7 text-success" onClick={() => rsvpMutation.mutate("ACCEPTED")}>
                <Check className="h-4 w-4" />
              </Button>
              <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => rsvpMutation.mutate("DECLINED")}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          )}
          {myAttendance && myAttendance.rsvpStatus !== "PENDING" && (
            <Badge variant={myAttendance.rsvpStatus === "ACCEPTED" ? "success" : "outline"}>
              {myAttendance.rsvpStatus === "ACCEPTED" ? "Attending" : "Declined"}
            </Badge>
          )}
          {canManage && (
            <Button size="icon" variant="ghost" onClick={() => deleteMutation.mutate()}>
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default function MeetingsPage({ params }: { params: Promise<{ workspaceId: string }> }) {
  const { workspaceId } = use(params);
  const [scope, setScope] = useState<"upcoming" | "past">("upcoming");

  const { data: meetings, isLoading } = useQuery({
    queryKey: ["meetings", workspaceId, scope],
    queryFn: () => listMeetings(workspaceId, scope),
  });

  return (
    <>
      <TopNav title="Meetings" />
      <div className="flex-1 overflow-y-auto scrollbar-thin">
        <div className="mx-auto max-w-3xl space-y-6 p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1 rounded-lg bg-muted p-1">
              <button
                onClick={() => setScope("upcoming")}
                className={cn("rounded-md px-3 py-1 text-sm font-medium", scope === "upcoming" ? "bg-card shadow-soft" : "text-muted-foreground")}
              >
                Upcoming
              </button>
              <button
                onClick={() => setScope("past")}
                className={cn("rounded-md px-3 py-1 text-sm font-medium", scope === "past" ? "bg-card shadow-soft" : "text-muted-foreground")}
              >
                Past
              </button>
            </div>
            <CreateMeetingDialog workspaceId={workspaceId} />
          </div>

          {isLoading && (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-24 w-full" />
              ))}
            </div>
          )}

          {!isLoading && !meetings?.length && (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border py-16 text-center">
              <CalendarClock className="mb-3 h-8 w-8 text-muted-foreground" />
              <p className="text-sm font-medium">No {scope} meetings</p>
              <p className="mt-1 text-sm text-muted-foreground">Schedule one and paste in your Zoom link.</p>
            </div>
          )}

          <div className="space-y-3">
            {meetings?.map((m) => (
              <MeetingCard key={m.id} meeting={m} workspaceId={workspaceId} />
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
