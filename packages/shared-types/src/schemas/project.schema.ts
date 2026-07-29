import { z } from "zod";
import { PROJECT_STATUSES } from "../enums";

export const createProjectSchema = z.object({
  name: z.string().min(2).max(80),
  key: z
    .string()
    .min(2)
    .max(8)
    .regex(/^[A-Z0-9]+$/, "Key must be uppercase letters/numbers"),
  description: z.string().max(2000).optional(),
  teamId: z.string().optional(),
  /** Optional folder inside the space, for Space → Folder → List nesting. */
  folderId: z.string().optional(),
  icon: z.string().optional(),
  color: z.string().optional(),
  status: z.enum(PROJECT_STATUSES).default("PLANNED"),
  startDate: z.coerce.date().optional(),
  targetDate: z.coerce.date().optional(),
  isPrivate: z.boolean().default(false),
});
export type CreateProjectInput = z.infer<typeof createProjectSchema>;

export const updateProjectSchema = createProjectSchema.partial().omit({ key: true });
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>;

export const createLabelSchema = z.object({
  name: z.string().min(1).max(30),
  color: z.string().min(1),
});
export type CreateLabelInput = z.infer<typeof createLabelSchema>;

export const createMilestoneSchema = z.object({
  name: z.string().min(1).max(80),
  description: z.string().max(1000).optional(),
  targetDate: z.coerce.date().optional(),
});
export type CreateMilestoneInput = z.infer<typeof createMilestoneSchema>;

export const createWorkflowStateSchema = z.object({
  name: z.string().min(1).max(40),
  color: z.string().default("#6b7280"),
  category: z.enum(["BACKLOG", "UNSTARTED", "STARTED", "COMPLETED", "CANCELLED"]),
  position: z.number(),
});
export type CreateWorkflowStateInput = z.infer<typeof createWorkflowStateSchema>;
