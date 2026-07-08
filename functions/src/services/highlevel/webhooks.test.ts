import { generateKeyPairSync, sign } from "crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../config/env", () => ({
  env: {
    hlWebhookSkipVerify: false,
    hlWebhookPublicKey: "",
  },
}));

import { env } from "../../config/env";
import {
  extractLocationId,
  extractWebhookData,
  verifyWebhookSignature,
} from "./webhooks";

describe("extractWebhookData", () => {
  it("includes root-level contact fields", () => {
    const data = extractWebhookData({
      type: "ContactCreate",
      id: "c1",
      firstName: "Jane",
      locationId: "loc1",
    });
    expect(data.id).toBe("c1");
    expect(data.firstName).toBe("Jane");
    expect(data).not.toHaveProperty("type");
    expect(data).not.toHaveProperty("locationId");
  });

  it("flattens nested data.contact", () => {
    const data = extractWebhookData({
      type: "ContactCreate",
      data: {
        contact: { id: "c1", email: "jane@example.com" },
      },
    });
    expect(data.id).toBe("c1");
    expect(data.email).toBe("jane@example.com");
    expect(data.contact).toBeUndefined();
  });

  it("prefers root fields over partial nested data", () => {
    const data = extractWebhookData({
      type: "ContactUpdate",
      id: "root-id",
      data: { id: "nested-id", firstName: "Nested" },
    });
    expect(data.id).toBe("root-id");
    expect(data.firstName).toBe("Nested");
  });
});

describe("extractLocationId", () => {
  it("reads top-level locationId", () => {
    expect(extractLocationId({ type: "X", locationId: "loc1" })).toBe("loc1");
  });

  it("falls back to data.locationId", () => {
    expect(
      extractLocationId({ type: "X", data: { locationId: "loc2" } }),
    ).toBe("loc2");
  });

  it("returns empty string when missing", () => {
    expect(extractLocationId({ type: "X" })).toBe("");
  });
});

describe("verifyWebhookSignature", () => {
  const originalEmulator = process.env.FUNCTIONS_EMULATOR;

  beforeEach(() => {
    vi.mocked(env).hlWebhookSkipVerify = false;
    vi.mocked(env).hlWebhookPublicKey = "";
    delete process.env.FUNCTIONS_EMULATOR;
  });

  afterEach(() => {
    if (originalEmulator !== undefined) {
      process.env.FUNCTIONS_EMULATOR = originalEmulator;
    } else {
      delete process.env.FUNCTIONS_EMULATOR;
    }
  });

  it("returns true when skip verify is enabled", () => {
    vi.mocked(env).hlWebhookSkipVerify = true;
    expect(verifyWebhookSignature(Buffer.from("x"), undefined)).toBe(true);
  });

  it("returns true in emulator when no public key configured", () => {
    process.env.FUNCTIONS_EMULATOR = "true";
    expect(verifyWebhookSignature(Buffer.from("x"), undefined)).toBe(true);
  });

  it("returns false in production when no public key configured", () => {
    expect(verifyWebhookSignature(Buffer.from("x"), "sig")).toBe(false);
  });

  it("returns false when signature header is missing", () => {
    const { publicKey } = generateKeyPairSync("ed25519");
    vi.mocked(env).hlWebhookPublicKey = publicKey
      .export({ type: "spki", format: "pem" })
      .toString();
    expect(verifyWebhookSignature(Buffer.from("body"), undefined)).toBe(false);
  });

  it("returns true for valid Ed25519 signature", () => {
    const body = Buffer.from('{"type":"ContactCreate"}');
    const { privateKey, publicKey } = generateKeyPairSync("ed25519");
    const signature = sign(null, body, privateKey).toString("base64");
    vi.mocked(env).hlWebhookPublicKey = publicKey
      .export({ type: "spki", format: "pem" })
      .toString();

    expect(verifyWebhookSignature(body, signature)).toBe(true);
  });

  it("returns false for tampered body", () => {
    const body = Buffer.from('{"type":"ContactCreate"}');
    const { privateKey, publicKey } = generateKeyPairSync("ed25519");
    const signature = sign(null, body, privateKey).toString("base64");
    vi.mocked(env).hlWebhookPublicKey = publicKey
      .export({ type: "spki", format: "pem" })
      .toString();

    expect(
      verifyWebhookSignature(Buffer.from('{"type":"Tampered"}'), signature),
    ).toBe(false);
  });
});
