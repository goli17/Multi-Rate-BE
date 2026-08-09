import { Type } from 'class-transformer';
import {
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { DiscountType } from '../../calculations/types';

export class UpdateLineItemDto {
  @IsOptional()
  @IsString()
  @MinLength(1, { message: 'Description is required' })
  description?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 0 })
  @Min(1, { message: 'Quantity must be an integer >= 1' })
  quantity?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01, { message: 'Unit price must be greater than 0' })
  unitPrice?: number;

  @IsOptional()
  @IsEnum(DiscountType, {
    message: 'discountType must be none, percent, or fixed',
  })
  discountType?: DiscountType;

  @ValidateIf((o: UpdateLineItemDto) => o.discountType === DiscountType.Percent)
  @Type(() => Number)
  @IsNumber()
  @Min(0.01, { message: 'Percent discount must be greater than 0' })
  @Max(100, { message: 'Percent discount must be between 0 and 100' })
  discountPercent?: number;

  @ValidateIf((o: UpdateLineItemDto) => o.discountType === DiscountType.Fixed)
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01, { message: 'Fixed discount must be greater than 0' })
  discountFixed?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0, { message: 'Tax percent must be between 0 and 100' })
  @Max(100, { message: 'Tax percent must be between 0 and 100' })
  taxPercent?: number;
}
