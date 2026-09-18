import { describe, expect, it } from "vitest";
import { resolveCurrencyView } from "./view-params";

describe("resolveCurrencyView", () => {
  it("shows both currencies by default when you have both", () => {
    const v = resolveCurrencyView("", ["CAD", "USD"]);
    expect(v.shown).toEqual(["USD", "CAD"]);
    expect(v.mode).toBe("both");
    expect(v.options.map((o) => o.label)).toEqual(["Both", "USD", "CAD"]);
  });

  it("narrows to one currency when asked", () => {
    expect(resolveCurrencyView("CAD", ["USD", "CAD"])).toMatchObject({ shown: ["CAD"], mode: "CAD" });
  });

  it("ignores an unknown or unavailable choice", () => {
    expect(resolveCurrencyView("EUR", ["USD", "CAD"]).mode).toBe("both");
    expect(resolveCurrencyView("CAD", ["USD"])).toMatchObject({ shown: ["USD"], options: [] });
  });

  it("needs no toggle with a single currency, and falls back to USD with none", () => {
    expect(resolveCurrencyView("", ["CAD"])).toMatchObject({ shown: ["CAD"], options: [] });
    expect(resolveCurrencyView("", [])).toMatchObject({ shown: ["USD"], options: [] });
  });
});
