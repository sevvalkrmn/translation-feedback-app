import crypto from "node:crypto";

export const SESSION_COOKIE_NAME = "tf_session_token";

export function createAccessToken(): string {
  return crypto.randomBytes(32).toString("base64url");
}

export function hashAccessToken(token: string, pepper: string): string {
  if (!pepper) {
    throw new Error("SESSION_TOKEN_PEPPER tanımlı değil.");
  }
  return crypto.createHmac("sha256", pepper).update(token).digest("hex");
}

export function constantTimeEquals(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }
  return crypto.timingSafeEqual(leftBuffer, rightBuffer);
}
