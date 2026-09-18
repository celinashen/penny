import { describe, expect, it } from "vitest";
import {
  CAT,
  countryName,
  createCategorizer,
  detectForeignCountry,
  guessCategory,
  merchantKey,
} from "./index";

const guess = (
  description: string,
  amount = -10,
  extra: { plaidCategory?: string; country?: string; merchant?: string } = {},
) => guessCategory({ description, amount, ...extra });

describe("transfers stay out of spending", () => {
  it.each([
    "PAYMENT THANK YOU",
    "AUTOMATIC PAYMENT - THANK YOU",
    "Online transfer to SAV 1234",
    "CREDIT CARD PAYMENT",
  ])("%s", (d) => {
    expect(guess(d).category).toBe(CAT.transfer);
  });

  it("uses Plaid's transfer and card-payment categories", () => {
    expect(guess("x", -25, { plaidCategory: "LOAN_PAYMENTS_CREDIT_CARD_PAYMENT" }).category).toBe(CAT.transfer);
    expect(guess("x", -25, { plaidCategory: "TRANSFER_OUT_ACCOUNT_TRANSFER" }).category).toBe(CAT.transfer);
  });
});

describe("purchases outside the US and Canada are Travel", () => {
  it("trusts Plaid's country and names it in the note", () => {
    const categorize = createCategorizer([{ id: "t", name: CAT.travel }, { id: "f", name: CAT.food }], []);
    const r = categorize({ description: "TRATTORIA ROMA", amount: -42, plaidCategory: "FOOD_AND_DRINK_RESTAURANT", country: "IT" });
    expect(r.categoryId).toBe("t");
    expect(r.note).toBe("Italy");
    expect(r.country).toBe("IT");
  });

  it("does not treat US or Canada as foreign", () => {
    expect(guess("COFFEE", -5, { country: "US" }).category).toBe(CAT.food);
    expect(guess("COFFEE", -5, { country: "CA" }).category).toBe(CAT.food);
  });

  it("reads a trailing country code from a CSV description", () => {
    expect(detectForeignCountry({ description: "LAWSON TOKYO JP" })).toBe("JP");
    expect(detectForeignCountry({ description: "BOULANGERIE PARIS FRA" })).toBe("FR");
    expect(detectForeignCountry({ description: "PUB LONDON UK" })).toBe("GB");
  });

  it("is not fooled by US state or Canadian province codes", () => {
    for (const d of [
      "SAFEWAY SEATTLE WA",
      "SHOP WILMINGTON DE", // Delaware, not Germany
      "STORE INDIANAPOLIS IN", // Indiana, not India
      "CAFE DENVER CO", // Colorado, not Colombia
      "TIM HORTONS TORONTO ON",
      "SHOP ST JOHNS NL", // Newfoundland, not Netherlands
    ]) {
      expect(detectForeignCountry({ description: d })).toBeNull();
    }
  });

  it("recognises a few unambiguous foreign cities", () => {
    expect(detectForeignCountry({ description: "MISUTADONATSU SAPPORO" })).toBe("JP");
  });

  it("names countries", () => {
    expect(countryName("IT")).toBe("Italy");
    expect(countryName("JP")).toBe("Japan");
  });

  it("leaves refunds from abroad to normal categorization", () => {
    expect(guess("SHOP TOKYO JP", 20).category).not.toBe(CAT.travel);
  });
});

describe("well-known merchants", () => {
  it.each([
    ["NETFLIX.COM", CAT.bills],
    ["SAFEWAY #8919", CAT.groceries],
    ["QFC #5847 (Grocery)", CAT.groceries],
    ["STARBUCKS STORE 123", CAT.food],
    ["UBER TRIP HELP.UBER.COM", CAT.transportation],
    ["UBER EATS", CAT.food],
    ["AVIS RENT-A-CAR", CAT.travel], // not Rent
    ["DELTA 00623962110752", CAT.travel],
    ["TACO BELL 1234", CAT.food], // not the Bell phone company
    ["Pacific Crest Realty - Rent", CAT.rent],
    ["Lemonade Insurance", CAT.bills],
  ])("%s -> %s", (d, expected) => {
    expect(guess(d).category).toBe(expected);
  });

  it("does not mistake unrelated 'Delta' or 'United' businesses for airlines", () => {
    expect(guess("DELTA DENTAL").category).not.toBe(CAT.travel);
    expect(guess("UNITED WAY DONATION").category).not.toBe(CAT.travel);
  });
});

describe("money in", () => {
  it("counts paychecks as income", () => {
    expect(guess("Microsoft Paycheck", 1433.25).category).toBe(CAT.income);
  });

  it("keeps a refund in its original category so it nets against spending", () => {
    expect(guess("NIKE US STORES", 39, { plaidCategory: "GENERAL_MERCHANDISE_CLOTHING_AND_ACCESSORIES" }).category).toBe(CAT.clothing);
  });

  it.each([
    "ROBINHOOD DEPOSIT",
    "FIDELITY INVESTMENTS TRANSFER",
    "VANGUARD BUY INVESTMENT",
    "ROTH IRA CONTRIBUTION",
    "401K CONTRIBUTION",
  ])("files %s under Investments when money goes out", (d) => {
    expect(guess(d, -500).category).toBe(CAT.investments);
  });

  it("does not treat money coming back from a brokerage as a contribution", () => {
    expect(guess("ROBINHOOD WITHDRAWAL", 200).category).not.toBe(CAT.investments);
  });

  it("counts bank interest as income", () => {
    expect(guess("INTRST PYMNT", 3.12).category).toBe(CAT.income);
  });

  it("does not count unexplained money in as income", () => {
    expect(guess("MYSTERY CREDIT", 50).category).toBeNull();
  });

  it("falls back to Other for unknown spending", () => {
    expect(guess("ZQXV CORP", -12).category).toBe(CAT.other);
  });
});

describe("Plaid category mapping", () => {
  it.each([
    ["FOOD_AND_DRINK_GROCERIES", CAT.groceries],
    ["FOOD_AND_DRINK_RESTAURANT", CAT.food],
    ["TRAVEL_FLIGHTS", CAT.travel],
    ["TRANSPORTATION_GAS", CAT.transportation],
    ["RENT_AND_UTILITIES_GAS_AND_ELECTRICITY", CAT.utilities],
    ["RENT_AND_UTILITIES_INTERNET_AND_CABLE", CAT.bills],
    ["PERSONAL_CARE_HAIR_AND_BEAUTY", CAT.beauty],
    ["PERSONAL_CARE_GYMS_AND_FITNESS_CENTERS", CAT.health],
    ["MEDICAL_PHARMACIES_AND_SUPPLEMENTS", CAT.health],
    ["TRANSFER_OUT_INVESTMENT_AND_RETIREMENT_FUNDS", CAT.investments],
    ["INCOME_WAGES", CAT.income],
  ])("%s -> %s", (plaid, expected) => {
    expect(guess("ZQXV CORP", plaid.startsWith("INCOME") ? 100 : -10, { plaidCategory: plaid }).category).toBe(expected);
  });
});

describe("merchant rules", () => {
  const cats = [
    { id: "c-food", name: CAT.food },
    { id: "c-groc", name: CAT.groceries },
    { id: "c-travel", name: CAT.travel },
  ];

  it("keys the same merchant identically across store numbers", () => {
    expect(merchantKey("QFC #5847 (Grocery)")).toBe(merchantKey("QFC #1204"));
    expect(merchantKey("SQ *NODE")).toBe("node");
  });

  it("applies a rule you taught over built-in guesses", () => {
    const categorize = createCategorizer(cats, [
      { merchant_key: merchantKey("QFC #1"), category_id: "c-food" },
    ]);
    const r = categorize({ description: "QFC #5847", amount: -20 });
    expect(r.categoryId).toBe("c-food");
    expect(r.source).toBe("rule");
  });

  it("still files a foreign purchase under Travel despite a rule", () => {
    const categorize = createCategorizer(cats, [
      { merchant_key: merchantKey("STARBUCKS"), category_id: "c-food" },
    ]);
    expect(categorize({ description: "STARBUCKS", amount: -6, country: "JP" }).categoryId).toBe("c-travel");
  });

  it("returns no category when the user has deleted that category", () => {
    const categorize = createCategorizer([], []);
    expect(categorize({ description: "SAFEWAY", amount: -5 }).categoryId).toBeNull();
  });
});
