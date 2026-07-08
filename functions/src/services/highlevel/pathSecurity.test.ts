import { describe, expect, it } from "vitest";
import { assertAllowedPath, rejectUnsafePathSegments } from "./pathSecurity";
import { HlApiError } from "./errors";

describe("rejectUnsafePathSegments", () => {
  it("rejects .. segments", () => {
    expect(() => rejectUnsafePathSegments("/contacts/../locations/x")).toThrow(
      HlApiError,
    );
  });
});

describe("assertAllowedPath", () => {
  it("allows contacts paths", () => {
    expect(assertAllowedPath("/contacts/")).toBe("/contacts/");
  });

  it("rejects traversal that resolves outside allowlist", () => {
    expect(() => assertAllowedPath("/contacts/../locations/x")).toThrow(
      HlApiError,
    );
  });

  it("rejects paths that only prefix-match", () => {
    expect(() => assertAllowedPath("/contacts-evil")).toThrow(HlApiError);
  });

  it("rejects admin paths removed from allowlist", () => {
    expect(() => assertAllowedPath("/webhooks")).toThrow(HlApiError);
    expect(() => assertAllowedPath("/locations/x")).toThrow(HlApiError);
  });
});
