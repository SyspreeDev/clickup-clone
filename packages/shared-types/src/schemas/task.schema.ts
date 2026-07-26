import { z } from "zod";
import { TASK_PRIORITIES, DEPENDENCY_TYPES } from "../enums";

export const createTaskSchema = z.object({
  title: z.string().min(1).max(300),
  description: z.any().optional(),
  workflowStateId: z.string().min(1),
  priority: z.enum(TASK_PRIORITIES).default("NO_PRIORITY"),
  parentId: z.string().optional(),
  milestoneId: z.string().optional(),
  startDate: z.coerce.date().optional(),
  dueDate: z.coerce.date().optional(),
  estimateMinutes: z.number().int().positive().optional(),
  assigneeIds: z.array(z.string()).optional(),
  labelIds: z.array(z.string()).optional(),
});
export type CreateTaskInput = z.infer<typeof createTaskSchema>;

export const updateTaskSchema = z.object({
  title: z.string().min(1).max(300).optional(),
  description: z.any().optional(),
  priority: z.enum(TASK_PRIORITIES).optional(),
  milestoneId: z.string().nullable().optional(),
  startDate: z.coerce.date().nullable().optional(),
  dueDate: z.coerce.date().nullable().optional(),
  estimateMinutes: z.number().int().positive().nullable().optional(),
  isArchived: z.boolean().optional(),
});
export type UpdateTaskInput = z.infer<typeof updateTaskSchema>;

export const moveTaskSchema = z.object({
  workflowStateId: z.string().min(1),
  position: z.number(),
});
export type MoveTaskInput = z.infer<typeof moveTaskSchema>;

export const createChecklistSchema = z.object({
  title: z.string().min(1).max(120),
});
export type CreateChecklistInput = z.infer<typeof createChecklistSchema>;

export const createChecklistItemSchema = z.object({
  title: z.string().min(1).max(300),
  assigneeId: z.string().optional(),
});
export type CreateChecklistItemInput = z.infer<typeof createChecklistItemSchema>;

export const updateChecklistItemSchema = z.object({
  title: z.string().min(1).max(300).optional(),
  isCompleted: z.boolean().optional(),
  position: z.number().optional(),
  assigneeId: z.string().nullable().optional(),
});
export type UpdateChecklistItemInput = z.infer<typeof updateChecklistItemSchema>;

export const createDependencySchema = z.object({
  dependsOnId: z.string().min(1),
  type: z.enum(DEPENDENCY_TYPES).default("BLOCKS"),
});
export type CreateDependencyInput = z.infer<typeof createDependencySchema>;

export const createCommentSchema = z.object({
  content: z.any(),
  parentId: z.string().optional(),
  mentionedUserIds: z.array(z.string()).optional(),
});
export type CreateCommentInput = z.infer<typeof createCommentSchema>;

export const createTimeEntrySchema = z.object({
  description: z.string().max(300).optional(),
  startedAt: z.coerce.date(),
  endedAt: z.coerce.date().optional(),
  durationMinutes: z.number().int().positive().optional(),
  isManual: z.boolean().default(false),
});
export type CreateTimeEntryInput = z.infer<typeof createTimeEntrySchema>;

export const taskFilterSchema = z.object({
  workflowStateId: z.string().optional(),
  assigneeId: z.string().optional(),
  priority: z.enum(TASK_PRIORITIES).optional(),
  labelId: z.string().optional(),
  q: z.string().optional(),
  includeArchived: z.coerce.boolean().default(false),
});
export type TaskFilterInput = z.infer<typeof taskFilterSchema>;
