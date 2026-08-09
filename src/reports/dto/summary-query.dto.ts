import { IsDateString } from 'class-validator';

export class SummaryQueryDto {
  @IsDateString({}, { message: 'from must be an ISO date (YYYY-MM-DD)' })
  from: string;

  @IsDateString({}, { message: 'to must be an ISO date (YYYY-MM-DD)' })
  to: string;
}
