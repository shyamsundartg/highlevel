import { Router, Request, Response } from "express";
import * as logger from "firebase-functions/logger";
import {
  extractLocationId,
  findUidByLocationId,
  IncomingHlWebhook,
  storeWebhookEvent,
  verifyWebhookSignature,
} from "../services/highlevel/webhooks";

export const webhooksRouter = Router();

/**
 * Public HighLevel webhook ingest.
 * Register as marketplace Default Webhook URL:
 *   https://<region>-<project>.cloudfunctions.net/api/webhooks/hl
 */
webhooksRouter.post("/webhooks/hl", async (req: Request, res: Response) => {
  try {
    const rawBody =
      (req as Request & { rawBody?: Buffer }).rawBody ??
      Buffer.from(JSON.stringify(req.body ?? {}));

    const ghlSignature =
      (req.header("x-ghl-signature") ?? req.header("X-GHL-Signature")) ||
      undefined;

    if (!verifyWebhookSignature(rawBody, ghlSignature)) {
      logger.warn("HL webhook signature invalid");
      res.status(401).json({ error: "INVALID_SIGNATURE" });
      return;
    }

    const payload = (req.body ?? {}) as IncomingHlWebhook;
    const type = typeof payload.type === "string" ? payload.type : "";
    if (!type) {
      res.status(400).json({ error: "VALIDATION_ERROR", message: "type is required" });
      return;
    }

    const locationId = extractLocationId(payload);
    if (!locationId) {
      logger.warn("HL webhook missing locationId", { type });
      res.status(200).json({ success: true, stored: false, reason: "missing_location" });
      return;
    }

    const uid = await findUidByLocationId(locationId);
    if (!uid) {
      logger.warn("HL webhook no user for location", { type, locationId });
      res.status(200).json({ success: true, stored: false, reason: "unknown_location" });
      return;
    }

    const event = await storeWebhookEvent(uid, payload, locationId);
    logger.info("HL webhook stored", {
      uid,
      type: event.type,
      eventId: event.id,
      locationId,
    });

    res.status(200).json({ success: true, stored: true, eventId: event.id });
  } catch (err) {
    logger.error("HL webhook failed", {
      message: err instanceof Error ? err.message : "unknown",
    });
    // Still 200 to avoid aggressive HL retries on our bugs; log for ops.
    res.status(200).json({ success: false });
  }
});
