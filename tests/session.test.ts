import { describe, expect, it } from "vitest";

import { constantTimeEquals, createAccessToken, hashAccessToken } from "@/lib/session/tokens";

describe("session tokens", () => {
  it("creates a high entropy access token", () => {
    const token = createAccessToken();
    expect(token.length).toBeGreaterThanOrEqual(40);
  });

  it("verifies token hashes without storing raw tokens", () => {
    const token = "student-token";
    const hash = hashAccessToken(token, "pepper");
    expect(hash).not.toContain(token);
    expect(constantTimeEquals(hash, hashAccessToken(token, "pepper"))).toBe(true);
    expect(constantTimeEquals(hash, hashAccessToken("other-token", "pepper"))).toBe(false);
  });

  it("blocks another session when cookie token hash does not match", () => {
    const storedHash = hashAccessToken("owner-token", "pepper");
    const attackerHash = hashAccessToken("attacker-token", "pepper");
    expect(constantTimeEquals(storedHash, attackerHash)).toBe(false);
  });
});
