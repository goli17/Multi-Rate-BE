import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
  MinLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { DiscountType } from '../../calculations/types';
import { SUPPORTED_CURRENCIES } from '../../common/currencies';

export class CreateLineItemDto {
  @IsString()
  @MinLength(1, { message: 'Description is required' })
  description: string;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 0 })
  @Min(1, { message: 'Quantity must be an integer >= 1' })
  quantity: number;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01, { message: 'Unit price must be greater than 0' })
  unitPrice: number;

  @IsOptional()
  @IsEnum(DiscountType, {
    message: 'discountType must be none, percent, or fixed',
  })
  discountType?: DiscountType;

  @ValidateIf((o: CreateLineItemDto) => o.discountType === DiscountType.Percent)
  @Type(() => Number)
  @IsNumber()
  @Min(0.01, { message: 'Percent discount must be greater than 0' })
  @Max(100, { message: 'Percent discount must be between 0 and 100' })
  discountPercent?: number;

  @ValidateIf((o: CreateLineItemDto) => o.discountType === DiscountType.Fixed)
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

export class CreateDocumentDto {
  @IsString()
  @MinLength(1, { message: 'Title is required' })
  title: string;

  @IsString()
  @MinLength(1, { message: 'Customer is required' })
  customer: string;

  @IsDateString({}, { message: 'issueDate must be an ISO date (YYYY-MM-DD)' })
  issueDate: string;

  @IsOptional()
  @IsString()
  @IsIn([...SUPPORTED_CURRENCIES], {
    message: 'currency must be a supported ISO 4217 currency code',
  })
  currency?: string;

  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => CreateLineItemDto)
  lineItems?: CreateLineItemDto[];
}
