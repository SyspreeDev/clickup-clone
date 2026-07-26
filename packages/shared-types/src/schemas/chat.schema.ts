import { z } from "zod";
import { CHANNEL_TYPES } from "../enums";

export const createChannelSchema = z.object({
  name: z.string().min(1).max(60).optional(),
  type: z.enum(CHANNEL_TYPES).default("PUBLIC"),
  topic: z.string().max(200).optional(),
  memberIds: z.array(z.string()).optional(),
});
export type CreateChannelInput = z.infer<typeof createChannelSchema>;

export const createMessageSchema = z.object({
  content: z.string().min(1).max(4000),
  parentId: z.string().optional(),
});
export type CreateMessageInput = z.infer<typeof createMessageSchema>;

export const addReactionSchema = z.object({
  emoji: z.string().min(1).max(16),
});
export type AddReactionInput = z.infer<typeof addReactionSchema>;
