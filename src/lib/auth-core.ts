import { createHash, randomBytes } from "node:crypto";

export const SESSION_COOKIE = "frontier_session";
export const SESSION_TTL_SECONDS = 60 * 60 * 24 * 14;

export function createSessionToken() {
  return randomBytes(32).toString("base64url");
}

export function hashSessionToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function hasRole(role: string, required: "USER" | "ADMIN") {
  return required === "USER" ? role === "USER" || role === "ADMIN" : role === "ADMIN";
}
