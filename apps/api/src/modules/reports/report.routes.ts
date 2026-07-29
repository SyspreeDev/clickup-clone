import { Router } from "express";
import ExcelJS from "exceljs";
import { authenticate } from "../../middleware/authenticate";
import { requireWorkspaceRole } from "../../middleware/requireRole";
import { asyncHandler } from "../../lib/asyncHandler";
import * as reportService from "./report.service";

export const reportRouter: Router = Router();
reportRouter.use(authenticate);
// Reports aggregate company-wide data — per-employee workload, time logged and
// completion rates across every team — so they stay manager-only by design.
reportRouter.use("/workspaces/:workspaceId/reports", requireWorkspaceRole("ADMIN"));

reportRouter.get(
  "/workspaces/:workspaceId/reports/team-productivity",
  asyncHandler(async (req, res) => res.json(await reportService.teamProductivity(req.params.workspaceId))),
);
reportRouter.get(
  "/workspaces/:workspaceId/reports/project-progress",
  asyncHandler(async (req, res) => res.json(await reportService.projectProgress(req.params.workspaceId))),
);
reportRouter.get(
  "/workspaces/:workspaceId/reports/task-completion",
  asyncHandler(async (req, res) => res.json(await reportService.taskCompletionTrend(req.params.workspaceId))),
);
reportRouter.get(
  "/workspaces/:workspaceId/reports/workload",
  asyncHandler(async (req, res) => res.json(await reportService.workloadDistribution(req.params.workspaceId))),
);
reportRouter.get(
  "/workspaces/:workspaceId/reports/time-tracking",
  asyncHandler(async (req, res) => res.json(await reportService.timeTrackingSummary(req.params.workspaceId))),
);

reportRouter.get(
  "/workspaces/:workspaceId/reports/export",
  asyncHandler(async (req, res) => {
    const report = (req.query.report as string) ?? "team-productivity";
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet(report);

    if (report === "team-productivity") {
      const rows = await reportService.teamProductivity(req.params.workspaceId);
      sheet.columns = [
        { header: "Name", key: "name", width: 24 },
        { header: "Assigned", key: "assigned", width: 12 },
        { header: "Completed", key: "completed", width: 12 },
      ];
      sheet.addRows(rows);
    } else if (report === "project-progress") {
      const rows = await reportService.projectProgress(req.params.workspaceId);
      sheet.columns = [
        { header: "Project", key: "name", width: 24 },
        { header: "Key", key: "key", width: 10 },
        { header: "Total tasks", key: "total", width: 12 },
        { header: "Completed", key: "completed", width: 12 },
        { header: "% Complete", key: "percent", width: 12 },
      ];
      sheet.addRows(rows);
    } else if (report === "workload") {
      const rows = await reportService.workloadDistribution(req.params.workspaceId);
      sheet.columns = [
        { header: "Name", key: "name", width: 24 },
        { header: "Active tasks", key: "activeTasks", width: 14 },
      ];
      sheet.addRows(rows);
    } else {
      const rows = await reportService.timeTrackingSummary(req.params.workspaceId);
      sheet.columns = [
        { header: "Name", key: "name", width: 24 },
        { header: "Minutes logged", key: "minutes", width: 16 },
      ];
      sheet.addRows(rows);
    }

    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="${report}.xlsx"`);
    await workbook.xlsx.write(res);
    res.end();
  }),
);
