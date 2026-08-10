import { Transform } from 'class-transformer';
import {
  ArrayUnique,
  IsArray,
  IsDateString,
  IsIn,
  IsOptional,
  IsString,
} from 'class-validator';
import { SUPPORTED_CURRENCIES } from '../../common/currencies';

function parseCurrencyList(value: unknown): string[] | undefined {
  if (value == null || value === '') return undefined;
  const parts = Array.isArray(value)
    ? value.flatMap((v) => String(v).split(','))
    : String(value).split(',');
  const cleaned = parts.map((s) => s.trim().toUpperCase()).filter(Boolean);
  return cleaned.length ? cleaned : undefined;
}

export class SummaryQueryDto {
  @IsDateString({}, { message: 'from must be an ISO date (YYYY-MM-DD)' })
  from: string;

  @IsDateString({}, { message: 'to must be an ISO date (YYYY-MM-DD)' })
  to: string;

  /** Optional multi-currency filter. Omit / empty = all currencies. */
  @IsOptional()
  @Transform(({ value }) => parseCurrencyList(value))
  @IsArray()
  @ArrayUnique()
  @IsIn([...SUPPORTED_CURRENCIES], {
    each: true,
    message: 'each currency must be a supported ISO 4217 currency code',
  })
  currencies?: string[];

  /** Legacy single-currency filter (merged into currencies). */
  @IsOptional()
  @IsString()
  @Transform(({ value }) =>
    value == null || value === '' ? undefined : String(value).trim().toUpperCase(),
  )
  @IsIn([...SUPPORTED_CURRENCIES], {
    message: 'currency must be a supported ISO 4217 currency code',
  })
  currency?: string;
}
