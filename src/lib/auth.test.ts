import { describe, expect, it } from "vitest";
import { createSessionToken, hashSessionToken, hasRole } from "./auth-core";
import { credentialsSchema, requirementCreateSchema } from "./schemas";

describe("session token helpers", () => {
  it("creates distinct URL-safe tokens and stores a one-way digest", () => {
    const first = createSessionToken();
    const second = createSessionToken();

    expect(first).not.toBe(second);
    expect(first).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(hashSessionToken(first)).not.toBe(first);
    expect(hashSessionToken(first)).toHaveLength(64);
    expect(hashSessionToken(first)).toBe(hashSessionToken(first));
  });
});

describe("role checks", () => {
  it("allows admins basic user access but reserves admin operations", () => {
    expect(hasRole("ADMIN", "USER")).toBe(true);
    expect(hasRole("USER", "ADMIN")).toBe(false);
    expect(hasRole("ADMIN", "ADMIN")).toBe(true);
  });
});

describe("request validation", () => {
  it("normalizes email and rejects passwords that bcrypt would truncate", () => {
    expect(credentialsSchema.parse({ email: "USER@Example.com", password: "correct horse!" }).email)
      .toBe("user@example.com");
    expect(credentialsSchema.safeParse({ email: "user@example.com", password: "é".repeat(37) }).success)
      .toBe(false);
  });

  it("rejects empty or oversized requirement titles", () => {
    expect(requirementCreateSchema.safeParse({ title: " " }).success).toBe(false);
    expect(requirementCreateSchema.safeParse({ title: "A useful requirement" }).success).toBe(true);
    expect(requirementCreateSchema.safeParse({ title: "x".repeat(201) }).success).toBe(false);
  });
});
