import { describe, expect, it } from "vitest";
import { formatMoney, formatMoneyWhole, monthRange, shiftMonth } from "./transactions";

describe("dates and money", () => {
  it("builds month ranges, including December", () => {
    expect(monthRange("2026-09")).toEqual({ from: "2026-09-01", to: "2026-10-01" });
    expect(monthRange("2026-12")).toEqual({ from: "2026-12-01", to: "2027-01-01" });
    expect(monthRange("nonsense")).toBeNull();
    expect(monthRange("2026-13")).toBeNull();
  });

  it("shifts months across year boundaries", () => {
    expect(shiftMonth("2026-01", -1)).toBe("2025-12");
    expect(shiftMonth("2026-12", 1)).toBe("2027-01");
    expect(shiftMonth("2026-05", 0)).toBe("2026-05");
    expect(shiftMonth("2026-09", -11)).toBe("2025-10");
  });

  it("formats money with an explicit sign when asked", () => {
    expect(formatMoney(-12.5, "USD")).toBe("$12.50");
    expect(formatMoney(-12.5, "USD", true)).toBe("−$12.50");
    expect(formatMoney(1234.5, "CAD", true)).toBe("+$1,234.50");
  });

  it("formats whole dollars for tables", () => {
    expect(formatMoneyWhole(1234.5, "USD")).toBe("$1,235");
    expect(formatMoneyWhole(0, "CAD")).toBe("$0");
  });
});
