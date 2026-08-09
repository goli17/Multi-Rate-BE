import { dollarsToCents, roundCents } from './money';
import {
  DiscountType,
  DocumentTotals,
  LineBreakdown,
  LineInput,
} from './types';

export class CalculationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CalculationError';
  }
}

export function computeLineBreakdown(line: LineInput): LineBreakdown {
  if (!Number.isInteger(line.quantity) || line.quantity < 1) {
    throw new CalculationError('Quantity must be an integer >= 1');
  }
  if (!Number.isInteger(line.unitPriceCents) || line.unitPriceCents < 0) {
    throw new CalculationError('Unit price must be >= 0 (in cents)');
  }
  if (line.taxPercent < 0) {
    throw new CalculationError('Tax percent must be >= 0');
  }

  const subtotalCents = line.quantity * line.unitPriceCents;
  let discountAmountCents = 0;

  if (line.discountType === DiscountType.Percent) {
    if (line.discountValue < 0 || line.discountValue > 100) {
      throw new CalculationError(
        'Percent discount must be between 0 and 100',
      );
    }
    discountAmountCents = roundCents((subtotalCents * line.discountValue) / 100);
  } else if (line.discountType === DiscountType.Fixed) {
    const fixedCents = Number.isInteger(line.discountValue)
      ? line.discountValue
      : dollarsToCents(line.discountValue);
    if (fixedCents < 0) {
      throw new CalculationError('Fixed discount must be >= 0');
    }
    if (fixedCents > subtotalCents) {
      throw new CalculationError(
        `Fixed discount ${centsLabel(fixedCents)} exceeds line subtotal ${centsLabel(subtotalCents)}. Use a discount of at most ${centsLabel(subtotalCents)}.`,
      );
    }
    discountAmountCents = fixedCents;
  } else if (line.discountType !== DiscountType.None) {
    throw new CalculationError(
      'Discount type must be none, percent, or fixed (not both percent and fixed)',
    );
  }

  const afterDiscountCents = subtotalCents - discountAmountCents;
  const taxAmountCents = roundCents((afterDiscountCents * line.taxPercent) / 100);
  const lineTotalCents = afterDiscountCents + taxAmountCents;

  return {
    subtotalCents,
    discountAmountCents,
    afterDiscountCents,
    taxAmountCents,
    lineTotalCents,
  };
}

export function computeDocumentTotals(lines: LineInput[]): DocumentTotals {
  const breakdowns = lines.map(computeLineBreakdown);
  return {
    subtotalCents: breakdowns.reduce((s, l) => s + l.subtotalCents, 0),
    totalDiscountCents: breakdowns.reduce(
      (s, l) => s + l.discountAmountCents,
      0,
    ),
    totalTaxCents: breakdowns.reduce((s, l) => s + l.taxAmountCents, 0),
    grandTotalCents: breakdowns.reduce((s, l) => s + l.lineTotalCents, 0),
    lines: breakdowns,
  };
}

function centsLabel(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}
