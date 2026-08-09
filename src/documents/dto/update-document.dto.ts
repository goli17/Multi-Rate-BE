import { Type } from 'class-transformer';
import {
  IsDateString,
  IsIn,
  IsOptional,
  IsString,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { SUPPORTED_CURRENCIES } from '../../common/currencies';
import { CreateLineItemDto } from './create-document.dto';

export class UpdateDocumentDto {
  @IsOptional()
  @IsString()
  @MinLength(1, { message: 'Title is required' })
  title?: string;

  @IsOptional()
  @IsString()
  @MinLength(1, { message: 'Customer is required' })
  customer?: string;

  @IsOptional()
  @IsDateString()
  issueDate?: string;

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
