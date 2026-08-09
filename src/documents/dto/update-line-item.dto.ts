import { DiscountType } from '../../calculations/types';

export class UpdateLineItemDto {
  description?: string;
  quantity?: number;
  unitPrice?: number;
  discountType?: DiscountType;
  discountPercent?: number;
  discountFixed?: number;
  taxPercent?: number;
}
