import { IsDateString, IsIn, IsOptional, IsString } from 'class-validator';
import { SUPPORTED_CURRENCIES } from '../../common/currencies';

export class SummaryQueryDto {
  @IsDateString({}, { message: 'from must be an ISO date (YYYY-MM-DD)' })
  from: string;

  @IsDateString({}, { message: 'to must be an ISO date (YYYY-MM-DD)' })
  to: string;

  @IsOptional()
  @IsString()
  @IsIn([...SUPPORTED_CURRENCIES], {
    message: 'currency must be a supported ISO 4217 currency code',
  })
  currency?: string;
}
