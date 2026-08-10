import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from './auth/auth.module';
import { DocumentsModule } from './documents/documents.module';
import { Document } from './documents/entities/document.entity';
import { LineItem } from './documents/entities/line-item.entity';
import { HealthController } from './health/health.controller';
import { ReportsModule } from './reports/reports.module';
import { User } from './users/entities/user.entity';
import { UsersModule } from './users/users.module';

/**
 * Neon/pg warn when sslmode=require is in the URL (treated as verify-full today).
 * We strip sslmode and configure TLS via TypeORM `ssl` instead.
 */
function postgresConnection(url: string, forceSsl: boolean) {
  const parsed = new URL(url);
  const sslMode = (parsed.searchParams.get('sslmode') ?? '').toLowerCase();
  const needsSsl =
    forceSsl ||
    sslMode === 'require' ||
    sslMode === 'verify-full' ||
    sslMode === 'verify-ca' ||
    sslMode === 'prefer' ||
    parsed.hostname.includes('neon.tech');

  parsed.searchParams.delete('sslmode');

  return {
    type: 'postgres' as const,
    url: parsed.toString(),
    ssl: needsSsl ? { rejectUnauthorized: false } : false,
    // Avoid overlapping queries on one client (pg@9 deprecation) during sync/pool use
    extra: {
      max: 10,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 15_000,
    },
  };
}

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const url = config.getOrThrow<string>('DATABASE_URL');
        const forceSsl = config.get<string>('DATABASE_SSL') === 'true';
        return {
          ...postgresConnection(url, forceSsl),
          entities: [User, Document, LineItem],
          synchronize: config.get<string>('NODE_ENV') !== 'production',
        };
      },
    }),
    UsersModule,
    AuthModule,
    DocumentsModule,
    ReportsModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
