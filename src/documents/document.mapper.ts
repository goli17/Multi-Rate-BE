import { centsToDollars } from '../calculations/money';
import { Document } from './entities/document.entity';
import { LineItem } from './entities/line-item.entity';
import { DiscountType } from '../calculations/types';

function mapLine(line: LineItem) {
  return {
    id: line.id,
    description: line.description,
    quantity: line.quantity,
    unitPrice: centsToDollars(line.unitPriceCents),
    discountType: line.discountType,
    discountPercent:
      line.discountType === DiscountType.Percent ? line.discountValue : null,
    discountFixed:
      line.discountType === DiscountType.Fixed
        ? centsToDollars(line.discountValue)
        : null,
    taxPercent: line.taxPercent,
    subtotal: centsToDollars(line.subtotalCents),
    discountAmount: centsToDollars(line.discountAmountCents),
    taxAmount: centsToDollars(line.taxAmountCents),
    lineTotal: centsToDollars(line.lineTotalCents),
  };
}

export function mapDocument(doc: Document) {
  const lines = (doc.lineItems ?? []).map(mapLine);
  return {
    id: doc.id,
    title: doc.title,
    customer: doc.customer,
    issueDate: doc.issueDate,
    status: doc.status,
    subtotal: centsToDollars(doc.subtotalCents),
    totalDiscount: centsToDollars(doc.totalDiscountCents),
    totalTax: centsToDollars(doc.totalTaxCents),
    grandTotal: centsToDollars(doc.grandTotalCents),
    lineItems: lines,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

export function mapDocumentSummary(doc: Document) {
  return {
    id: doc.id,
    title: doc.title,
    customer: doc.customer,
    issueDate: doc.issueDate,
    status: doc.status,
    subtotal: centsToDollars(doc.subtotalCents),
    totalDiscount: centsToDollars(doc.totalDiscountCents),
    totalTax: centsToDollars(doc.totalTaxCents),
    grandTotal: centsToDollars(doc.grandTotalCents),
  };
}
