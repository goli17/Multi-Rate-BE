import { BadRequestException } from '@nestjs/common';
import { DiscountType } from '../calculations/types';
import { dollarsToCents } from '../calculations/money';
import { CreateLineItemDto } from './dto/create-document.dto';

export function resolveDiscount(dto: CreateLineItemDto): {
  discountType: DiscountType;
  discountValue: number;
} {
  const hasPercent =
    dto.discountPercent !== undefined && dto.discountPercent !== null;
  const hasFixed =
    dto.discountFixed !== undefined && dto.discountFixed !== null;

  if (hasPercent && hasFixed) {
    throw new BadRequestException(
      'A line may have percent discount or fixed discount, not both. Remove one of discountPercent or discountFixed.',
    );
  }

  if (dto.discountType === DiscountType.Percent || (hasPercent && !hasFixed)) {
    if (!hasPercent) {
      throw new BadRequestException(
        'discountPercent is required when discountType is percent',
      );
    }
    return {
      discountType: DiscountType.Percent,
      discountValue: dto.discountPercent as number,
    };
  }

  if (dto.discountType === DiscountType.Fixed || (hasFixed && !hasPercent)) {
    if (!hasFixed) {
      throw new BadRequestException(
        'discountFixed is required when discountType is fixed',
      );
    }
    return {
      discountType: DiscountType.Fixed,
      discountValue: dollarsToCents(dto.discountFixed as number),
    };
  }

  return { discountType: DiscountType.None, discountValue: 0 };
}
