import { Router } from "express";
import multer from "multer";
import {
  createTaskSchema,
  updateTaskSchema,
  moveTaskSchema,
  createChecklistSchema,
  createChecklistItemSchema,
  updateChecklistItemSchema,
  createDependencySchema,
  createCommentSchema,
  createTimeEntrySchema,
} from "@repo/shared-types";
import { authenticate } from "../../middleware/authenticate";
import { requireProjectMember } from "../../middleware/requireRole";
import { validateBody } from "../../middleware/validate";
import { asyncHandler } from "../../lib/asyncHandler";
import {
  requireTaskProjectAccess,
  requireTaskAccessVia,
  viaComment,
  viaChecklist,
  viaChecklistItem,
  viaTimeEntry,
  viaDependency,
  viaAttachment,
} from "./task.middleware";
import * as controller from "./task.controller";

// Same 25MB ceiling as the workspace Files uploader. Note the Vercel proxy in
// front of production caps request bodies lower (~4.5MB).
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024 } });

export const taskRouter: Router = Router();
taskRouter.use(authenticate);

taskRouter.get("/my-tasks", asyncHandler(controller.myTasks));

taskRouter.get("/projects/:projectId/tasks", requireProjectMember("GUEST"), asyncHandler(controller.list));
taskRouter.post(
  "/projects/:projectId/tasks",
  requireProjectMember("MEMBER"),
  validateBody(createTaskSchema),
  asyncHandler(controller.create),
);

taskRouter.get("/tasks/:taskId", requireTaskProjectAccess("GUEST"), asyncHandler(controller.get));
taskRouter.patch(
  "/tasks/:taskId",
  requireTaskProjectAccess("MEMBER"),
  validateBody(updateTaskSchema),
  asyncHandler(controller.update),
);
taskRouter.patch(
  "/tasks/:taskId/move",
  requireTaskProjectAccess("MEMBER"),
  validateBody(moveTaskSchema),
  asyncHandler(controller.move),
);
taskRouter.delete("/tasks/:taskId", requireTaskProjectAccess("TEAM_LEAD"), asyncHandler(controller.remove));

taskRouter.post("/tasks/:taskId/assignees", requireTaskProjectAccess("MEMBER"), asyncHandler(controller.addAssignee));
taskRouter.delete("/tasks/:taskId/assignees/:userId", requireTaskProjectAccess("MEMBER"), asyncHandler(controller.removeAssignee));
taskRouter.post("/tasks/:taskId/labels/:labelId", requireTaskProjectAccess("MEMBER"), asyncHandler(controller.addLabel));
taskRouter.delete("/tasks/:taskId/labels/:labelId", requireTaskProjectAccess("MEMBER"), asyncHandler(controller.removeLabel));

taskRouter.post(
  "/tasks/:taskId/attachments",
  requireTaskProjectAccess("MEMBER"),
  upload.single("file"),
  asyncHandler(controller.addAttachment),
);
taskRouter.delete(
  "/attachments/:id",
  requireTaskAccessVia(viaAttachment, "MEMBER"),
  asyncHandler(controller.deleteAttachment),
);

taskRouter.get("/tasks/:taskId/subtasks", requireTaskProjectAccess("GUEST"), asyncHandler(controller.listSubtasks));
taskRouter.post(
  "/tasks/:taskId/subtasks",
  requireTaskProjectAccess("MEMBER"),
  validateBody(createTaskSchema),
  asyncHandler(controller.createSubtask),
);

taskRouter.post(
  "/tasks/:taskId/checklists",
  requireTaskProjectAccess("MEMBER"),
  validateBody(createChecklistSchema),
  asyncHandler(controller.createChecklist),
);
taskRouter.patch("/checklists/:id", requireTaskAccessVia(viaChecklist, "MEMBER"), asyncHandler(controller.updateChecklist));
taskRouter.delete("/checklists/:id", requireTaskAccessVia(viaChecklist, "MEMBER"), asyncHandler(controller.deleteChecklist));
taskRouter.post(
  "/checklists/:id/items",
  requireTaskAccessVia(viaChecklist, "MEMBER"),
  validateBody(createChecklistItemSchema),
  asyncHandler(controller.addChecklistItem),
);
taskRouter.patch(
  "/checklist-items/:id",
  requireTaskAccessVia(viaChecklistItem, "MEMBER"),
  validateBody(updateChecklistItemSchema),
  asyncHandler(controller.updateChecklistItem),
);
taskRouter.delete(
  "/checklist-items/:id",
  requireTaskAccessVia(viaChecklistItem, "MEMBER"),
  asyncHandler(controller.deleteChecklistItem),
);

taskRouter.post(
  "/tasks/:taskId/dependencies",
  requireTaskProjectAccess("MEMBER"),
  validateBody(createDependencySchema),
  asyncHandler(controller.addDependency),
);
taskRouter.delete("/dependencies/:id", requireTaskAccessVia(viaDependency, "MEMBER"), asyncHandler(controller.removeDependency));

taskRouter.get("/tasks/:taskId/activity", requireTaskProjectAccess("GUEST"), asyncHandler(controller.listActivity));

taskRouter.get("/tasks/:taskId/time-entries", requireTaskProjectAccess("GUEST"), asyncHandler(controller.listTimeEntries));
taskRouter.post(
  "/tasks/:taskId/time-entries",
  requireTaskProjectAccess("MEMBER"),
  validateBody(createTimeEntrySchema),
  asyncHandler(controller.createTimeEntry),
);
// Stops a running timer. Ownership is enforced in the service — project access on
// its own shouldn't let you close a colleague's timer.
taskRouter.patch(
  "/time-entries/:id/stop",
  requireTaskAccessVia(viaTimeEntry, "MEMBER"),
  asyncHandler(controller.stopTimeEntry),
);
taskRouter.delete("/time-entries/:id", requireTaskAccessVia(viaTimeEntry, "MEMBER"), asyncHandler(controller.deleteTimeEntry));

taskRouter.get("/tasks/:taskId/comments", requireTaskProjectAccess("GUEST"), asyncHandler(controller.listComments));
taskRouter.post(
  "/tasks/:taskId/comments",
  requireTaskProjectAccess("MEMBER"),
  validateBody(createCommentSchema),
  asyncHandler(controller.createComment),
);
taskRouter.patch("/comments/:id", requireTaskAccessVia(viaComment, "GUEST"), asyncHandler(controller.updateComment));
taskRouter.delete("/comments/:id", requireTaskAccessVia(viaComment, "GUEST"), asyncHandler(controller.deleteComment));
