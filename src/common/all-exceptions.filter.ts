import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Response } from 'express';
import { getErrorMessage } from './errors';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const body = exception.getResponse();
      const message =
        typeof body === 'string'
          ? body
          : ((body as { message?: string | string[] }).message ??
            exception.message);

      if (status >= 500) {
        this.logger.error(`HTTP ${status}: ${getErrorMessage(exception)}`);
      } else {
        this.logger.warn(`HTTP ${status}: ${String(message)}`);
      }

      response.status(status).json({
        statusCode: status,
        error: exception.name.replace('Exception', '') || 'Error',
        message,
      });
      return;
    }

    this.logger.error(
      `Unhandled error: ${getErrorMessage(exception)}`,
      exception instanceof Error ? exception.stack : undefined,
    );
    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      error: 'InternalServerError',
      message: 'Unexpected server error',
    });
  }
}
