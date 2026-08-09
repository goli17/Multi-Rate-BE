import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { LineItem } from './line-item.entity';
import { DocumentStatus } from './document-status';

@Entity('documents')
export class Document {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  title: string;

  @Column()
  customer: string;

  @Column({ type: 'date' })
  issueDate: string;

  @Column({ type: 'enum', enum: DocumentStatus, default: DocumentStatus.Draft })
  status: DocumentStatus;

  @Column({ type: 'int', default: 0 })
  subtotalCents: number;

  @Column({ type: 'int', default: 0 })
  totalDiscountCents: number;

  @Column({ type: 'int', default: 0 })
  totalTaxCents: number;

  @Column({ type: 'int', default: 0 })
  grandTotalCents: number;

  @Column()
  userId: string;

  @ManyToOne(() => User, (user) => user.documents, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @OneToMany(() => LineItem, (line) => line.document, {
    cascade: true,
    eager: true,
  })
  lineItems: LineItem[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
