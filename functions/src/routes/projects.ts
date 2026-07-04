import { Router, Request, Response } from "express";
import { AuthenticatedRequest, requireAuth } from "../middleware/auth";
import { sendError } from "../middleware/errors";
import {
  getFile,
  listFiles,
  saveFile,
} from "../services/projects/files";
import { listMessages } from "../services/projects/messages";
import {
  listSnapshots,
  restoreSnapshot,
} from "../services/projects/snapshots";
import {
  createProject,
  listProjects,
  serializeProject,
  softDeleteProject,
  updateProject,
} from "../services/projects/projects";
import { getProjectForUser } from "../utils/projectAccess";

export const projectsRouter = Router();

projectsRouter.use(requireAuth);

function getUid(req: Request): string {
  return (req as AuthenticatedRequest).uid;
}

function param(value: string | string[]): string {
  return Array.isArray(value) ? value[0] : value;
}

projectsRouter.post("/projects", async (req: Request, res: Response) => {
  const name = typeof req.body?.name === "string" ? req.body.name.trim() : "";
  if (!name) {
    sendError(res, 400, "VALIDATION_ERROR", "Project name is required");
    return;
  }

  const description =
    typeof req.body?.description === "string" ? req.body.description : "";

  try {
    const project = await createProject(getUid(req), { name, description });
    res.status(201).json(serializeProject(project));
  } catch (err) {
    if (err instanceof Error && err.message === "HL_NOT_CONNECTED") {
      sendError(
        res,
        400,
        "HL_NOT_CONNECTED",
        "Connect your HighLevel account before creating a project",
      );
      return;
    }
    sendError(res, 500, "PROJECT_CREATE_FAILED", "Failed to create project");
  }
});

projectsRouter.get("/projects", async (req: Request, res: Response) => {
  try {
    const projects = await listProjects(getUid(req));
    res.status(200).json({
      projects: projects.map(serializeProject),
    });
  } catch {
    sendError(res, 500, "PROJECT_LIST_FAILED", "Failed to list projects");
  }
});

projectsRouter.get(
  "/projects/:projectId",
  async (req: Request, res: Response) => {
    const project = await getProjectForUser(param(req.params.projectId), getUid(req));
    if (!project) {
      sendError(res, 404, "NOT_FOUND", "Project not found");
      return;
    }
    res.status(200).json(serializeProject(project));
  },
);

projectsRouter.patch(
  "/projects/:projectId",
  async (req: Request, res: Response) => {
    const name =
      req.body?.name !== undefined && typeof req.body.name === "string"
        ? req.body.name.trim()
        : undefined;
    const description =
      req.body?.description !== undefined &&
      typeof req.body.description === "string"
        ? req.body.description
        : undefined;

    if (name !== undefined && !name) {
      sendError(res, 400, "VALIDATION_ERROR", "Project name cannot be empty");
      return;
    }

    if (name === undefined && description === undefined) {
      sendError(res, 400, "VALIDATION_ERROR", "No fields to update");
      return;
    }

    try {
      const project = await updateProject(param(req.params.projectId), getUid(req), {
        name,
        description,
      });
      res.status(200).json(serializeProject(project));
    } catch (err) {
      if (err instanceof Error && err.message === "NOT_FOUND") {
        sendError(res, 404, "NOT_FOUND", "Project not found");
        return;
      }
      sendError(res, 500, "PROJECT_UPDATE_FAILED", "Failed to update project");
    }
  },
);

projectsRouter.delete(
  "/projects/:projectId",
  async (req: Request, res: Response) => {
    try {
      await softDeleteProject(param(req.params.projectId), getUid(req));
      res.status(200).json({ deleted: true });
    } catch (err) {
      if (err instanceof Error && err.message === "NOT_FOUND") {
        sendError(res, 404, "NOT_FOUND", "Project not found");
        return;
      }
      sendError(res, 500, "PROJECT_DELETE_FAILED", "Failed to delete project");
    }
  },
);

projectsRouter.get(
  "/projects/:projectId/files",
  async (req: Request, res: Response) => {
    const project = await getProjectForUser(param(req.params.projectId), getUid(req));
    if (!project) {
      sendError(res, 404, "NOT_FOUND", "Project not found");
      return;
    }

    try {
      const files = await listFiles(project.id);
      res.status(200).json({ files });
    } catch {
      sendError(res, 500, "FILE_LIST_FAILED", "Failed to list files");
    }
  },
);

projectsRouter.get(
  "/projects/:projectId/files/:fileId",
  async (req: Request, res: Response) => {
    const project = await getProjectForUser(param(req.params.projectId), getUid(req));
    if (!project) {
      sendError(res, 404, "NOT_FOUND", "Project not found");
      return;
    }

    try {
      const file = await getFile(project.id, param(req.params.fileId));
      if (!file) {
        sendError(res, 404, "NOT_FOUND", "File not found");
        return;
      }
      res.status(200).json(file);
    } catch (err) {
      if (err instanceof Error && err.message.includes("File")) {
        sendError(res, 400, "VALIDATION_ERROR", err.message);
        return;
      }
      sendError(res, 500, "FILE_READ_FAILED", "Failed to read file");
    }
  },
);

projectsRouter.put(
  "/projects/:projectId/files/:fileId",
  async (req: Request, res: Response) => {
    const project = await getProjectForUser(param(req.params.projectId), getUid(req));
    if (!project) {
      sendError(res, 404, "NOT_FOUND", "Project not found");
      return;
    }

    if (typeof req.body?.content !== "string") {
      sendError(res, 400, "VALIDATION_ERROR", "File content is required");
      return;
    }

    try {
      const file = await saveFile(
        project.id,
        param(req.params.fileId),
        req.body.content,
      );
      res.status(200).json(file);
    } catch (err) {
      if (err instanceof Error && err.message.includes("File")) {
        sendError(res, 400, "VALIDATION_ERROR", err.message);
        return;
      }
      sendError(res, 500, "FILE_SAVE_FAILED", "Failed to save file");
    }
  },
);

projectsRouter.get(
  "/projects/:projectId/messages",
  async (req: Request, res: Response) => {
    const project = await getProjectForUser(param(req.params.projectId), getUid(req));
    if (!project) {
      sendError(res, 404, "NOT_FOUND", "Project not found");
      return;
    }

    const limit =
      typeof req.query.limit === "string"
        ? Math.min(parseInt(req.query.limit, 10) || 100, 200)
        : 100;

    try {
      const messages = await listMessages(project.id, limit);
      res.status(200).json({ messages });
    } catch {
      sendError(res, 500, "MESSAGE_LIST_FAILED", "Failed to list messages");
    }
  },
);

projectsRouter.get(
  "/projects/:projectId/snapshots",
  async (req: Request, res: Response) => {
    const project = await getProjectForUser(param(req.params.projectId), getUid(req));
    if (!project) {
      sendError(res, 404, "NOT_FOUND", "Project not found");
      return;
    }

    try {
      const snapshots = await listSnapshots(project.id);
      res.status(200).json({ snapshots });
    } catch {
      sendError(res, 500, "SNAPSHOT_LIST_FAILED", "Failed to list snapshots");
    }
  },
);

projectsRouter.post(
  "/projects/:projectId/snapshots/:snapshotId/restore",
  async (req: Request, res: Response) => {
    const project = await getProjectForUser(param(req.params.projectId), getUid(req));
    if (!project) {
      sendError(res, 404, "NOT_FOUND", "Project not found");
      return;
    }

    try {
      const result = await restoreSnapshot(
        project.id,
        param(req.params.snapshotId),
      );
      res.status(200).json(result);
    } catch (err) {
      if (err instanceof Error && err.message === "NOT_FOUND") {
        sendError(res, 404, "NOT_FOUND", "Snapshot not found");
        return;
      }
      sendError(res, 500, "SNAPSHOT_RESTORE_FAILED", "Failed to restore snapshot");
    }
  },
);
