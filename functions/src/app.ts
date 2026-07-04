import express, { Request, Response } from "express";
import { AuthenticatedRequest, requireAuth } from "./middleware/auth";
import { highlevelRouter } from "./routes/highlevel";
import { projectsRouter } from "./routes/projects";
import { webhooksRouter } from "./routes/webhooks";

export function createApp() {
  const app = express();

  app.use(
    express.json({
      limit: "1mb",
      verify: (req, _res, buf) => {
        (req as Request & { rawBody?: Buffer }).rawBody = buf;
      },
    }),
  );

  app.get("/health", (_req: Request, res: Response) => {
    res.status(200).json({ status: "ok" });
  });

  app.get("/me", requireAuth, (req: Request, res: Response) => {
    const { uid } = req as AuthenticatedRequest;
    res.status(200).json({ uid });
  });

  app.use(webhooksRouter);
  app.use(highlevelRouter);
  app.use(projectsRouter);

  return app;
}
