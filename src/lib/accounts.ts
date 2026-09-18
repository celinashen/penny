export const ACCOUNT_TYPES = [
  { value: "credit", label: "Credit card" },
  { value: "checking", label: "Checking" },
  { value: "savings", label: "Savings" },
  { value: "investment", label: "Investment" },
  { value: "other", label: "Other" },
] as const;

export const CURRENCIES = [
  { value: "USD", label: "US dollar" },
  { value: "CAD", label: "Canadian dollar" },
] as const;

export type AccountType = (typeof ACCOUNT_TYPES)[number]["value"];
export type Currency = (typeof CURRENCIES)[number]["value"];

export type Account = {
  id: string;
  name: string;
  institution: string | null;
  type: AccountType;
  currency: Currency;
  source: "plaid" | "csv" | "manual";
};

export const accountTypeLabel = (type: AccountType) =>
  ACCOUNT_TYPES.find((t) => t.value === type)?.label ?? type;

export const isAccountType = (v: string): v is AccountType =>
  ACCOUNT_TYPES.some((t) => t.value === v);

export const isCurrency = (v: string): v is Currency =>
  CURRENCIES.some((c) => c.value === v);
