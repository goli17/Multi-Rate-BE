export function dollarsToCents(dollars: number): number {
  return Math.round(dollars * 100);
}

export function centsToDollars(cents: number): number {
  return Number((cents / 100).toFixed(2));
}

export function roundCents(value: number): number {
  return Math.round(value);
}
