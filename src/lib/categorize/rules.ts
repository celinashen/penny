import { CAT, type CategoryName } from "./names";

/** Plaid's detailed category -> ours. First match wins, so specific goes first. */
const PLAID: [prefix: string, category: CategoryName][] = [
  ["INCOME_", CAT.income],
  ["TRANSFER_IN_", CAT.transfer],
  ["TRANSFER_OUT_INVESTMENT_AND_RETIREMENT_FUNDS", CAT.investments],
  ["TRANSFER_OUT_", CAT.transfer],
  ["LOAN_PAYMENTS_CREDIT_CARD_PAYMENT", CAT.transfer],
  ["LOAN_PAYMENTS_MORTGAGE_PAYMENT", CAT.rent],
  ["LOAN_PAYMENTS_", CAT.bills],
  ["BANK_FEES_", CAT.bills],
  ["ENTERTAINMENT_", CAT.entertainment],
  ["FOOD_AND_DRINK_GROCERIES", CAT.groceries],
  ["FOOD_AND_DRINK_", CAT.food],
  ["GENERAL_MERCHANDISE_CLOTHING_AND_ACCESSORIES", CAT.clothing],
  ["GENERAL_MERCHANDISE_ELECTRONICS", CAT.technology],
  ["GENERAL_MERCHANDISE_GIFTS_AND_NOVELTIES", CAT.gifts],
  ["GENERAL_MERCHANDISE_SPORTING_GOODS", CAT.hobbies],
  ["GENERAL_MERCHANDISE_BOOKSTORES_AND_NEWSSTANDS", CAT.hobbies],
  ["GENERAL_MERCHANDISE_PET_SUPPLIES", CAT.household],
  ["GENERAL_MERCHANDISE_OFFICE_SUPPLIES", CAT.household],
  ["GENERAL_MERCHANDISE_", CAT.other],
  ["HOME_IMPROVEMENT_", CAT.household],
  ["MEDICAL_", CAT.health],
  ["PERSONAL_CARE_GYMS_AND_FITNESS_CENTERS", CAT.health],
  ["PERSONAL_CARE_HAIR_AND_BEAUTY", CAT.beauty],
  ["PERSONAL_CARE_", CAT.household],
  ["TRANSPORTATION_", CAT.transportation],
  ["TRAVEL_", CAT.travel],
  ["RENT_AND_UTILITIES_RENT", CAT.rent],
  ["RENT_AND_UTILITIES_INTERNET_AND_CABLE", CAT.bills],
  ["RENT_AND_UTILITIES_TELEPHONE", CAT.bills],
  ["RENT_AND_UTILITIES_", CAT.utilities],
  ["GENERAL_SERVICES_INSURANCE", CAT.bills],
  ["GENERAL_SERVICES_ACCOUNTING_AND_FINANCIAL_PLANNING", CAT.bills],
  ["GENERAL_SERVICES_AUTOMOTIVE", CAT.transportation],
  ["GENERAL_SERVICES_EDUCATION", CAT.hobbies],
  ["GENERAL_SERVICES_", CAT.other],
  ["GOVERNMENT_AND_NON_PROFIT_DONATIONS", CAT.gifts],
  ["GOVERNMENT_AND_NON_PROFIT_TAX_PAYMENT", CAT.bills],
  ["GOVERNMENT_AND_NON_PROFIT_", CAT.other],
  ["OTHER_", CAT.other],
];

export function fromPlaidCategory(detailed: string | null | undefined) {
  if (!detailed) return null;
  return PLAID.find(([prefix]) => detailed.startsWith(prefix))?.[1] ?? null;
}

/** Credit card payments and moves between your own accounts. */
export const TRANSFER_PATTERN =
  /\b(payment[\s-]+thank you|autopay|auto[\s-]?pay|automatic payment|online payment|online pmt|e-?payment|payment received|credit card payment|card payment|(online |internal |wire |funds |acct |account )?transfer (to|from)|online transfer|internal transfer|wire transfer|funds transfer|acct transfer|xfer)\b/i;

type Keyword = { re: RegExp; category: CategoryName; sign?: "in" | "out" };

/**
 * Well-known merchants, used when Plaid's category is missing (CSV imports) or
 * when a merchant is better treated differently (subscriptions).
 */
export const KEYWORDS: Keyword[] = [
  // Income
  { re: /\b(paycheck|payroll|direct dep(osit)?|salary)\b/i, category: CAT.income, sign: "in" },
  { re: /\b(interest (paid|earned|payment)|intrst|cash redemption|cashback|cash back)\b/i, category: CAT.income, sign: "in" },
  // Investing
  { re: /\b(robinhood|fidelity|vanguard|schwab|wealthfront|betterment|wealthsimple|questrade|e\*?trade|merrill|interactive brokers|401\s?-?k|roth|ira (contribution|deposit))\b/i, category: CAT.investments, sign: "out" },
  // Subscriptions & bills
  { re: /\b(netflix|spotify|hulu|disney\s?plus|max\.com|hbo|youtube\s?(premium|tv)|apple\.com\/bill|itunes|icloud|google\s?(one|storage)|adobe|dropbox|openai|anthropic|claude\.ai|github|notion|1password|patreon|substack)\b/i, category: CAT.bills },
  { re: /\b(t-?mobile|tello|freedom mobile|verizon|at&t|rogers|bell (canada|mobility|aliant)|telus|fido|koodo|mint mobile)\b/i, category: CAT.bills },
  { re: /\b(insurance|geico|lemonade|state farm|progressive|allstate)\b/i, category: CAT.bills },
  { re: /\b(annual (membership )?fee|membership fee|student loan|nslsc|turbotax|intuit)\b/i, category: CAT.bills },
  // Utilities & rent
  { re: /\b(comcast|xfinity|astound|centurylink|internet)\b/i, category: CAT.bills },
  { re: /\b(city light|pg&e|con ?ed|puget sound energy|energy billing|electric|water (bill|utilities)|hydro)\b/i, category: CAT.utilities },
  // Groceries
  { re: /\b(safeway|qfc|kroger|fred[\s-]?meyer|trader joe'?s?|whole foods|h ?mart|t ?& ?t supermarket|costco|aldi|sprouts|publix|wegmans|loblaws|sobeys|no frills|metro inc|farm boy|walmart (grocery|supercenter)|instacart)\b/i, category: CAT.groceries },
  // Transport
  { re: /\b(uber(?!\s?eats)|lyft|orca|clipper|presto|ttc|translink|bart|transit|parking|chevron|shell|arco|exxon|76 -|gas station|envoy car share|zipcar|turo)\b/i, category: CAT.transportation },
  // Travel
  { re: /\b(airlines?|airways?|delta (air|\d{6,})|united (airlines|\d{6,})|alaska air|air canada|westjet|jetblue|southwest (air|airlines)|avianca|expedia|booking\.com|airbnb|marriott|hilton|hyatt|hotel|hostel|avis|hertz|enterprise rent|rent-?a-?car|kayak|priceline|chase travel)\b/i, category: CAT.travel },
  // Rent (after Travel so "Rent-A-Car" isn't mistaken for it)
  { re: /\b(rent(?!-?\s?a-?\s?car)|property management|realty|apartments?)\b/i, category: CAT.rent, sign: "out" },
  // Food
  { re: /\b(starbucks|mcdonald'?s|doordash|uber\s?eats|grubhub|skip the dishes|chipotle|shake shack|wendy'?s|a&w|subway|tim hortons|dunkin|taco bell|burger king|kfc|popeyes|panda express|five guys|in-n-out|domino'?s|papa john'?s|chick-?fil-?a|panera|coffee|cafe|café|restaurant|pizza|sushi|ramen|noodle|bakery|boba|tea|bar & grill|kitchen|diner|bbq)\b/i, category: CAT.food },
  // Shopping
  { re: /\b(nike|uniqlo|zara|h&m|lululemon|gap|old navy|nordstrom|aritzia|patagonia|rei|arc'?teryx)\b/i, category: CAT.clothing },
  { re: /\b(apple store|best buy|microcenter|newegg|b&h photo)\b/i, category: CAT.technology },
  { re: /\b(ikea|target|home depot|lowe'?s|bed bath|wayfair|container store)\b/i, category: CAT.household },
  { re: /\b(sephora|ulta|glossier|bath & body)\b/i, category: CAT.beauty },
  { re: /\b(cvs|walgreens|rite aid|pharmacy|shoppers drug|dental|dentist|clinic|hospital|gym|fitness|yoga|climbing|bouldering)\b/i, category: CAT.health },
  { re: /\b(amc|cinema|regal|ticketmaster|eventbrite|stubhub|live nation|museum|theatre|theater|concert)\b/i, category: CAT.entertainment },
  { re: /\b(michaels|blick|hobby lobby|etsy|steam|nintendo|playstation)\b/i, category: CAT.hobbies },
];
