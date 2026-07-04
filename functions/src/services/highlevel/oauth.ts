import { env } from "../../config/env";
import {
  HL_API_BASE,
  HL_API_VERSION,
  HL_AUTH_BASE,
  HL_TOKEN_URL,
  HL_USER_TYPE,
} from "./constants";

export interface HlTokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  locationId: string;
  userId: string;
  scope: string;
}

export function buildAuthUrl(state: string): string {
  const params = new URLSearchParams({
    response_type: "code",
    client_id: env.hlClientId,
    redirect_uri: env.hlOAuthRedirectUri,
    scope: env.hlOAuthScopes,
    state,
  });
  return `${HL_AUTH_BASE}?${params.toString()}`;
}

export async function exchangeCodeForTokens(
  code: string,
): Promise<HlTokenResponse> {
  const body = new URLSearchParams({
    client_id: env.hlClientId,
    client_secret: env.hlClientSecret,
    grant_type: "authorization_code",
    code,
    redirect_uri: env.hlOAuthRedirectUri,
    user_type: HL_USER_TYPE,
  });

  const response = await fetch(HL_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: body.toString(),
  });

  if (!response.ok) {
    const detail = await safeReadText(response);
    throw new Error(
      `HL token exchange failed (${response.status}): ${detail}`,
    );
  }

  const data = (await response.json()) as Partial<HlTokenResponse>;
  if (!data.access_token || !data.refresh_token || !data.locationId) {
    throw new Error("HL token response missing required fields");
  }

  const userId = data.userId || "";
  if (!userId) {
    throw new Error("HL token response missing userId");
  }

  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_in: data.expires_in ?? 86399,
    locationId: data.locationId,
    userId,
    scope: data.scope ?? "",
  };
}

export async function refreshAccessToken(
  refreshToken: string,
): Promise<HlTokenResponse> {
  const body = new URLSearchParams({
    client_id: env.hlClientId,
    client_secret: env.hlClientSecret,
    grant_type: "refresh_token",
    refresh_token: refreshToken,
    user_type: HL_USER_TYPE,
  });

  const response = await fetch(HL_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: body.toString(),
  });

  if (!response.ok) {
    const detail = await safeReadText(response);
    throw new Error(
      `HL token refresh failed (${response.status}): ${detail}`,
    );
  }

  const data = (await response.json()) as Partial<HlTokenResponse> & {
    user_id?: string;
  };
  if (!data.access_token || !data.refresh_token) {
    throw new Error("HL refresh response missing required fields");
  }

  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_in: data.expires_in ?? 86399,
    locationId: data.locationId ?? "",
    userId: data.userId ||"",
    scope: data.scope ?? "",
  };
}

export async function fetchLocationName(
  accessToken: string,
  locationId: string,
): Promise<string> {
  try {
    const response = await fetch(`${HL_API_BASE}/locations/${locationId}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Version: HL_API_VERSION,
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      return locationId;
    }

    const data = (await response.json()) as {
      location?: { name?: string };
      name?: string;
    };
    return data.location?.name ?? data.name ?? locationId;
  } catch {
    return locationId;
  }
}

async function safeReadText(response: Response): Promise<string> {
  try {
    return await response.text();
  } catch {
    return "<no body>";
  }
}
