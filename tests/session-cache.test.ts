import { describe, expect, it } from "vitest";

import nextConfig from "@/next.config";

describe("session cache policy", () => {
  it("keeps session pages and APIs private without changing the public home page", async () => {
    const rules = await nextConfig.headers?.();
    expect(rules).toEqual(expect.arrayContaining([
      expect.objectContaining({ source: "/session/:path*", headers: expect.arrayContaining([
        { key: "Cache-Control", value: expect.stringContaining("no-store") }
      ]) }),
      expect.objectContaining({ source: "/api/session/:path*", headers: expect.arrayContaining([
        { key: "Cache-Control", value: expect.stringContaining("no-store") }
      ]) })
    ]));
    expect(rules?.some((rule) => rule.source === "/")).toBe(false);
  });
});
