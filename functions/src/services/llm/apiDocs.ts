import type Anthropic from "@anthropic-ai/sdk";

/** Tool the model must call before inventing Genesis proxy request/response shapes. */
export const GET_API_DOC_TOOL: Anthropic.Tool = {
  name: "getApiDocs",
  description:
    "Return compact JSON docs for one or more Genesis proxy endpoints in a single call. Pass every endpoint you need in endpoints[].",
  input_schema: {
    type: "object",
    properties: {
      endpoints: {
        type: "array",
        items: { type: "string" },
        description:
          'Endpoint ids, e.g. ["GET /hl/contacts", "GET /hl/calendars", "POST /hl/appointments"]. Use ["list"] for the index of all endpoints.',
      },
    },
    required: ["endpoints"],
  },
};

const RUNTIME_NOTES = {
  http:
    "REQUIRED: await window.__GENESIS__.fetch(path, options). NEVER bare fetch(), axios, or leadconnectorhq.com.",
  returns:
    "Parsed JSON. Throws Error with .message on failure — no res.json() or handleResponse wrapper.",
  getExample:
    'const data = await window.__GENESIS__.fetch("/hl/calendars"); const list = data.calendars || data.data || [];',
  postExample:
    'await window.__GENESIS__.fetch("/hl/contacts", { method: "POST", body: { firstName: "Jane" } })',
  queryExample:
    'await window.__GENESIS__.fetch("/hl/contacts", { params: { query: "case" } })',
  events: "Live CRM updates: window.__GENESIS__.onHlEvent(callback)",
  helpers: [
    "window.__GENESIS__.contactName(c)",
    "window.__GENESIS__.contactId(c)",
    "window.__GENESIS__.upsertContact(list, contact)",
  ],
};

type ApiDoc = {
  method: "GET" | "POST" | "PUT";
  path: string;
  query: Record<string, string> | null;
  body: Record<string, string> | null;
  response: unknown;
  notes?: string[];
};

const DOCS: Record<string, ApiDoc | { endpoints: string[] }> = {
  list: {
    endpoints: [
      "GET /hl/contacts",
      "GET /hl/contacts/:contactId",
      "POST /hl/contacts",
      "PUT /hl/contacts/:contactId",
      "GET /hl/conversations",
      "GET /hl/conversations/:conversationId",
      "GET /hl/conversations/:conversationId/messages",
      "POST /hl/conversations",
      "POST /hl/conversations/messages",
      "GET /hl/calendars",
      "GET /hl/calendars/:calendarId/free-slots",
      "GET /hl/appointments",
      "GET /hl/appointments/:eventId",
      "POST /hl/appointments",
      "GET /hl/events",
    ],
  },

  "GET /hl/contacts": {
    method: "GET",
    path: "/hl/contacts",
    query: {
      query: "string?",
      limit: "number?",
      startAfterId: "string?",
      startAfter: "string?",
    },
    body: null,
    response: {
      contacts: [
        {
          id: "string",
          firstName: "string?",
          lastName: "string?",
          name: "string?",
          email: "string?",
          phone: "string?",
          dateAdded: "string|number?",
          tags: "string[]?",
        },
      ],
    },
    notes: [
      "list and search: pass query as GET param (locationId injected server-side)",
      'search: await window.__GENESIS__.fetch("/hl/contacts", { params: { query: "case" } })',
      "list = data.contacts || data.data || []",
      "display name: window.__GENESIS__.contactName(c)",
      "upsert: window.__GENESIS__.upsertContact(list, contact)",
    ],
  },

  "POST /hl/contacts": {
    method: "POST",
    path: "/hl/contacts",
    query: null,
    body: {
      firstName: "string?",
      lastName: "string?",
      name: "string?",
      email: "string?",
      phone: "string?",
      tags: "string[]?",
      companyName: "string?",
      address1: "string?",
      city: "string?",
      state: "string?",
      postalCode: "string?",
      country: "string?",
    },
    response: {
      contact: {
        id: "string",
        firstName: "string?",
        lastName: "string?",
        email: "string?",
        phone: "string?",
      },
    },
    notes: [
      "send email and/or phone",
      "do not send locationId",
      "result = data.contact || data",
      "after create: contacts = window.__GENESIS__.upsertContact(contacts, result)",
    ],
  },

  "GET /hl/contacts/:contactId": {
    method: "GET",
    path: "/hl/contacts/:contactId",
    query: null,
    body: null,
    response: {
      contact: {
        id: "string",
        firstName: "string?",
        lastName: "string?",
        name: "string?",
        email: "string?",
        phone: "string?",
        tags: "string[]?",
      },
    },
    notes: [
      "replace :contactId in path",
      "result = data.contact || data",
    ],
  },

  "PUT /hl/contacts/:contactId": {
    method: "PUT",
    path: "/hl/contacts/:contactId",
    query: null,
    body: {
      firstName: "string?",
      lastName: "string?",
      name: "string?",
      email: "string?",
      phone: "string?",
      tags: "string[]?",
      companyName: "string?",
      address1: "string?",
      city: "string?",
      state: "string?",
      postalCode: "string?",
      country: "string?",
    },
    response: {
      contact: {
        id: "string",
        firstName: "string?",
        lastName: "string?",
        email: "string?",
        phone: "string?",
      },
    },
    notes: [
      "replace :contactId in path",
      "do not send locationId",
      "result = data.contact || data",
      "after update: contacts = window.__GENESIS__.upsertContact(contacts, result)",
    ],
  },

  "GET /hl/conversations": {
    method: "GET",
    path: "/hl/conversations",
    query: {
      limit: "number?",
      status: "all|read|unread|starred|recents?",
      contactId: "string?",
      assignedTo: "string?",
      query: "string?",
      sort: "asc|desc?",
      sortBy: "last_message_date|last_manual_message_date|score_profile?",
      startAfterDate: "string|number?",
      lastMessageDirection: "inbound|outbound?",
      lastMessageAction: "automated|manual?",
    },
    body: null,
    response: {
      conversations: [
        {
          id: "string",
          contactId: "string",
          lastMessageBody: "string?",
          lastMessageType: "string?",
          type: "string?",
          unreadCount: "number?",
          fullName: "string?",
          contactName: "string?",
          email: "string?",
          phone: "string?",
        },
      ],
      total: "number?",
    },
    notes: [
      "list = data.conversations || []",
      "assignedTo may be userId or unassigned",
    ],
  },

  "POST /hl/conversations": {
    method: "POST",
    path: "/hl/conversations",
    query: null,
    body: {
      contactId: "string",
    },
    response: {
      success: "boolean?",
      conversation: {
        id: "string",
        contactId: "string",
        dateAdded: "string?",
        assignedTo: "string?",
      },
    },
    notes: ["contactId required", "do not send locationId"],
  },

  "GET /hl/conversations/:conversationId": {
    method: "GET",
    path: "/hl/conversations/:conversationId",
    query: null,
    body: null,
    response: {
      conversation: {
        id: "string",
        contactId: "string",
        locationId: "string?",
        lastMessageBody: "string?",
        unreadCount: "number?",
        fullName: "string?",
        email: "string?",
        phone: "string?",
      },
    },
    notes: [
      "replace :conversationId in path",
      "result = data.conversation || data",
    ],
  },

  "GET /hl/conversations/:conversationId/messages": {
    method: "GET",
    path: "/hl/conversations/:conversationId/messages",
    query: {
      limit: "number?",
      lastMessageId: "string?",
      type: "string?",
    },
    body: null,
    response: {
      messages: {
        lastMessageId: "string?",
        nextPage: "boolean?",
        messages: [
          {
            id: "string",
            body: "string?",
            direction: "inbound|outbound?",
            messageType: "string?",
            dateAdded: "string?",
            status: "string?",
            contactId: "string?",
            conversationId: "string?",
          },
        ],
      },
    },
    notes: [
      "replace :conversationId in path",
      "list = data.messages?.messages || data.messages || []",
      "paginate with lastMessageId from response when nextPage is true",
    ],
  },

  "POST /hl/conversations/messages": {
    method: "POST",
    path: "/hl/conversations/messages",
    query: null,
    body: {
      type: "SMS|Email|WhatsApp|FB|IG|Live_Chat|Custom",
      contactId: "string",
      message: "string?",
      subject: "string?",
      html: "string?",
      fromNumber: "string?",
      toNumber: "string?",
      emailFrom: "string?",
      emailTo: "string?",
    },
    response: {
      conversationId: "string?",
      messageId: "string?",
    },
    notes: [
      "type and contactId required",
      "SMS: message + fromNumber + toNumber",
      "Email: subject + html or message",
      "do not send locationId",
      "after send, refetch messages for the conversation",
    ],
  },

  "GET /hl/calendars": {
    method: "GET",
    path: "/hl/calendars",
    query: null,
    body: null,
    response: {
      calendars: [
        {
          id: "string",
          name: "string?",
          description: "string?",
          calendarType: "string?",
          isActive: "boolean?",
        },
      ],
    },
    notes: [
      'fetch: const data = await window.__GENESIS__.fetch("/hl/calendars"); list = data.calendars || data.data || []',
    ],
  },

  "GET /hl/calendars/:calendarId/free-slots": {
    method: "GET",
    path: "/hl/calendars/:calendarId/free-slots",
    query: {
      startDate: "number?",
      endDate: "number?",
      timezone: "string?",
      userId: "string?",
      userIds: "string?",
    },
    body: null,
    response: {
      "YYYY-MM-DD": {
        slots: ["ISO-8601"],
      },
    },
    notes: [
      "startDate/endDate are unix ms; defaults today..+7d",
      "range must be <= 31 days",
      "use a slots[] value as appointment startTime",
      "flatten: Object.values(data).flatMap(d => d?.slots || [])",
    ],
  },

  "GET /hl/appointments": {
    method: "GET",
    path: "/hl/appointments",
    query: {
      startTime: "number?",
      endTime: "number?",
      calendarId: "string?",
      groupId: "string?",
      userId: "string?",
    },
    body: null,
    response: {
      events: [
        {
          id: "string",
          title: "string?",
          calendarId: "string?",
          contactId: "string?",
          assignedUserId: "string?",
          startTime: "string|number?",
          endTime: "string|number?",
          appointmentStatus: "string?",
          address: "string?",
        },
      ],
    },
    notes: [
      "list = data.events || data.appointments || data.data || []",
      "startTime/endTime query are unix ms (defaults now..+30d)",
    ],
  },

  "GET /hl/appointments/:eventId": {
    method: "GET",
    path: "/hl/appointments/:eventId",
    query: null,
    body: null,
    response: {
      id: "string",
      title: "string?",
      calendarId: "string?",
      contactId: "string?",
      startTime: "string|number?",
      endTime: "string|number?",
      appointmentStatus: "string?",
    },
    notes: ["path param eventId required"],
  },

  "POST /hl/appointments": {
    method: "POST",
    path: "/hl/appointments",
    query: null,
    body: {
      calendarId: "string",
      contactId: "string",
      startTime: "ISO-8601",
      endTime: "ISO-8601?",
      title: "string?",
      address: "string?",
      appointmentStatus: "confirmed|new|cancelled|showed|noshow|invalid?",
      assignedUserId: "string?",
    },
    response: {
      id: "string",
      calendarId: "string?",
      contactId: "string?",
      startTime: "string?",
      title: "string?",
    },
    notes: [
      "do not send locationId",
      "prefer startTime from free-slots",
      "get appointment duration and calculate endTime",
      "flow: calendars -> free-slots -> POST appointment",
    ],
  },

  "GET /hl/events": {
    method: "GET",
    path: "/hl/events",
    query: {
      since: "number?",
      limit: "number?",
      type: "string?",
    },
    body: null,
    response: {
      events: [
        {
          id: "string",
          type: "ContactCreate|ContactUpdate|ContactDelete|string",
          locationId: "string",
          data: "object",
          receivedAt: "number",
        },
      ],
    },
    notes: [
      "optional: load recent history on startup; live updates use window.__GENESIS__.onHlEvent()",
      "since = last receivedAt (unix ms); only events after that are returned",
      "ContactCreate event.data has id, firstName, lastName, name, email, phone",
      "on ContactCreate: contacts = window.__GENESIS__.upsertContact(contacts, event.data) — do not refetch GET /hl/contacts (list lags webhook)",
      "display name: window.__GENESIS__.contactName(c)",
      "upsert: window.__GENESIS__.upsertContact(list, contact)",
    ],
  },
};

export function getApiDocs(endpoints: string[]): string {
  if (!endpoints.length) {
    return JSON.stringify({ runtime: RUNTIME_NOTES, docs: { list: DOCS.list } });
  }

  const docs: Record<string, unknown> = {};
  const unknown: string[] = [];

  for (const endpoint of endpoints) {
    const key = endpoint.trim();
    const doc = DOCS[key];
    if (doc) {
      docs[key] = doc;
    } else {
      unknown.push(endpoint);
    }
  }

  const payload: Record<string, unknown> = { runtime: RUNTIME_NOTES, docs };
  if (unknown.length > 0) {
    payload.unknown = unknown;
    payload.endpoints = Object.keys(DOCS).filter((k) => k !== "list");
  }
  return JSON.stringify(payload);
}

export function runGetApiDocsTool(input: unknown): string {
  const endpoints: string[] = [];

  if (input && typeof input === "object") {
    const obj = input as { endpoints?: unknown; endpoint?: unknown };
    if (Array.isArray(obj.endpoints)) {
      for (const v of obj.endpoints) {
        if (typeof v === "string" && v.trim()) {
          endpoints.push(v.trim());
        }
      }
    } else if (typeof obj.endpoint === "string" && obj.endpoint.trim()) {
      // Back-compat if the model still sends a single endpoint string.
      endpoints.push(obj.endpoint.trim());
    }
  }

  return getApiDocs(endpoints);
}