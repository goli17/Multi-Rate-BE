import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { DiscountType } from '../../calculations/types';
import { Document } from './document.entity';

@Entity('line_items')
export class LineItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  description: string;

  @Column({ type: 'int' })
  quantity: number;

  @Column({ type: 'int' })
  unitPriceCents: number;

  @Column({ type: 'enum', enum: DiscountType, default: DiscountType.None })
  discountType: DiscountType;

  @Column({ type: 'float', default: 0 })
  discountValue: number;

  @Column({ type: 'float', default: 0 })
  taxPercent: number;

  @Column({ type: 'int', default: 0 })
  subtotalCents: number;

  @Column({ type: 'int', default: 0 })
  discountAmountCents: number;

  @Column({ type: 'int', default: 0 })
  taxAmountCents: number;

  @Column({ type: 'int', default: 0 })
  lineTotalCents: number;

  @Column()
  documentId: string;

  @ManyToOne(() => Document, (document) => document.lineItems, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'documentId' })
  document: Document;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
