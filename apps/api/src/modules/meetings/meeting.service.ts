import { prisma } from "../../lib/prisma";
import { NotFoundError, ForbiddenError } from "../../lib/errors";
import { createNotification } from "../notifications/notification.service";
import { createZoomMeeting } from "../../lib/zoom";
import type { CreateMeetingInput } from "@repo/shared-types";

const MEETING_INCLUDE = {
  createdBy: { select: { id: true, name: true, avatarUrl: true } },
  attendees: { include: { user: { select: { id: true, name: true, avatarUrl: true } } } },
  project: { select: { id: true, name: true, key: true } },
} as const;

export async function listMeetings(workspaceId: string, scope: "upcoming" | "past" | "all") {
  const now = new Date();
  const where =
    scope === "upcoming"
      ? { workspaceId, startTime: { gte: now } }
      : scope === "past"
        ? { workspaceId, startTime: { lt: now } }
        : { workspaceId };

  return prisma.meeting.findMany({
    where,
    include: MEETING_INCLUDE,
    orderBy: { startTime: scope === "past" ? "desc" : "asc" },
  });
}

export async function getMeeting(id: string) {
  const meeting = await prisma.meeting.findUnique({ where: { id }, include: MEETING_INCLUDE });
  if (!meeting) throw new NotFoundError("Meeting not found");
  return meeting;
}

export async function createMeeting(workspaceId: string, creatorId: string, input: CreateMeetingInput) {
  const attendeeIds = new Set([creatorId, ...(input.attendeeIds ?? [])]);

  // Optionally create a real Zoom meeting. Returns null if Zoom isn't
  // configured; genuine API failures bubble up as a 500 so the user knows.
  const zoom = input.generateZoomLink
    ? await createZoomMeeting({
        topic: input.title,
        agenda: input.description,
        startTime: input.startTime,
        endTime: input.endTime,
      })
    : null;

  const meeting = await prisma.meeting.create({
    data: {
      workspaceId,
      projectId: input.projectId,
      title: input.title,
      description: input.description,
      startTime: input.startTime,
      endTime: input.endTime,
      // Prefer the generated Zoom join link as the location when present.
      location: zoom?.joinUrl ?? input.location,
      zoomMeetingId: zoom?.meetingId,
      zoomJoinUrl: zoom?.joinUrl,
      zoomStartUrl: zoom?.startUrl,
      createdById: creatorId,
      attendees: {
        create: Array.from(attendeeIds).map((userId) => ({
          userId,
          rsvpStatus: userId === creatorId ? "ACCEPTED" : "PENDING",
        })),
      },
    },
    include: MEETING_INCLUDE,
  });

  for (const userId of attendeeIds) {
    if (userId === creatorId) continue;
    await createNotification({
      userId,
      workspaceId,
      type: "PROJECT_UPDATED",
      title: `You were invited to "${meeting.title}"`,
      entityType: "Meeting",
      entityId: meeting.id,
      actorId: creatorId,
    });
  }

  return meeting;
}

export async function updateMeeting(
  id: string,
  input: Partial<CreateMeetingInput> & { status?: "SCHEDULED" | "COMPLETED" | "CANCELLED" },
) {
  const { attendeeIds: _attendeeIds, generateZoomLink: _generateZoomLink, ...rest } = input;
  return prisma.meeting.update({ where: { id }, data: rest, include: MEETING_INCLUDE });
}

export async function deleteMeeting(id: string) {
  await prisma.meeting.delete({ where: { id } });
}

export async function rsvp(id: string, userId: string, status: "PENDING" | "ACCEPTED" | "DECLINED") {
  const attendee = await prisma.meetingAttendee.findUnique({ where: { meetingId_userId: { meetingId: id, userId } } });
  if (!attendee) throw new ForbiddenError("Not invited to this meeting");
  return prisma.meetingAttendee.update({
    where: { meetingId_userId: { meetingId: id, userId } },
    data: { rsvpStatus: status },
  });
}
