export type Filters = {
  q: string;
  account: string[];
  category: string[];
  month: string;
  trip: string[];
  from: string;
  to: string;
};

export const hasFilters = (f: Filters) =>
  Object.values(f).some((v) => (Array.isArray(v) ? v.length > 0 : Boolean(v)));

/** Filters live in the URL (repeated keys for multi-selects), so they can be bookmarked and shared. */
export function filtersQuery(f: Filters) {
  const params = new URLSearchParams();
  if (f.q) params.set("q", f.q);
  for (const key of ["account", "category", "trip"] as const) {
    for (const id of f[key]) params.append(key, id);
  }
  if (f.from || f.to) {
    if (f.from) params.set("from", f.from);
    if (f.to) params.set("to", f.to);
  } else if (f.month) {
    params.set("month", f.month);
  }
  return params;
}
