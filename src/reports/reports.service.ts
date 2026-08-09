import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, Repository } from 'typeorm';
import { centsToDollars } from '../calculations/money';
import { Document } from '../documents/entities/document.entity';

@Injectable()
export class ReportsService {
  constructor(
    @InjectRepository(Document)
    private readonly documentsRepo: Repository<Document>,
  ) {}

  async summary(userId: string, from: string, to: string) {
    if (from > to) {
      throw new BadRequestException(
        '`from` must be on or before `to`. Swap the dates and try again.',
      );
    }

    const docs = await this.documentsRepo.find({
      where: {
        userId,
        issueDate: Between(from, to),
      },
    });

    const documentCount = docs.length;
    const sumGrandTotalCents = docs.reduce((s, d) => s + d.grandTotalCents, 0);
    const sumTotalTaxCents = docs.reduce((s, d) => s + d.totalTaxCents, 0);
    const sumTotalDiscountCents = docs.reduce(
      (s, d) => s + d.totalDiscountCents,
      0,
    );

    return {
      from,
      to,
      documentCount,
      sumGrandTotals: centsToDollars(sumGrandTotalCents),
      sumTotalTax: centsToDollars(sumTotalTaxCents),
      sumTotalDiscount: centsToDollars(sumTotalDiscountCents),
    };
  }
}
