import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, FindOptionsWhere, In, Repository } from 'typeorm';
import { centsToDollars } from '../calculations/money';
import { rethrowHttpOrWrap } from '../common/errors';
import { DocumentStatus } from '../documents/entities/document-status';
import { Document } from '../documents/entities/document.entity';

export type SummaryReportDocument = {
  id: string;
  title: string;
  customer: string;
  issueDate: string;
  currency: string;
  status: string;
  grandTotal: number;
  totalTax: number;
  totalDiscount: number;
};

export type CurrencyTotals = {
  currency: string;
  documentCount: number;
  sumGrandTotals: number;
  sumTotalTax: number;
  sumTotalDiscount: number;
};

export type SummaryReport = {
  from: string;
  to: string;
  /** Currencies requested in the filter; empty means all currencies. */
  currencies: string[];
  documentCount: number;
  totalsByCurrency: CurrencyTotals[];
  documents: SummaryReportDocument[];
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
    currencies: string[] = [],
  ): Promise<SummaryReport> {
    try {
      if (from > to) {
        throw new BadRequestException(
          '`from` must be on or before `to`. Swap the dates and try again.',
        );
      }

      const currencyFilter = [...new Set(currencies.map((c) => c.toUpperCase()))];

      const where: FindOptionsWhere<Document> = {
        userId,
        status: DocumentStatus.Finalized,
        issueDate: Between(from, to),
      };

      if (currencyFilter.length === 1) {
        where.currency = currencyFilter[0];
      } else if (currencyFilter.length > 1) {
        where.currency = In(currencyFilter);
      }

      const docs = await this.documentsRepo.find({
        where,
        order: {
          issueDate: 'ASC',
          title: 'ASC',
        },
      });

      const byCurrency = new Map<
        string,
        {
          documentCount: number;
          sumGrandTotalCents: number;
          sumTotalTaxCents: number;
          sumTotalDiscountCents: number;
        }
      >();

      for (const d of docs) {
        const key = d.currency;
        const bucket = byCurrency.get(key) ?? {
          documentCount: 0,
          sumGrandTotalCents: 0,
          sumTotalTaxCents: 0,
          sumTotalDiscountCents: 0,
        };
        bucket.documentCount += 1;
        bucket.sumGrandTotalCents += d.grandTotalCents;
        bucket.sumTotalTaxCents += d.totalTaxCents;
        bucket.sumTotalDiscountCents += d.totalDiscountCents;
        byCurrency.set(key, bucket);
      }

      const totalsByCurrency: CurrencyTotals[] = [...byCurrency.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([currency, bucket]) => ({
          currency,
          documentCount: bucket.documentCount,
          sumGrandTotals: centsToDollars(bucket.sumGrandTotalCents),
          sumTotalTax: centsToDollars(bucket.sumTotalTaxCents),
          sumTotalDiscount: centsToDollars(bucket.sumTotalDiscountCents),
        }));

      this.logger.log(
        `Summary user=${userId} from=${from} to=${to} currencies=${currencyFilter.length ? currencyFilter.join(',') : 'ALL'} finalized=${docs.length}`,
      );

      return {
        from,
        to,
        currencies: currencyFilter,
        documentCount: docs.length,
        totalsByCurrency,
        documents: docs.map((d) => ({
          id: d.id,
          title: d.title,
          customer: d.customer,
          issueDate: d.issueDate,
          currency: d.currency,
          status: d.status,
          grandTotal: centsToDollars(d.grandTotalCents),
          totalTax: centsToDollars(d.totalTaxCents),
          totalDiscount: centsToDollars(d.totalDiscountCents),
        })),
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
