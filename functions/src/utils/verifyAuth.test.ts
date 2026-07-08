import { describe, expect, it, vi } from "vitest";

vi.mock("../config/firebase", () => ({
  auth: {
    verifyIdToken: vi.fn(),
  },
}));

import { auth } from "../config/firebase";
import { AuthError, verifyBearerToken } from "./verifyAuth";

const verifyIdToken = vi.mocked(auth.verifyIdToken);

describe("verifyBearerToken", () => {
  it("rejects missing Authorization header", async () => {
    await expect(verifyBearerToken(undefined)).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
  });

  it("rejects non-Bearer scheme", async () => {
    await expect(verifyBearerToken("Basic abc")).rejects.toBeInstanceOf(
      AuthError,
    );
  });

  it("rejects empty bearer token", async () => {
    await expect(verifyBearerToken("Bearer ")).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
  });

  it("returns uid for valid token", async () => {
    verifyIdToken.mockResolvedValueOnce({ uid: "user-123" });
    await expect(
      verifyBearerToken("Bearer valid-token"),
    ).resolves.toBe("user-123");
  });

  it("rejects invalid or expired token", async () => {
    verifyIdToken.mockRejectedValueOnce(new Error("expired"));
    await expect(verifyBearerToken("Bearer bad-token")).rejects.toMatchObject({
      code: "UNAUTHORIZED",
      message: "Invalid or expired token",
    });
  });
});
