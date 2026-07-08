import { describe, expect, it } from "vitest";
import { getApiDocs, runGetApiDocsTool } from "./apiDocs";

describe("getApiDocs", () => {
  it("returns runtime notes and endpoint list for empty input", () => {
    const parsed = JSON.parse(getApiDocs([])) as {
      runtime: { http: string };
      docs: { list: { endpoints: string[] } };
    };
    expect(parsed.runtime.http).toContain("window.__GENESIS__.fetch");
    expect(parsed.docs.list.endpoints).toContain("GET /hl/contacts");
  });

  it("returns docs for a known endpoint", () => {
    const parsed = JSON.parse(getApiDocs(["GET /hl/contacts"])) as {
      docs: Record<string, { method: string; path: string }>;
    };
    expect(parsed.docs["GET /hl/contacts"]).toMatchObject({
      method: "GET",
      path: "/hl/contacts",
    });
  });

  it("calendars notes reference window.__GENESIS__.fetch", () => {
    const parsed = JSON.parse(getApiDocs(["GET /hl/calendars"])) as {
      docs: Record<string, { notes?: string[] }>;
    };
    const notes = parsed.docs["GET /hl/calendars"].notes ?? [];
    expect(notes.join(" ")).toContain("window.__GENESIS__.fetch");
  });

  it("includes unknown endpoints and index when requested doc missing", () => {
    const parsed = JSON.parse(
      getApiDocs(["GET /hl/not-real"]),
    ) as {
      unknown: string[];
      endpoints: string[];
    };
    expect(parsed.unknown).toEqual(["GET /hl/not-real"]);
    expect(parsed.endpoints).toContain("GET /hl/contacts");
  });

  it("returns multiple endpoint docs in one call", () => {
    const parsed = JSON.parse(
      getApiDocs(["GET /hl/contacts", "GET /hl/calendars"]),
    ) as { docs: Record<string, unknown> };
    expect(parsed.docs["GET /hl/contacts"]).toBeDefined();
    expect(parsed.docs["GET /hl/calendars"]).toBeDefined();
  });
});

describe("runGetApiDocsTool", () => {
  it("accepts endpoints array", () => {
    const result = JSON.parse(
      runGetApiDocsTool({ endpoints: ["GET /hl/contacts"] }),
    ) as { docs: Record<string, unknown> };
    expect(result.docs["GET /hl/contacts"]).toBeDefined();
  });

  it("supports legacy single endpoint field", () => {
    const result = JSON.parse(
      runGetApiDocsTool({ endpoint: "GET /hl/contacts" }),
    ) as { docs: Record<string, unknown> };
    expect(result.docs["GET /hl/contacts"]).toBeDefined();
  });

  it("handles invalid input safely", () => {
    const result = JSON.parse(runGetApiDocsTool(null)) as {
      docs: { list: unknown };
    };
    expect(result.docs.list).toBeDefined();
  });
});
