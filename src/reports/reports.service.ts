import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, Repository } from 'typeorm';
import { centsToDollars } from '../calculations/money';
import { rethrowHttpOrWrap } from '../common/errors';
import { Document } from '../documents/entities/document.entity';

export type SummaryReport = {
  from: string;
  to: string;
  currency: string;
  documentCount: number;
  sumGrandTotals: number;
  sumTotalTax: number;
  sumTotalDiscount: number;
};

@Injectable()
export class ReportsService {
  private readonly logger = new Logger(ReportsService.name);

  constructor(
    @InjectRepository(Document)
    private readonly documentsRepo: Repository<Document>,
  ) {}

  async summary(
    userId: string,
    from: string,
    to: string,
    currency = 'USD',
  ): Promise<SummaryReport> {
    try {
      if (from > to) {
        throw new BadRequestException(
          '`from` must be on or before `to`. Swap the dates and try again.',
        );
      }

      const docs = await this.documentsRepo.find({
        where: {
          userId,
          currency,
          issueDate: Between(from, to),
        },
      });

      const documentCount = docs.length;
      const sumGrandTotalCents = docs.reduce(
        (s, d) => s + d.grandTotalCents,
        0,
      );
      const sumTotalTaxCents = docs.reduce((s, d) => s + d.totalTaxCents, 0);
      const sumTotalDiscountCents = docs.reduce(
        (s, d) => s + d.totalDiscountCents,
        0,
      );

      this.logger.log(
        `Summary user=${userId} from=${from} to=${to} currency=${currency} count=${documentCount}`,
      );

      return {
        from,
        to,
        currency,
        documentCount,
        sumGrandTotals: centsToDollars(sumGrandTotalCents),
        sumTotalTax: centsToDollars(sumTotalTaxCents),
        sumTotalDiscount: centsToDollars(sumTotalDiscountCents),
      };
    } catch (error: unknown) {
      rethrowHttpOrWrap(
        error,
        this.logger,
        'summary',
        'Could not generate summary report.',
      );
    }
  }
}
