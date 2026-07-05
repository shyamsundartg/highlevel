import { onRequest } from "firebase-functions/v2/https";
import { env } from "./config/env";
import {
  exchangeCodeForTokens,
  fetchLocationName,
} from "./services/highlevel/oauth";
import { consumeState } from "./services/highlevel/state";
import { storeInitialTokens } from "./services/highlevel/tokens";

export const hlOAuthCallback = onRequest(
  { region: "asia-south1", cors: false, invoker: "public" },
  async (req, res) => {
    const redirect = (query: string): void => {
      res.redirect(`${env.frontendUrl}${query}`);
    };

    const code = typeof req.query.code === "string" ? req.query.code : "";
    const state = typeof req.query.state === "string" ? req.query.state : "";

    let uid: string;
    try {
      uid = await consumeState(state);
    } catch {
      redirect("?hl=error&reason=invalid_state");
      return;
    }

    if (!code) {
      redirect("?hl=error&reason=missing_code");
      return;
    }

    try {
      const tokens = await exchangeCodeForTokens(code);
      const locationName = await fetchLocationName(
        tokens.access_token,
        tokens.locationId,
      );
      await storeInitialTokens(uid, tokens, locationName);
      redirect("?hl=connected");
    } catch (err) {
      console.error("HL OAuth callback failed", {
        uid,
        message: err instanceof Error ? err.message : "unknown",
      });
      redirect("?hl=error&reason=token_exchange_failed");
    }
  },
);
