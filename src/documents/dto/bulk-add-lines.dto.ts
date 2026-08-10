import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsArray, ValidateNested } from 'class-validator';
import { CreateLineItemDto } from './create-document.dto';

export class BulkAddLinesDto {
  @IsArray()
  @ArrayMinSize(1, { message: 'Import at least one line item' })
  @ArrayMaxSize(500, { message: 'Import at most 500 line items at once' })
  @ValidateNested({ each: true })
  @Type(() => CreateLineItemDto)
  lines: CreateLineItemDto[];
}
