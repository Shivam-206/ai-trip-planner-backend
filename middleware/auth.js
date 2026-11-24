import { getAuth } from "firebase-admin/auth";

const INVALID_TOKEN_CODES = new Set([
  "auth/argument-error",
  "auth/id-token-expired",
  "auth/id-token-revoked",
  "auth/invalid-id-token",
  "auth/user-disabled",
  "auth/user-not-found",
]);

export async function requireAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const match = header.match(/^Bearer\s+(.+)$/i);

  if (!match) {
    return res.status(401).json({ error: "Missing or invalid Authorization header" });
  }

  try {
    const decoded = await getAuth().verifyIdToken(match[1]);
    req.user = {
      uid: decoded.uid,
      email: decoded.email || "",
      name: decoded.name || "",
    };
    return next();
  } catch (error) {
    if (INVALID_TOKEN_CODES.has(error?.code)) {
      return res.status(401).json({ error: "Invalid or expired token" });
    }

    console.error("Firebase ID token verification failed:", error);
    return res.status(500).json({ error: "Authentication could not be verified" });
  }
}
