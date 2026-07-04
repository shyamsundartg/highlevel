import { auth } from "../config/firebase";

export class AuthError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "AuthError";
  }
}

export async function verifyBearerToken(
  authorizationHeader: string | undefined,
): Promise<string> {
  if (!authorizationHeader?.startsWith("Bearer ")) {
    throw new AuthError(
      "UNAUTHORIZED",
      "Missing or invalid Authorization header",
    );
  }

  const token = authorizationHeader.slice("Bearer ".length).trim();
  if (!token) {
    throw new AuthError("UNAUTHORIZED", "Missing bearer token");
  }

  try {
    const decoded = await auth.verifyIdToken(token);
    return decoded.uid;
  } catch {
    throw new AuthError("UNAUTHORIZED", "Invalid or expired token");
  }
}
