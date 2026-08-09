import {
  HttpException,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';

export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  return 'Unexpected error';
}

export function rethrowHttpOrWrap(
  error: unknown,
  logger: Logger,
  context: string,
  fallbackMessage: string,
): never {
  if (error instanceof HttpException) {
    throw error;
  }
  logger.error(`${context}: ${getErrorMessage(error)}`, error instanceof Error ? error.stack : undefined);
  throw new InternalServerErrorException(fallbackMessage);
}
