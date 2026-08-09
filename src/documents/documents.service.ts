import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import {
  CalculationError,
  computeDocumentTotals,
  computeLineBreakdown,
} from '../calculations/calculate';
import type { LineBreakdown } from '../calculations/types';
import { DiscountType, LineInput } from '../calculations/types';
import { dollarsToCents } from '../calculations/money';
import { rethrowHttpOrWrap } from '../common/errors';
import { CreateDocumentDto, CreateLineItemDto } from './dto/create-document.dto';
import { UpdateDocumentDto } from './dto/update-document.dto';
import { UpdateLineItemDto } from './dto/update-line-item.dto';
import { mapDocument, mapDocumentSummary } from './document.mapper';
import { DocumentStatus } from './entities/document-status';
import { Document } from './entities/document.entity';
import { LineItem } from './entities/line-item.entity';
import { resolveDiscount } from './line-discount';

@Injectable()
export class DocumentsService {
  private readonly logger = new Logger(DocumentsService.name);

  constructor(
    @InjectRepository(Document)
    private readonly documentsRepo: Repository<Document>,
    @InjectRepository(LineItem)
    private readonly linesRepo: Repository<LineItem>,
    private readonly dataSource: DataSource,
  ) {}

  async create(userId: string, dto: CreateDocumentDto) {
    try {
      this.logger.log(`Create document for user=${userId}`);
      const doc = this.documentsRepo.create({
        title: dto.title,
        customer: dto.customer,
        issueDate: dto.issueDate,
        currency: dto.currency ?? 'USD',
        status: DocumentStatus.Draft,
        userId,
        lineItems: (dto.lineItems ?? []).map((line) =>
          this.buildLineEntity(line),
        ),
      });
      this.applyTotals(doc);
      const saved = await this.documentsRepo.save(doc);
      return mapDocument(await this.requireOwned(saved.id, userId));
    } catch (error: unknown) {
      rethrowHttpOrWrap(
        error,
        this.logger,
        'create',
        'Could not create document. Please try again.',
      );
    }
  }

  async findAll(userId: string) {
    try {
      const docs = await this.documentsRepo.find({
        where: { userId },
        order: { issueDate: 'DESC', createdAt: 'DESC' },
      });
      return docs.map(mapDocumentSummary);
    } catch (error: unknown) {
      rethrowHttpOrWrap(
        error,
        this.logger,
        'findAll',
        'Could not load documents.',
      );
    }
  }

  async findOne(userId: string, id: string) {
    try {
      return mapDocument(await this.requireOwned(id, userId));
    } catch (error: unknown) {
      rethrowHttpOrWrap(
        error,
        this.logger,
        'findOne',
        'Could not load document.',
      );
    }
  }

  async update(userId: string, id: string, dto: UpdateDocumentDto) {
    try {
      const doc = await this.requireOwned(id, userId);
      this.assertDraft(doc);

      if (dto.title !== undefined) doc.title = dto.title;
      if (dto.customer !== undefined) doc.customer = dto.customer;
      if (dto.issueDate !== undefined) doc.issueDate = dto.issueDate;
      if (dto.currency !== undefined) doc.currency = dto.currency;

      if (dto.lineItems !== undefined) {
        await this.linesRepo.delete({ documentId: doc.id });
        doc.lineItems = dto.lineItems.map((line) => this.buildLineEntity(line));
      }

      this.applyTotals(doc);
      await this.documentsRepo.save(doc);
      this.logger.log(`Updated document=${id}`);
      return mapDocument(await this.requireOwned(id, userId));
    } catch (error: unknown) {
      rethrowHttpOrWrap(
        error,
        this.logger,
        'update',
        'Could not update document.',
      );
    }
  }

  async remove(userId: string, id: string) {
    try {
      const doc = await this.requireOwned(id, userId);
      this.assertDraft(doc);
      await this.documentsRepo.remove(doc);
      this.logger.log(`Deleted document=${id}`);
      return { deleted: true as const };
    } catch (error: unknown) {
      rethrowHttpOrWrap(
        error,
        this.logger,
        'remove',
        'Could not delete document.',
      );
    }
  }

  async addLine(userId: string, documentId: string, dto: CreateLineItemDto) {
    try {
      const doc = await this.requireOwned(documentId, userId);
      this.assertDraft(doc);
      const line = this.buildLineEntity(dto);
      line.documentId = doc.id;
      doc.lineItems = [...(doc.lineItems ?? []), line];
      this.applyTotals(doc);
      await this.documentsRepo.save(doc);
      return mapDocument(await this.requireOwned(documentId, userId));
    } catch (error: unknown) {
      rethrowHttpOrWrap(
        error,
        this.logger,
        'addLine',
        'Could not add line item.',
      );
    }
  }

  async updateLine(
    userId: string,
    documentId: string,
    lineId: string,
    dto: UpdateLineItemDto,
  ) {
    try {
      const doc = await this.requireOwned(documentId, userId);
      this.assertDraft(doc);
      const line = doc.lineItems.find((l) => l.id === lineId);
      if (!line) {
        throw new NotFoundException('Line item not found on this document');
      }

      const merged: CreateLineItemDto = {
        description: dto.description ?? line.description,
        quantity: dto.quantity ?? line.quantity,
        unitPrice:
          dto.unitPrice ?? Number((line.unitPriceCents / 100).toFixed(2)),
        discountType: dto.discountType ?? line.discountType,
        discountPercent:
          dto.discountPercent ??
          (line.discountType === DiscountType.Percent
            ? line.discountValue
            : undefined),
        discountFixed:
          dto.discountFixed ??
          (line.discountType === DiscountType.Fixed
            ? Number((line.discountValue / 100).toFixed(2))
            : undefined),
        taxPercent: dto.taxPercent ?? line.taxPercent,
      };

      if (dto.discountType === DiscountType.None) {
        merged.discountPercent = undefined;
        merged.discountFixed = undefined;
      }

      Object.assign(line, this.buildLineEntity(merged));
      line.id = lineId;
      line.documentId = documentId;
      this.applyTotals(doc);
      await this.documentsRepo.save(doc);
      return mapDocument(await this.requireOwned(documentId, userId));
    } catch (error: unknown) {
      rethrowHttpOrWrap(
        error,
        this.logger,
        'updateLine',
        'Could not update line item.',
      );
    }
  }

  async removeLine(userId: string, documentId: string, lineId: string) {
    try {
      const doc = await this.requireOwned(documentId, userId);
      this.assertDraft(doc);
      const line = doc.lineItems.find((l) => l.id === lineId);
      if (!line) {
        throw new NotFoundException('Line item not found on this document');
      }
      await this.linesRepo.delete({ id: lineId, documentId });
      doc.lineItems = doc.lineItems.filter((l) => l.id !== lineId);
      this.applyTotals(doc);
      await this.documentsRepo.save(doc);
      return mapDocument(await this.requireOwned(documentId, userId));
    } catch (error: unknown) {
      rethrowHttpOrWrap(
        error,
        this.logger,
        'removeLine',
        'Could not remove line item.',
      );
    }
  }

  async finalize(userId: string, id: string) {
    try {
      return await this.dataSource.transaction(async (manager) => {
        const doc = await manager.findOne(Document, {
          where: { id, userId },
          relations: ['lineItems'],
        });
        if (!doc) {
          throw new NotFoundException('Document not found');
        }
        if (doc.status === DocumentStatus.Finalized) {
          throw new ConflictException(
            'This document is already finalized and read-only.',
          );
        }
        if (!doc.lineItems?.length) {
          throw new BadRequestException(
            'Cannot finalize a document with no line items. Add at least one line first.',
          );
        }
        for (const line of doc.lineItems) {
          if (line.quantity < 1 || line.unitPriceCents < 0) {
            throw new BadRequestException(
              'Cannot finalize: every line must have quantity >= 1 and unit price >= 0',
            );
          }
        }
        this.applyTotals(doc);
        doc.status = DocumentStatus.Finalized;
        const saved = await manager.save(doc);
        this.logger.log(`Finalized document=${id}`);
        return mapDocument(saved);
      });
    } catch (error: unknown) {
      rethrowHttpOrWrap(
        error,
        this.logger,
        'finalize',
        'Could not finalize document.',
      );
    }
  }

  private buildLineEntity(dto: CreateLineItemDto): LineItem {
    const { discountType, discountValue } = resolveDiscount(dto);
    const input: LineInput = {
      quantity: dto.quantity,
      unitPriceCents: dollarsToCents(dto.unitPrice),
      discountType,
      discountValue,
      taxPercent: dto.taxPercent ?? 0,
    };
    let breakdown: LineBreakdown;
    try {
      breakdown = computeLineBreakdown(input);
    } catch (err: unknown) {
      if (err instanceof CalculationError) {
        throw new BadRequestException(err.message);
      }
      throw err;
    }
    return this.linesRepo.create({
      description: dto.description,
      quantity: input.quantity,
      unitPriceCents: input.unitPriceCents,
      discountType,
      discountValue,
      taxPercent: input.taxPercent,
      subtotalCents: breakdown.subtotalCents,
      discountAmountCents: breakdown.discountAmountCents,
      taxAmountCents: breakdown.taxAmountCents,
      lineTotalCents: breakdown.lineTotalCents,
    });
  }

  private applyTotals(doc: Document): void {
    const inputs: LineInput[] = (doc.lineItems ?? []).map((line) => ({
      quantity: line.quantity,
      unitPriceCents: line.unitPriceCents,
      discountType: line.discountType,
      discountValue: line.discountValue,
      taxPercent: line.taxPercent,
    }));
    try {
      const totals = computeDocumentTotals(inputs);
      doc.subtotalCents = totals.subtotalCents;
      doc.totalDiscountCents = totals.totalDiscountCents;
      doc.totalTaxCents = totals.totalTaxCents;
      doc.grandTotalCents = totals.grandTotalCents;
      totals.lines.forEach((breakdown, index) => {
        const line = doc.lineItems[index];
        line.subtotalCents = breakdown.subtotalCents;
        line.discountAmountCents = breakdown.discountAmountCents;
        line.taxAmountCents = breakdown.taxAmountCents;
        line.lineTotalCents = breakdown.lineTotalCents;
      });
    } catch (err: unknown) {
      if (err instanceof CalculationError) {
        throw new BadRequestException(err.message);
      }
      throw err;
    }
  }

  private assertDraft(doc: Document): void {
    if (doc.status === DocumentStatus.Finalized) {
      throw new ConflictException(
        'This document is finalized and read-only. Duplicate it into a new draft to make changes (if enabled), or create a new document.',
      );
    }
  }

  private async requireOwned(id: string, userId: string): Promise<Document> {
    const doc = await this.documentsRepo.findOne({
      where: { id, userId },
      relations: ['lineItems'],
    });
    if (!doc) {
      throw new NotFoundException('Document not found');
    }
    return doc;
  }
}
