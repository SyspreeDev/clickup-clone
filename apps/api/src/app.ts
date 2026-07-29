import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import passport from "passport";
import { env } from "./config/env";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler";
import { configureGoogleStrategy } from "./modules/auth/passport-google.strategy";
import { authRouter } from "./modules/auth/auth.routes";
import { workspaceRouter } from "./modules/workspaces/workspace.routes";
import { teamRouter } from "./modules/teams/team.routes";
import { projectRouter } from "./modules/projects/project.routes";
import { hierarchyRouter } from "./modules/hierarchy/hierarchy.routes";
import { taskRouter } from "./modules/tasks/task.routes";
import { notificationRouter } from "./modules/notifications/notification.routes";
import { chatRouter } from "./modules/chat/chat.routes";
import { fileRouter } from "./modules/files/file.routes";
import { searchRouter } from "./modules/search/search.routes";
import { reportRouter } from "./modules/reports/report.routes";
import { userRouter } from "./modules/users/user.routes";
import { meetingRouter } from "./modules/meetings/meeting.routes";

configureGoogleStrategy();

export const app: express.Express = express();

app.use(cors({ origin: env.corsAllowAll ? true : env.corsOrigin, credentials: true }));
app.use(express.json({ limit: "5mb" }));
app.use(cookieParser());
app.use(passport.initialize());
// Uploads are deliberately not served statically. Every document leaves through
// GET /api/files/:id/download, which checks the caller against the list the file
// belongs to — see readFileForUser in modules/files/file.service.ts.

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", time: new Date().toISOString() });
});

app.use("/api/auth", authRouter);
app.use("/api", workspaceRouter);
app.use("/api", teamRouter);
app.use("/api", projectRouter);
app.use("/api", hierarchyRouter);
app.use("/api", taskRouter);
app.use("/api", notificationRouter);
app.use("/api", chatRouter);
app.use("/api", fileRouter);
app.use("/api", searchRouter);
app.use("/api", reportRouter);
app.use("/api", userRouter);
app.use("/api", meetingRouter);

app.use(notFoundHandler);
app.use(errorHandler);
