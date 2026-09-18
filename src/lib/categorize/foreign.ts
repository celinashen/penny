// Detects purchases made outside the United States and Canada.
//
// Plaid gives a reliable `location.country` when the card issuer supplies it.
// For CSV imports there is only the description, so we look for a trailing
// country code (e.g. "TOKYO JP", "PARIS FRA"). The 2-letter check deliberately
// skips codes that are also US state or Canadian province abbreviations
// (DE, IN, CO, ...), because guessing wrong there is worse than missing one.

const DOMESTIC = new Set(["US", "CA"]);

// Countries whose 2-letter code is NOT a US state/territory or CA province.
const TWO_LETTER = new Set([
  "JP", "GB", "FR", "IT", "ES", "MX", "KR", "TW", "TH", "VN", "SG", "AU",
  "NZ", "IE", "PT", "GR", "TR", "CH", "AT", "SE", "NO", "DK", "FI", "IS",
  "CL", "BR", "CR", "PH", "HK", "CN", "AE", "BE", "CZ", "HU", "PL", "MY",
  "KH", "MA", "EG", "ZA",
]);

const THREE_TO_TWO: Record<string, string> = {
  JPN: "JP", GBR: "GB", FRA: "FR", ITA: "IT", ESP: "ES", MEX: "MX",
  KOR: "KR", TWN: "TW", THA: "TH", VNM: "VN", SGP: "SG", AUS: "AU",
  NZL: "NZ", IRL: "IE", PRT: "PT", GRC: "GR", TUR: "TR", CHE: "CH",
  AUT: "AT", SWE: "SE", NOR: "NO", DNK: "DK", FIN: "FI", ISL: "IS",
  CHL: "CL", BRA: "BR", CRI: "CR", PHL: "PH", HKG: "HK", CHN: "CN",
  ARE: "AE", BEL: "BE", CZE: "CZ", HUN: "HU", POL: "PL", MYS: "MY",
  KHM: "KH", MAR: "MA", EGY: "EG", ZAF: "ZA", NLD: "NL", DEU: "DE",
  IND: "IN", IDN: "ID", PER: "PE", COL: "CO", ARG: "AR",
};

// A few place names that are unambiguous abroad.
const PLACES: [RegExp, string][] = [
  [/\b(tokyo|osaka|kyoto|sapporo|hokkaido|niseko|noboribetsu)\b/i, "JP"],
  [/\b(reykjavik)\b/i, "IS"],
  [/\b(bangkok|chiang mai)\b/i, "TH"],
  [/\b(seoul|busan)\b/i, "KR"],
  [/\b(taipei)\b/i, "TW"],
  [/\b(lisbon|lisboa)\b/i, "PT"],
  [/\b(cusco|lima peru)\b/i, "PE"],
];

/** ISO alpha-2 code if the purchase looks foreign, otherwise null. */
export function detectForeignCountry(input: {
  country?: string | null;
  description: string;
}): string | null {
  const fromPlaid = input.country?.trim().toUpperCase();
  if (fromPlaid) return DOMESTIC.has(fromPlaid) ? null : fromPlaid;

  const tokens = input.description
    .toUpperCase()
    .replace(/[^A-Z\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
  const last = tokens[tokens.length - 1];
  if (last) {
    if (last.length === 3 && THREE_TO_TWO[last]) return THREE_TO_TWO[last];
    if (last.length === 2 && TWO_LETTER.has(last)) return last;
    if (last === "UK") return "GB";
  }

  for (const [re, code] of PLACES) {
    if (re.test(input.description)) return code;
  }
  return null;
}

/** "IT" -> "Italy". Falls back to the code itself. */
export function countryName(code: string): string {
  try {
    return new Intl.DisplayNames(["en"], { type: "region" }).of(code) ?? code;
  } catch {
    return code;
  }
}
