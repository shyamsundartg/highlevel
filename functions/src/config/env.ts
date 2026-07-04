import dotenv from "dotenv";


dotenv.config();

function required(name: string): string {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

function optional(name: string, fallback = ""): string {
  const value = process.env[name]?.trim();
  return value || fallback;
}

export const env = {
  get firebaseProjectId() {
    return optional("HL_FIREBASE_PROJECT_ID", "hl-genesis");
  },

  get hlClientId() {
    return optional("HL_CLIENT_ID");
  },

  get hlClientSecret() {
    return optional("HL_CLIENT_SECRET");
  },

  get hlOAuthRedirectUri() {
    return optional("HL_OAUTH_REDIRECT_URI");
  },

  get hlOAuthScopes() {
    return optional("HL_OAUTH_SCOPES");
  },

  get anthropicApiKey() {
    return optional("ANTHROPIC_API_KEY");
  },

  get anthropicModel() {
    return optional("ANTHROPIC_MODEL", "claude-sonnet-5");
  },

  get frontendUrl() {
    return optional("FRONTEND_URL", "http://localhost:5173");
  },

  /** Ed25519 public key (PEM or base64) for X-GHL-Signature verification. */
  get hlWebhookPublicKey() {
    return optional("HL_WEBHOOK_PUBLIC_KEY");
  },

  /** When true, skip signature checks (local emulator / curl tests only). */
  get hlWebhookSkipVerify() {
    return optional("HL_WEBHOOK_SKIP_VERIFY", "false").toLowerCase() === "true";
  },
};


export function assertGenerationEnv() {
  required("ANTHROPIC_API_KEY");
}

export function assertHlOAuthEnv() {
  required("HL_CLIENT_ID");
  required("HL_CLIENT_SECRET");
  required("HL_OAUTH_REDIRECT_URI");
}