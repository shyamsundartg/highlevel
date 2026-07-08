import { describe, expect, it } from "vitest";
import { safeRedirectPath } from "./safeRedirect";

describe("safeRedirectPath", () => {
  it("defaults to /projects", () => {
    expect(safeRedirectPath(undefined)).toBe("/projects");
  });

  it("allows in-app paths", () => {
    expect(safeRedirectPath("/projects/abc")).toBe("/projects/abc");
  });

  it("blocks external URLs", () => {
    expect(safeRedirectPath("https://evil.com")).toBe("/projects");
    expect(safeRedirectPath("//evil.com")).toBe("/projects");
  });
});
