import { Response } from "express";

export interface ApiErrorBody {
  code: string;
  message: string;
}

export function sendError(
  res: Response,
  status: number,
  code: string,
  message: string,
): void {
  const body: ApiErrorBody = { code, message };
  res.status(status).json(body);
}
