import { onRequest } from "firebase-functions/v2/https";
import { createApp } from "./app";

const app = createApp();

export const api = onRequest(
  {
    region: "asia-south1",
    cors: true,
    timeoutSeconds: 60,
    invoker: "public",
  },
  app,
);

export { hlOAuthCallback } from "./hlOAuthCallback";
export { generate } from "./generate";
