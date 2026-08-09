export enum DiscountType {
  None = 'none',
  Percent = 'percent',
  Fixed = 'fixed',
}

export interface LineInput {
  quantity: number;
  unitPriceCents: number;
  discountType: DiscountType;
  discountValue: number;
  taxPercent: number;
}

export interface LineBreakdown {
  subtotalCents: number;
  discountAmountCents: number;
  afterDiscountCents: number;
  taxAmountCents: number;
  lineTotalCents: number;
}

export interface DocumentTotals {
  subtotalCents: number;
  totalDiscountCents: number;
  totalTaxCents: number;
  grandTotalCents: number;
  lines: LineBreakdown[];
}
