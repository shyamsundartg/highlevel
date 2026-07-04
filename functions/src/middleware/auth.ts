import { Request, Response, NextFunction } from "express";
import { auth } from "../config/firebase";
import { sendError } from "./errors";

export interface AuthenticatedRequest extends Request {
  uid: string;
}

export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const header = req.headers.authorization;

  if (!header?.startsWith("Bearer ")) {
    sendError(res, 401, "UNAUTHORIZED", "Missing or invalid Authorization header");
    return;
  }

  const token = header.slice("Bearer ".length).trim();

  if (!token) {
    sendError(res, 401, "UNAUTHORIZED", "Missing bearer token");
    return;
  }

  try {
    const decoded = await auth.verifyIdToken(token);
    (req as AuthenticatedRequest).uid = decoded.uid;
    next();
  } catch {
    sendError(res, 401, "UNAUTHORIZED", "Invalid or expired token");
  }
}
