import {
  HL_ALLOWED_PATH_PREFIXES,
  HL_API_BASE,
  HL_API_VERSION,
} from "./constants";
import { HlApiError } from "./errors";
import { getValidAccessToken, ValidAccessToken } from "./tokens";

export type HlHttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export interface HlProxyRequest {
  method: HlHttpMethod;
  path: string;
  query?: Record<string, string | number | boolean | undefined>;
  body?: unknown;
}

const ALLOWED_METHODS = new Set<HlHttpMethod>([
  "GET",
  "POST",
  "PUT",
  "PATCH",
  "DELETE",
]);

function assertAllowedPath(path: string): string {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  const allowed = HL_ALLOWED_PATH_PREFIXES.some((prefix) =>
    normalized.startsWith(prefix),
  );
  if (!allowed) {
    throw new HlApiError(
      "HL_PATH_NOT_ALLOWED",
      `Path not allowed: ${normalized}`,
      403,
    );
  }
  return normalized;
}

function buildUrl(
  path: string,
  query?: Record<string, string | number | boolean | undefined>,
): string {
  const url = new URL(`${HL_API_BASE}${path}`);
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== "") {
        url.searchParams.set(key, String(value));
      }
    }
  }
  return url.toString();
}

export async function hlFetch(
  uid: string,
  request: HlProxyRequest,
): Promise<{ status: number; data: unknown }> {
  if (!ALLOWED_METHODS.has(request.method)) {
    throw new HlApiError("VALIDATION_ERROR", "Invalid HTTP method", 400);
  }

  const path = assertAllowedPath(request.path);
  const { accessToken } = await getValidAccessToken(uid);
  const url = buildUrl(path, request.query);

  const headers: Record<string, string> = {
    Authorization: `Bearer ${accessToken}`,
    Version: HL_API_VERSION,
    Accept: "application/json",
  };

  const init: RequestInit = { method: request.method, headers };
  if (request.body !== undefined && request.method !== "GET") {
    headers["Content-Type"] = "application/json";
    init.body = JSON.stringify(request.body);
  }

  const response = await fetch(url, init);
  const text = await response.text();
  let data: unknown = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = { raw: text };
    }
  }

  if (!response.ok) {
    const message =
      data &&
      typeof data === "object" &&
      "message" in data &&
      typeof (data as { message: unknown }).message === "string"
        ? (data as { message: string }).message
        : `HighLevel API error (${response.status})`;
    throw new HlApiError("HL_API_ERROR", message, response.status);
  }

  return { status: response.status, data };
}

/** Injects locationId (and optional userId) for location-scoped GETs. */
export async function hlGetForLocation(
  uid: string,
  path: string,
  extraQuery?: Record<string, string | number | boolean | undefined>,
  options?: { includeUserId?: boolean },
): Promise<unknown> {
  const creds = await getValidAccessToken(uid);
  const query: Record<string, string | number | boolean | undefined> = {
    locationId: creds.locationId,
    ...extraQuery,
  };
  if (options?.includeUserId) {
    query.userId = creds.userId;
  }
  const result = await hlFetch(uid, {
    method: "GET",
    path,
    query,
  });
  return result.data;
}

/**
 * GET /calendars/events
 * Requires locationId, startTime, endTime, and one of userId | calendarId | groupId.
 * @see https://marketplace.gohighlevel.com/docs/ghl/calendars/get-calendar-events
 */
export async function hlGetCalendarEvents(
  uid: string,
  extraQuery?: Record<string, string | number | boolean | undefined>,
): Promise<unknown> {
  const creds = await getValidAccessToken(uid);
  const now = Date.now();
  const startTime = extraQuery?.startTime ?? now;
  const endTime =
    extraQuery?.endTime ?? now + 30 * 24 * 60 * 60 * 1000; // +30 days

  const hasFilter =
    Boolean(extraQuery?.calendarId) ||
    Boolean(extraQuery?.groupId) ||
    Boolean(extraQuery?.userId);

  const query: Record<string, string | number | boolean | undefined> = {
    locationId: creds.locationId,
    startTime,
    endTime,
    ...extraQuery,
  };

  // Default filter: authorized HL user (required by HL when calendarId/groupId omitted).
  if (!hasFilter) {
    query.userId = creds.userId;
  }

  const result = await hlFetch(uid, {
    method: "GET",
    path: "/calendars/events",
    query,
  });
  return result.data;
}

/**
 * GET /calendars/events/appointments/:eventId
 * @see https://marketplace.gohighlevel.com/docs/ghl/calendars/get-appointment
 */
export async function hlGetAppointment(
  uid: string,
  eventId: string,
): Promise<unknown> {
  const result = await hlFetch(uid, {
    method: "GET",
    path: `/calendars/events/appointments/${encodeURIComponent(eventId)}`,
  });
  return result.data;
}

/**
 * GET /calendars/:calendarId/free-slots
 * startDate/endDate are unix ms; range must be ≤ 31 days.
 * @see https://marketplace.gohighlevel.com/docs/ghl/calendars/get-slots
 */
export async function hlGetFreeSlots(
  uid: string,
  calendarId: string,
  extraQuery?: Record<string, string | number | boolean | undefined>,
): Promise<unknown> {
  if (!calendarId) {
    throw new HlApiError("VALIDATION_ERROR", "calendarId is required", 400);
  }

  const creds = await getValidAccessToken(uid);
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const startMs = startOfToday.getTime();
  const defaultEndMs = startMs + 7 * 24 * 60 * 60 * 1000;

  const query: Record<string, string | number | boolean | undefined> = {
    startDate: extraQuery?.startDate ?? startMs,
    endDate: extraQuery?.endDate ?? defaultEndMs,
    ...extraQuery,
  };

  if (query.userId === undefined && query.userIds === undefined) {
    query.userId = creds.userId;
  }

  const startNum = Number(query.startDate);
  const endNum = Number(query.endDate);
  if (
    Number.isFinite(startNum) &&
    Number.isFinite(endNum) &&
    endNum - startNum > 31 * 24 * 60 * 60 * 1000
  ) {
    throw new HlApiError(
      "VALIDATION_ERROR",
      "Free slots date range cannot exceed 31 days",
      400,
    );
  }

  const result = await hlFetch(uid, {
    method: "GET",
    path: `/calendars/${encodeURIComponent(calendarId)}/free-slots`,
    query,
  });
  return result.data;
}

/**
 * GET /conversations/search — list conversations for the location.
 * @see https://marketplace.gohighlevel.com/docs/ghl/conversations/search-conversation
 */
export async function hlSearchConversations(
  uid: string,
  extraQuery?: Record<string, string | number | boolean | undefined>,
): Promise<unknown> {
  return hlGetForLocation(uid, "/conversations/search", {
    limit: 20,
    status: "all",
    ...extraQuery,
  });
}

function asRecord(body: unknown): Record<string, unknown> {
  if (body && typeof body === "object" && !Array.isArray(body)) {
    return { ...(body as Record<string, unknown>) };
  }
  return {};
}

/** POST with locationId injected into the JSON body. */
export async function hlPostForLocation(
  uid: string,
  path: string,
  body?: unknown,
  options?: { includeUserIdAs?: string },
): Promise<{ status: number; data: unknown }> {
  const creds = await getValidAccessToken(uid);
  const payload = asRecord(body);
  if (payload.locationId === undefined || payload.locationId === "") {
    payload.locationId = creds.locationId;
  }
  if (
    options?.includeUserIdAs &&
    (payload[options.includeUserIdAs] === undefined ||
      payload[options.includeUserIdAs] === "")
  ) {
    payload[options.includeUserIdAs] = creds.userId;
  }
  return hlFetch(uid, {
    method: "POST",
    path,
    body: payload,
  });
}

/** POST /contacts/ — create contact (locationId injected). */
export async function hlCreateContact(
  uid: string,
  body: unknown,
): Promise<{ status: number; data: unknown }> {
  return hlPostForLocation(uid, "/contacts/", body);
}

/** GET /contacts/:contactId */
export async function hlGetContact(
  uid: string,
  contactId: string,
): Promise<unknown> {
  if (!contactId) {
    throw new HlApiError("VALIDATION_ERROR", "contactId is required", 400);
  }
  const result = await hlFetch(uid, {
    method: "GET",
    path: `/contacts/${encodeURIComponent(contactId)}`,
  });
  return result.data;
}

/** PUT /contacts/:contactId — update contact. */
export async function hlUpdateContact(
  uid: string,
  contactId: string,
  body: unknown,
): Promise<{ status: number; data: unknown }> {
  if (!contactId) {
    throw new HlApiError("VALIDATION_ERROR", "contactId is required", 400);
  }
  //const creds = await getValidAccessToken(uid);
  const payload = asRecord(body);
  // if (payload.locationId === undefined || payload.locationId === "") {
  //   payload.locationId = creds.locationId;
  // }
  return hlFetch(uid, {
    method: "PUT",
    path: `/contacts/${encodeURIComponent(contactId)}`,
    body: payload,
  });
}

/** GET /conversations/:conversationId */
export async function hlGetConversation(
  uid: string,
  conversationId: string,
): Promise<unknown> {
  if (!conversationId) {
    throw new HlApiError("VALIDATION_ERROR", "conversationId is required", 400);
  }
  const result = await hlFetch(uid, {
    method: "GET",
    path: `/conversations/${encodeURIComponent(conversationId)}`,
  });
  return result.data;
}

/**
 * GET /conversations/:conversationId/messages
 * @see https://marketplace.gohighlevel.com/docs/ghl/conversations/get-messages
 */
export async function hlGetConversationMessages(
  uid: string,
  conversationId: string,
  extraQuery?: Record<string, string | number | boolean | undefined>,
): Promise<unknown> {
  if (!conversationId) {
    throw new HlApiError("VALIDATION_ERROR", "conversationId is required", 400);
  }
  const result = await hlFetch(uid, {
    method: "GET",
    path: `/conversations/${encodeURIComponent(conversationId)}/messages`,
    query: { limit: 20, ...extraQuery },
  });
  return result.data;
}

/**
 * POST /conversations/messages — send SMS, Email, etc.
 * @see https://marketplace.gohighlevel.com/docs/ghl/conversations/send-a-new-message
 */
export async function hlSendMessage(
  uid: string,
  body: unknown,
): Promise<{ status: number; data: unknown }> {
  const payload = asRecord(body);
  if (!payload.type || typeof payload.type !== "string") {
    throw new HlApiError("VALIDATION_ERROR", "type is required", 400);
  }
  if (!payload.contactId || typeof payload.contactId !== "string") {
    throw new HlApiError("VALIDATION_ERROR", "contactId is required", 400);
  }
  return hlPostForLocation(uid, "/conversations/messages", payload);
}

/** POST /conversations/ — create conversation (locationId injected). */
export async function hlCreateConversation(
  uid: string,
  body: unknown,
): Promise<{ status: number; data: unknown }> {
  const payload = asRecord(body);
  if (!payload.contactId || typeof payload.contactId !== "string") {
    throw new HlApiError(
      "VALIDATION_ERROR",
      "contactId is required to create a conversation",
      400,
    );
  }
  return hlPostForLocation(uid, "/conversations/", payload);
}

/**
 * POST /calendars/events/appointments — create appointment.
 * Injects locationId; optional assignedUserId defaults to connected HL user.
 */
export async function hlCreateAppointment(
  uid: string,
  body: unknown,
): Promise<{ status: number; data: unknown }> {
  const payload = asRecord(body);
  for (const field of ["calendarId", "contactId", "startTime"] as const) {
    if (!payload[field]) {
      throw new HlApiError(
        "VALIDATION_ERROR",
        `${field} is required to create an appointment`,
        400,
      );
    }
  }
  return hlPostForLocation(uid, "/calendars/events/appointments", payload, {
    includeUserIdAs: "assignedUserId",
  });
}

export type { ValidAccessToken };
