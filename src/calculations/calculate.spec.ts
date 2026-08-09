import {
  CalculationError,
  computeDocumentTotals,
  computeLineBreakdown,
} from './calculate';
import { DiscountType } from './types';
import { dollarsToCents } from './money';

describe('calculations', () => {
  const sampleLines = [
    {
      quantity: 2,
      unitPriceCents: dollarsToCents(100),
      discountType: DiscountType.Percent,
      discountValue: 10,
      taxPercent: 5,
    },
    {
      quantity: 1,
      unitPriceCents: dollarsToCents(50),
      discountType: DiscountType.None,
      discountValue: 0,
      taxPercent: 5,
    },
    {
      quantity: 1,
      unitPriceCents: dollarsToCents(200),
      discountType: DiscountType.Fixed,
      discountValue: dollarsToCents(20),
      taxPercent: 0,
    },
  ];

  it('matches the assignment sample per-line results', () => {
    const [a, b, c] = sampleLines.map(computeLineBreakdown);

    expect(a).toMatchObject({
      subtotalCents: 20000,
      discountAmountCents: 2000,
      afterDiscountCents: 18000,
      taxAmountCents: 900,
      lineTotalCents: 18900,
    });
    expect(b).toMatchObject({
      subtotalCents: 5000,
      discountAmountCents: 0,
      afterDiscountCents: 5000,
      taxAmountCents: 250,
      lineTotalCents: 5250,
    });
    expect(c).toMatchObject({
      subtotalCents: 20000,
      discountAmountCents: 2000,
      afterDiscountCents: 18000,
      taxAmountCents: 0,
      lineTotalCents: 18000,
    });
  });

  it('matches the assignment sample document totals (421.50)', () => {
    const totals = computeDocumentTotals(sampleLines);
    expect(totals.subtotalCents).toBe(45000);
    expect(totals.totalDiscountCents).toBe(4000);
    expect(totals.totalTaxCents).toBe(1150);
    expect(totals.grandTotalCents).toBe(42150);
  });

  it('applies tax after discount', () => {
    const line = computeLineBreakdown({
      quantity: 2,
      unitPriceCents: 10000,
      discountType: DiscountType.Percent,
      discountValue: 10,
      taxPercent: 5,
    });
    expect(line.taxAmountCents).toBe(900);
  });

  it('rejects fixed discount greater than line subtotal', () => {
    expect(() =>
      computeLineBreakdown({
        quantity: 1,
        unitPriceCents: 20000,
        discountType: DiscountType.Fixed,
        discountValue: 25000,
        taxPercent: 0,
      }),
    ).toThrow(CalculationError);
  });

  it('rejects quantity less than 1', () => {
    expect(() =>
      computeLineBreakdown({
        quantity: 0,
        unitPriceCents: 100,
        discountType: DiscountType.None,
        discountValue: 0,
        taxPercent: 0,
      }),
    ).toThrow(/Quantity/);
  });

  it('rejects zero unit price', () => {
    expect(() =>
      computeLineBreakdown({
        quantity: 1,
        unitPriceCents: 0,
        discountType: DiscountType.None,
        discountValue: 0,
        taxPercent: 0,
      }),
    ).toThrow(/Unit price/);
  });

  it('rejects negative unit price', () => {
    expect(() =>
      computeLineBreakdown({
        quantity: 1,
        unitPriceCents: -1,
        discountType: DiscountType.None,
        discountValue: 0,
        taxPercent: 0,
      }),
    ).toThrow(/Unit price/);
  });

  it('rejects tax percent greater than 100', () => {
    expect(() =>
      computeLineBreakdown({
        quantity: 1,
        unitPriceCents: 1000,
        discountType: DiscountType.None,
        discountValue: 0,
        taxPercent: 101,
      }),
    ).toThrow(/Tax percent/);
  });
});
