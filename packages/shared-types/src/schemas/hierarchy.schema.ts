import { z } from "zod";

// ── Folders (the middle level of Space → Folder → List) ──

export const createProjectFolderSchema = z.object({
  teamId: z.string().min(1, "A folder must live in a space"),
  name: z.string().min(1).max(80),
  icon: z.string().optional(),
  color: z.string().optional(),
  isPrivate: z.boolean().default(false),
  position: z.number().optional(),
});
export type CreateProjectFolderInput = z.infer<typeof createProjectFolderSchema>;

export const updateProjectFolderSchema = createProjectFolderSchema.partial().omit({ teamId: true });
export type UpdateProjectFolderInput = z.infer<typeof updateProjectFolderSchema>;

/** Reparent / reorder a list: into a folder, or directly into a space. */
export const moveProjectSchema = z.object({
  folderId: z.string().nullable().optional(),
  teamId: z.string().nullable().optional(),
  position: z.number().optional(),
});
export type MoveProjectInput = z.infer<typeof moveProjectSchema>;

// ── Docs ──

export const createDocSchema = z
  .object({
    title: z.string().min(1).max(200).default("Untitled"),
    icon: z.string().optional(),
    // Tiptap JSON document; free-form so the editor owns its own shape.
    content: z.unknown().optional(),
    projectId: z.string().optional(),
    teamId: z.string().optional(),
    parentId: z.string().optional(),
    position: z.number().optional(),
  })
  .refine((v) => !(v.projectId && v.teamId), {
    message: "A doc belongs to a list or a space, not both",
  });
export type CreateDocInput = z.infer<typeof createDocSchema>;

export const updateDocSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  icon: z.string().optional(),
  content: z.unknown().optional(),
  parentId: z.string().nullable().optional(),
  position: z.number().optional(),
});
export type UpdateDocInput = z.infer<typeof updateDocSchema>;
