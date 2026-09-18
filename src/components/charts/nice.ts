/** A round upper bound for an axis: 1, 2, 2.5, 5 or 10 times a power of ten. */
export function niceCeil(value: number): number {
  if (value <= 0) return 1;
  const power = 10 ** Math.floor(Math.log10(value));
  const step = [1, 2, 2.5, 5, 10].find((s) => value <= s * power) ?? 10;
  return step * power;
}
