// The default category names, exactly as seeded by migration 0001.
export const CAT = {
  beauty: "Beauty, Bath & Skincare",
  bills: "Bills & Subscriptions",
  clothing: "Clothing",
  entertainment: "Entertainment & Activities",
  food: "Food & Drink",
  gifts: "Gifts",
  groceries: "Groceries",
  health: "Health & Wellbeing",
  hobbies: "Hobbies & Interests",
  household: "Household & Living",
  investments: "Investments",
  rent: "Rent",
  technology: "Technology",
  transportation: "Transportation",
  travel: "Travel",
  utilities: "Utilities",
  other: "Other",
  income: "Income",
  transfer: "Transfer",
} as const;

export type CategoryName = (typeof CAT)[keyof typeof CAT];
