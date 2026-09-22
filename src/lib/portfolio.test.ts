import { describe, expect, it } from "vitest";
import { contributionInflow, defaultPayrollFunded } from "./investments";
import {
  allocation,
  holdingGain,
  summarizePortfolio,
  type PortfolioAccount,
  type PortfolioHolding,
} from "./portfolio";

const account = (over: Partial<PortfolioAccount> = {}): PortfolioAccount => ({
  id: "a1", name: "401(k)", institution: "Fidelity", subtype: "401k", currency: "USD",
  payroll_funded: true, balance_current: null, ...over,
});

const holding = (over: Partial<PortfolioHolding> = {}): PortfolioHolding => ({
  id: "h1", account_id: "a1", ticker: "VTI", name: "Vanguard Total Market", security_type: "etf",
  quantity: 10, cost_basis: 1000, price: 150, market_value: 1500, plaid_security_id: "plaid-1", ...over,
});

describe("contributionInflow", () => {
  it("counts a contribution or deposit whichever sign the institution uses", () => {
    expect(contributionInflow({ type: "cash", subtype: "contribution", amount: -850 })).toBe(850);
    expect(contributionInflow({ type: "cash", subtype: "contribution", amount: 850 })).toBe(850);
    expect(contributionInflow({ type: "cash", subtype: "deposit", amount: -200 })).toBe(200);
    expect(contributionInflow({ type: "transfer", subtype: "contribution", amount: -300 })).toBe(300);
  });

  it("counts a plain transfer only when cash arrived", () => {
    expect(contributionInflow({ type: "transfer", subtype: "transfer", amount: -500 })).toBe(500);
    expect(contributionInflow({ type: "transfer", subtype: "transfer", amount: 500 })).toBeNull();
  });

  it.each([
    ["cash", "dividend", -12],
    ["cash", "interest", -3],
    ["cash", "withdrawal", 400],
    ["buy", "buy", 500],
    ["sell", "sell", -500],
    ["fee", "management fee", 9],
  ])("does not count %s / %s", (type, subtype, amount) => {
    expect(contributionInflow({ type, subtype, amount })).toBeNull();
  });

  it("ignores a zero amount", () => {
    expect(contributionInflow({ type: "cash", subtype: "contribution", amount: 0 })).toBeNull();
  });
});

describe("defaultPayrollFunded", () => {
  it("treats Fidelity investment accounts as paycheck-funded", () => {
    expect(defaultPayrollFunded("investment", "Fidelity Investments")).toBe(true);
    expect(defaultPayrollFunded("investment", "FIDELITY")).toBe(true);
  });

  it("does not for other brokerages, whose deposits come from your own bank", () => {
    expect(defaultPayrollFunded("investment", "Robinhood")).toBe(false);
    expect(defaultPayrollFunded("investment", null)).toBe(false);
  });

  it("does not for a Fidelity account that isn't an investment account", () => {
    expect(defaultPayrollFunded("checking", "Fidelity")).toBe(false);
  });
});

describe("summarizePortfolio", () => {
  it("gives total value, cost and gain", () => {
    const t = summarizePortfolio(
      [account({ balance_current: 1700 })],
      [holding(), holding({ id: "h2", ticker: "AAPL", quantity: 1, cost_basis: 150, price: 200, market_value: 200 })],
    );
    expect(t.totalValue).toBe(1700);
    expect(t.holdingsValue).toBe(1700);
    expect(t.costBasis).toBe(1150);
    expect(t.gain).toBe(550); // 1700 - 1150
    expect(t.gainPct).toBeCloseTo(550 / 1150);
  });

  it("reports a loss as a negative gain", () => {
    const t = summarizePortfolio([account()], [holding({ market_value: 800, price: 80 })]);
    expect(t.gain).toBe(-200);
    expect(t.gainPct).toBeCloseTo(-0.2);
  });

  it("keeps cash in the total but out of gain/loss", () => {
    const t = summarizePortfolio([account({ balance_current: 1600 })], [holding()]);
    expect(t.totalValue).toBe(1600);
    expect(t.cash).toBe(100);
    expect(t.gain).toBe(500);
  });

  it("leaves holdings without a known cost out of gain/loss and counts them", () => {
    const t = summarizePortfolio(
      [account()],
      [holding(), holding({ id: "h2", ticker: "XYZ", cost_basis: null, market_value: 900, price: 90 })],
    );
    expect(t.missingBasis).toBe(1);
    expect(t.costBasis).toBe(1000);
    expect(t.gain).toBe(500); // only VTI: 1500 - 1000, not inflated by XYZ
    expect(t.holdingsValue).toBe(2400);
  });

  it("does not treat cash holdings as missing a cost", () => {
    const t = summarizePortfolio([account()], [holding({ security_type: "cash", cost_basis: null, market_value: 50, price: 1, quantity: 50 })]);
    expect(t.missingBasis).toBe(0);
    expect(t.gain).toBe(0);
  });

  it("falls back to price times quantity when there is no market value", () => {
    const t = summarizePortfolio([account()], [holding({ market_value: null })]);
    expect(t.holdingsValue).toBe(1500);
  });

  it("uses what it knows when the institution gives no account total", () => {
    expect(summarizePortfolio([account({ balance_current: null })], [holding()]).totalValue).toBe(1500);
  });

  it("only counts the accounts it is given", () => {
    const t = summarizePortfolio([account({ id: "a1" })], [holding(), holding({ id: "h9", account_id: "other", market_value: 9999 })]);
    expect(t.holdingsValue).toBe(1500);
  });

  it("has no percentage when there is no cost to compare with", () => {
    expect(summarizePortfolio([account()], []).gainPct).toBeNull();
  });
});

describe("holdingGain", () => {
  it("gives a position's own gain and percent", () => {
    expect(holdingGain(holding())).toEqual({ gain: 500, pct: 0.5 });
  });
  it("is null when the cost is unknown or it is cash", () => {
    expect(holdingGain(holding({ cost_basis: null }))).toBeNull();
    expect(holdingGain(holding({ security_type: "cash" }))).toBeNull();
  });
});

describe("allocation", () => {
  it("splits by kind of asset with a stable color per type", () => {
    const slices = allocation(
      [account()],
      [
        holding({ security_type: "etf", market_value: 600 }),
        holding({ id: "h2", security_type: "equity", market_value: 300 }),
        holding({ id: "h3", security_type: "mutual fund", market_value: 100 }),
      ],
    );
    expect(slices.map((s) => s.label)).toEqual(["ETFs", "Stocks", "Mutual funds"]);
    expect(slices.reduce((t, s) => t + s.value, 0)).toBe(1000);
    const again = allocation([account()], [holding({ security_type: "equity", market_value: 50 })]);
    expect(again[0].color).toBe(slices.find((s) => s.label === "Stocks")!.color);
  });

  it("adds uninvested cash the institution reports", () => {
    const slices = allocation([account({ balance_current: 1100 })], [holding({ market_value: 1000 })]);
    expect(slices.find((s) => s.label === "Cash")?.value).toBe(100);
  });
});
