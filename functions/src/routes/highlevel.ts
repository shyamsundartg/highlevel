import { Router, Request, Response } from "express";
import * as logger from "firebase-functions/logger";
import { assertHlOAuthEnv, env } from "../config/env";
import { AuthenticatedRequest, requireAuth } from "../middleware/auth";
import { sendError } from "../middleware/errors";
import {
  hlCreateAppointment,
  hlCreateContact,
  hlCreateConversation,
  hlFetch,
  hlGetAppointment,
  hlGetCalendarEvents,
  hlGetContact,
  hlGetConversation,
  hlGetConversationMessages,
  hlGetFreeSlots,
  hlGetForLocation,
  hlSearchConversations,
  hlSendMessage,
  hlUpdateContact,
  HlProxyRequest,
} from "../services/highlevel/api";
import { HlApiError } from "../services/highlevel/errors";
import { buildAuthUrl } from "../services/highlevel/oauth";
import { createState } from "../services/highlevel/state";
import { disconnect, getConnection } from "../services/highlevel/tokens";
import { listWebhookEvents } from "../services/highlevel/webhooks";

export const highlevelRouter = Router();

function handleHlError(res: Response, err: unknown): void {
  if (err instanceof HlApiError) {
    sendError(res, err.status, err.code, err.message);
    return;
  }
  sendError(res, 500, "HL_REQUEST_FAILED", "HighLevel request failed");
}

highlevelRouter.get(
  "/hl/oauth/start",
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      assertHlOAuthEnv();
      const { uid } = req as AuthenticatedRequest;
      const state = await createState(uid);
      const authUrl = buildAuthUrl(state);
      logger.info("HL OAuth start", {
        uid,
        scopes: env.hlOAuthScopes,
        redirectUri: env.hlOAuthRedirectUri,
      });
      res.status(200).json({ authUrl });
    } catch (err) {
      sendError(
        res,
        500,
        "HL_OAUTH_START_FAILED",
        err instanceof Error ? err.message : "Failed to start OAuth",
      );
    }
  },
);

highlevelRouter.get(
  "/hl/status",
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const { uid } = req as AuthenticatedRequest;
      const connection = await getConnection(uid);
      if (!connection) {
        res.status(200).json({ connected: false });
        return;
      }
      res.status(200).json({
        connected: connection.connected,
        locationId: connection.locationId,
        userId: connection.userId,
        locationName: connection.locationName,
        connectedAt: connection.connectedAt.toMillis(),
      });
    } catch {
      sendError(res, 500, "HL_STATUS_FAILED", "Failed to load HL status");
    }
  },
);

highlevelRouter.delete(
  "/hl/disconnect",
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const { uid } = req as AuthenticatedRequest;
      await disconnect(uid);
      res.status(200).json({ connected: false });
    } catch {
      sendError(res, 500, "HL_DISCONNECT_FAILED", "Failed to disconnect");
    }
  },
);

/**
 * Recent HighLevel webhook events for the signed-in user's location.
 * Live preview uses Firestore onSnapshot; this endpoint is for optional history on load.
 */
highlevelRouter.get(
  "/hl/events",
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const { uid } = req as AuthenticatedRequest;
      const sinceRaw = req.query.since;
      const limitRaw = req.query.limit;
      const type =
        typeof req.query.type === "string" ? req.query.type : undefined;

      const since =
        typeof sinceRaw === "string" && sinceRaw
          ? Number(sinceRaw)
          : undefined;
      const limit =
        typeof limitRaw === "string" && limitRaw
          ? Number(limitRaw)
          : undefined;

      const events = await listWebhookEvents(uid, {
        since: Number.isFinite(since) ? since : undefined,
        limit: Number.isFinite(limit) ? limit : undefined,
        type,
      });

      res.status(200).json({ events });
    } catch (err) {
      logger.error("List webhook events failed", {
        message: err instanceof Error ? err.message : "unknown",
      });
      sendError(res, 500, "HL_EVENTS_FAILED", "Failed to load events");
    }
  },
);

highlevelRouter.post(
  "/hl/proxy",
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const { uid } = req as AuthenticatedRequest;
      const body = req.body as Partial<HlProxyRequest>;
      if (!body.method || !body.path) {
        sendError(res, 400, "VALIDATION_ERROR", "method and path are required");
        return;
      }
      const result = await hlFetch(uid, {
        method: body.method,
        path: body.path,
        query: body.query,
        body: body.body,
      });
      res.status(result.status).json(result.data);
    } catch (err) {
      handleHlError(res, err);
    }
  },
);

highlevelRouter.get(
  "/hl/contacts",
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const { uid } = req as AuthenticatedRequest;
      const data = await hlGetForLocation(
        uid,
        "/contacts/",
        req.query as Record<string, string>,
      );
      res.status(200).json(data);
    } catch (err) {
      handleHlError(res, err);
    }
  },
);

/** POST /contacts/ — create contact (locationId injected). */
highlevelRouter.post(
  "/hl/contacts",
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const { uid } = req as AuthenticatedRequest;
      const result = await hlCreateContact(uid, req.body);
      res.status(result.status).json(result.data);
    } catch (err) {
      handleHlError(res, err);
    }
  },
);

/** GET /contacts/:contactId */
highlevelRouter.get(
  "/hl/contacts/:contactId",
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const { uid } = req as AuthenticatedRequest;
      const contactId = String(req.params.contactId ?? "");
      const data = await hlGetContact(uid, contactId);
      res.status(200).json(data);
    } catch (err) {
      handleHlError(res, err);
    }
  },
);

/** PUT /contacts/:contactId — update contact. */
highlevelRouter.put(
  "/hl/contacts/:contactId",
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const { uid } = req as AuthenticatedRequest;
      const contactId = String(req.params.contactId ?? "");
      const result = await hlUpdateContact(uid, contactId, req.body);
      res.status(result.status).json(result.data);
    } catch (err) {
      handleHlError(res, err);
    }
  },
);

/** GET /conversations/search — list conversations for the location. */
highlevelRouter.get(
  "/hl/conversations",
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const { uid } = req as AuthenticatedRequest;
      const data = await hlSearchConversations(
        uid,
        req.query as Record<string, string>,
      );
      res.status(200).json(data);
    } catch (err) {
      handleHlError(res, err);
    }
  },
);

/** POST /conversations/ — create conversation (requires contactId). */
highlevelRouter.post(
  "/hl/conversations",
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const { uid } = req as AuthenticatedRequest;
      const result = await hlCreateConversation(uid, req.body);
      res.status(result.status).json(result.data);
    } catch (err) {
      handleHlError(res, err);
    }
  },
);

/** POST /conversations/messages — send SMS, Email, etc. */
highlevelRouter.post(
  "/hl/conversations/messages",
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const { uid } = req as AuthenticatedRequest;
      const result = await hlSendMessage(uid, req.body);
      res.status(result.status).json(result.data);
    } catch (err) {
      handleHlError(res, err);
    }
  },
);

/** GET /conversations/:conversationId/messages */
highlevelRouter.get(
  "/hl/conversations/:conversationId/messages",
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const { uid } = req as AuthenticatedRequest;
      const conversationId = String(req.params.conversationId ?? "");
      const data = await hlGetConversationMessages(
        uid,
        conversationId,
        req.query as Record<string, string>,
      );
      res.status(200).json(data);
    } catch (err) {
      handleHlError(res, err);
    }
  },
);

/** GET /conversations/:conversationId */
highlevelRouter.get(
  "/hl/conversations/:conversationId",
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const { uid } = req as AuthenticatedRequest;
      const conversationId = String(req.params.conversationId ?? "");
      const data = await hlGetConversation(uid, conversationId);
      res.status(200).json(data);
    } catch (err) {
      handleHlError(res, err);
    }
  },
);

/** List calendars for the connected location (GET /calendars/). */
highlevelRouter.get(
  "/hl/calendars",
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const { uid } = req as AuthenticatedRequest;
      const data = await hlGetForLocation(
        uid,
        "/calendars/",
        req.query as Record<string, string>,
      );
      res.status(200).json(data);
    } catch (err) {
      handleHlError(res, err);
    }
  },
);

/**
 * GET /calendars/:calendarId/free-slots
 * Query: startDate, endDate (unix ms, required by HL; we default to today..+7d),
 * timezone, userId, userIds. Range max 31 days.
 */
highlevelRouter.get(
  "/hl/calendars/:calendarId/free-slots",
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const { uid } = req as AuthenticatedRequest;
      const calendarId = String(req.params.calendarId ?? "");
      if (!calendarId) {
        sendError(res, 400, "VALIDATION_ERROR", "calendarId is required");
        return;
      }
      const data = await hlGetFreeSlots(
        uid,
        calendarId,
        req.query as Record<string, string>,
      );
      res.status(200).json(data);
    } catch (err) {
      handleHlError(res, err);
    }
  },
);

/**
 * List appointments / calendar events (GET /calendars/events).
 * Injects locationId + userId; defaults startTime=now, endTime=+30d.
 * Optional query: startTime, endTime, calendarId, groupId, userId (override).
 */
highlevelRouter.get(
  "/hl/appointments",
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const { uid } = req as AuthenticatedRequest;
      const data = await hlGetCalendarEvents(
        uid,
        req.query as Record<string, string>,
      );
      res.status(200).json(data);
    } catch (err) {
      handleHlError(res, err);
    }
  },
);

/** POST /calendars/events/appointments — create appointment. */
highlevelRouter.post(
  "/hl/appointments",
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const { uid } = req as AuthenticatedRequest;
      const result = await hlCreateAppointment(uid, req.body);
      res.status(result.status).json(result.data);
    } catch (err) {
      handleHlError(res, err);
    }
  },
);

/**
 * Get one appointment by event id
 * (GET /calendars/events/appointments/:eventId).
 */
highlevelRouter.get(
  "/hl/appointments/:eventId",
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const { uid } = req as AuthenticatedRequest;
      const eventId = String(req.params.eventId ?? "");
      if (!eventId) {
        sendError(res, 400, "VALIDATION_ERROR", "eventId is required");
        return;
      }
      const data = await hlGetAppointment(uid, eventId);
      res.status(200).json(data);
    } catch (err) {
      handleHlError(res, err);
    }
  },
);
