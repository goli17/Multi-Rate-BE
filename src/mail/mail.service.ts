import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import type { SentMessageInfo, Transporter } from 'nodemailer';
import { getErrorMessage, rethrowHttpOrWrap } from '../common/errors';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private transporter: Transporter | null = null;

  constructor(private readonly config: ConfigService) {
    try {
      const skip = config.get<string>('OTP_SKIP_SEND') === 'true';
      if (skip) {
        this.logger.warn('OTP_SKIP_SEND=true — emails will not be sent');
        return;
      }
      const host = config.get<string>('SMTP_HOST');
      const port = Number(config.get<string>('SMTP_PORT') ?? 587);
      const user = config.get<string>('SMTP_USER');
      const pass = config.get<string>('SMTP_PASSWORD');
      if (!host || !user || !pass) {
        this.logger.warn(
          'SMTP is not fully configured. OTP emails will fail until SMTP_* is set.',
        );
        return;
      }
      this.transporter = nodemailer.createTransport({
        host,
        port,
        secure: port === 465,
        auth: { user, pass },
      });
      this.logger.log(`SMTP transporter ready (${host}:${port})`);
    } catch (error: unknown) {
      this.logger.error(
        `Failed to initialize SMTP: ${getErrorMessage(error)}`,
        error instanceof Error ? error.stack : undefined,
      );
      this.transporter = null;
    }
  }

  async sendOtp(to: string, code: string): Promise<void> {
    try {
      if (this.config.get<string>('OTP_SKIP_SEND') === 'true') {
        this.logger.log(`OTP_SKIP_SEND: code for ${to} is ${code}`);
        return;
      }
      if (!this.transporter) {
        throw new ServiceUnavailableException(
          'Email is not configured. Set SMTP_HOST, SMTP_USER, SMTP_PASSWORD, and EMAIL_FROM.',
        );
      }

      const from =
        this.config.get<string>('EMAIL_FROM') ??
        this.config.get<string>('SMTP_USER');
      if (!from) {
        throw new ServiceUnavailableException(
          'EMAIL_FROM is missing. Set a verified sender address in .env.',
        );
      }

      const info: SentMessageInfo = await this.transporter.sendMail({
        from,
        to,
        subject: 'Your Multi-Rate verification code',
        text: `Your verification code is ${code}. It expires in 10 minutes.`,
        html: `<p>Your verification code is <strong>${code}</strong>.</p><p>It expires in 10 minutes.</p>`,
      });
      this.logger.log(`OTP email sent to ${to} (messageId=${String(info.messageId)})`);
    } catch (error: unknown) {
      const detail = getErrorMessage(error);
      if (detail.includes('SMTP account is not yet activated')) {
        this.logger.error(detail);
        throw new ServiceUnavailableException(
          'Brevo SMTP is not activated on this account. Activate SMTP in Brevo (Settings → SMTP & API) or contact Brevo support, then try again.',
        );
      }
      if (detail.includes('Unauthorized IP') || detail.includes('525')) {
        this.logger.error(detail);
        throw new ServiceUnavailableException(
          'Brevo blocked this IP for SMTP. In Brevo → Settings → SMTP & API, authorize your current public IP (or disable IP restriction), then retry.',
        );
      }
      if (detail.includes('Invalid login') || detail.includes('535')) {
        this.logger.error(detail);
        throw new ServiceUnavailableException(
          'Brevo SMTP login failed. Check SMTP_USER and SMTP_PASSWORD in .env.',
        );
      }
      rethrowHttpOrWrap(
        error,
        this.logger,
        'sendOtp',
        'Failed to send verification email. Check Brevo SMTP credentials and sender.',
      );
    }
  }
}
