import { z } from "zod";

export const createMeetingSchema = z.object({
  title: z.string().min(1).max(150),
  description: z.string().max(2000).optional(),
  projectId: z.string().optional(),
  startTime: z.coerce.date(),
  endTime: z.coerce.date(),
  location: z.string().max(300).optional(),
  generateZoomLink: z.boolean().optional(),
  attendeeIds: z.array(z.string()).optional(),
});
export type CreateMeetingInput = z.infer<typeof createMeetingSchema>;

export const rsvpSchema = z.object({
  status: z.enum(["PENDING", "ACCEPTED", "DECLINED"]),
});
export type RsvpInput = z.infer<typeof rsvpSchema>;
