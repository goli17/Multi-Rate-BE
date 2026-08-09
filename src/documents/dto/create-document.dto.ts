import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  MinLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { DiscountType } from '../../calculations/types';

export class CreateLineItemDto {
  @IsString()
  @MinLength(1)
  description: string;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 0 })
  @Min(1, { message: 'Quantity must be an integer >= 1' })
  quantity: number;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0, { message: 'Unit price must be >= 0' })
  unitPrice: number;

  @IsOptional()
  @IsEnum(DiscountType, {
    message: 'discountType must be none, percent, or fixed',
  })
  discountType?: DiscountType;

  @ValidateIf((o: CreateLineItemDto) => o.discountType === DiscountType.Percent)
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  discountPercent?: number;

  @ValidateIf((o: CreateLineItemDto) => o.discountType === DiscountType.Fixed)
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  discountFixed?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0, { message: 'Tax percent must be >= 0' })
  taxPercent?: number;
}

export class CreateDocumentDto {
  @IsString()
  @MinLength(1)
  title: string;

  @IsString()
  @MinLength(1)
  customer: string;

  @IsDateString({}, { message: 'issueDate must be an ISO date (YYYY-MM-DD)' })
  issueDate: string;

  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => CreateLineItemDto)
  lineItems?: CreateLineItemDto[];
}
