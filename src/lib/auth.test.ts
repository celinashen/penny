import { afterEach, describe, expect, it } from "vitest";
import { isDemoUser } from "./auth";

describe("isDemoUser", () => {
  const ORIGINAL = process.env.DEMO_ACCOUNT_EMAIL;

  afterEach(() => {
    if (ORIGINAL === undefined) delete process.env.DEMO_ACCOUNT_EMAIL;
    else process.env.DEMO_ACCOUNT_EMAIL = ORIGINAL;
  });

  it("is never true when no demo email is configured", () => {
    delete process.env.DEMO_ACCOUNT_EMAIL;
    expect(isDemoUser({ email: "anyone@example.com" })).toBe(false);
  });

  it("matches the configured demo email, ignoring case and whitespace", () => {
    process.env.DEMO_ACCOUNT_EMAIL = " Demo@Penny.App ";
    expect(isDemoUser({ email: "demo@penny.app" })).toBe(true);
    expect(isDemoUser({ email: "DEMO@PENNY.APP" })).toBe(true);
  });

  it("is false for anyone else, or a signed-out request", () => {
    process.env.DEMO_ACCOUNT_EMAIL = "demo@penny.app";
    expect(isDemoUser({ email: "someone-else@penny.app" })).toBe(false);
    expect(isDemoUser(null)).toBe(false);
    expect(isDemoUser(undefined)).toBe(false);
    expect(isDemoUser({ email: undefined })).toBe(false);
  });
});
