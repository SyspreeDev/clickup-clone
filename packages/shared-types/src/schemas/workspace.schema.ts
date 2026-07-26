import { z } from "zod";
import { ROLES } from "../enums";

export const createWorkspaceSchema = z.object({
  name: z.string().min(2).max(60),
  description: z.string().max(500).optional(),
});
export type CreateWorkspaceInput = z.infer<typeof createWorkspaceSchema>;

export const updateWorkspaceSchema = createWorkspaceSchema.partial().extend({
  logoUrl: z.string().url().optional(),
});
export type UpdateWorkspaceInput = z.infer<typeof updateWorkspaceSchema>;

export const inviteMemberSchema = z.object({
  email: z.string().email(),
  role: z.enum(ROLES).default("MEMBER"),
});
export type InviteMemberInput = z.infer<typeof inviteMemberSchema>;

export const updateMemberRoleSchema = z.object({
  role: z.enum(ROLES),
});
export type UpdateMemberRoleInput = z.infer<typeof updateMemberRoleSchema>;

export const createTeamSchema = z.object({
  name: z.string().min(2).max(60),
  description: z.string().max(500).optional(),
  icon: z.string().optional(),
});
export type CreateTeamInput = z.infer<typeof createTeamSchema>;

export const updateTeamSchema = createTeamSchema.partial();
export type UpdateTeamInput = z.infer<typeof updateTeamSchema>;

export const addTeamMemberSchema = z.object({
  userId: z.string().min(1),
  role: z.enum(ROLES).default("MEMBER"),
});
export type AddTeamMemberInput = z.infer<typeof addTeamMemberSchema>;
