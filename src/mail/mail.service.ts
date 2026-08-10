import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import type { SentMessageInfo, Transporter } from 'nodemailer';
import { getErrorMessage, rethrowHttpOrWrap } from '../common/errors';

type EmailProvider = 'brevo' | 'smtp' | 'none';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private transporter: Transporter | null = null;
  private provider: EmailProvider = 'none';
  private brevoApiKey: string | null = null;

  constructor(private readonly config: ConfigService) {
    try {
      const skip = config.get<string>('OTP_SKIP_SEND') === 'true';
      if (skip) {
        this.logger.warn('OTP_SKIP_SEND=true — emails will not be sent');
        return;
      }

      const preferred = (config.get<string>('EMAIL_PROVIDER') ?? '')
        .trim()
        .toLowerCase();
      const apiKey = config.get<string>('BREVO_API_KEY')?.trim();

      // Prefer Brevo HTTPS API — Render and many hosts block outbound SMTP.
      if (preferred === 'brevo' || (apiKey && preferred !== 'smtp')) {
        if (!apiKey) {
          this.logger.warn(
            'EMAIL_PROVIDER=brevo but BREVO_API_KEY is missing. OTP emails will fail.',
          );
          return;
        }
        this.brevoApiKey = apiKey;
        this.provider = 'brevo';
        this.logger.log('Brevo HTTPS API ready (recommended on Render)');
        return;
      }

      const host = config.get<string>('SMTP_HOST');
      const port = Number(config.get<string>('SMTP_PORT') ?? 587);
      const user = config.get<string>('SMTP_USER');
      const pass = config.get<string>('SMTP_PASSWORD');
      if (!host || !user || !pass) {
        this.logger.warn(
          'Email is not fully configured. Set BREVO_API_KEY (preferred) or SMTP_* vars.',
        );
        return;
      }
      this.transporter = nodemailer.createTransport({
        host,
        port,
        secure: port === 465,
        connectionTimeout: 15_000,
        greetingTimeout: 15_000,
        socketTimeout: 20_000,
        auth: { user, pass },
      });
      this.provider = 'smtp';
      this.logger.log(`SMTP transporter ready (${host}:${port})`);
    } catch (error: unknown) {
      this.logger.error(
        `Failed to initialize email: ${getErrorMessage(error)}`,
        error instanceof Error ? error.stack : undefined,
      );
      this.transporter = null;
      this.provider = 'none';
    }
  }

  async sendOtp(to: string, code: string): Promise<void> {
    try {
      if (this.config.get<string>('OTP_SKIP_SEND') === 'true') {
        this.logger.log(`OTP_SKIP_SEND: code for ${to} is ${code}`);
        return;
      }

      const subject = 'Your Multi-Rate verification code';
      const text = `Your verification code is ${code}. It expires in 10 minutes.`;
      const html = `<p>Your verification code is <strong>${code}</strong>.</p><p>It expires in 10 minutes.</p>`;

      if (this.provider === 'brevo' && this.brevoApiKey) {
        await this.sendViaBrevoApi(to, subject, text, html);
        return;
      }

      if (!this.transporter) {
        throw new ServiceUnavailableException(
          'Email is not configured. Set BREVO_API_KEY and EMAIL_FROM (recommended on Render), or SMTP_* credentials.',
        );
      }

      const from =
        this.config.get<string>('EMAIL_FROM') ??
        this.config.get<string>('SMTP_USER');
      if (!from) {
        throw new ServiceUnavailableException(
          'EMAIL_FROM is missing. Set a verified sender address.',
        );
      }

      const info: SentMessageInfo = await this.transporter.sendMail({
        from,
        to,
        subject,
        text,
        html,
      });
      this.logger.log(
        `OTP email sent to ${to} via SMTP (messageId=${String(info.messageId)})`,
      );
    } catch (error: unknown) {
      this.mapSendError(error);
    }
  }

  private async sendViaBrevoApi(
    to: string,
    subject: string,
    text: string,
    html: string,
  ): Promise<void> {
    const fromRaw =
      this.config.get<string>('EMAIL_FROM') ??
      this.config.get<string>('SMTP_USER');
    if (!fromRaw) {
      throw new ServiceUnavailableException(
        'EMAIL_FROM is missing. Set a verified sender address in Brevo.',
      );
    }
    const sender = parseSender(fromRaw);

    const res = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
        'api-key': this.brevoApiKey!,
      },
      body: JSON.stringify({
        sender,
        to: [{ email: to }],
        subject,
        textContent: text,
        htmlContent: html,
      }),
    });

    const bodyText = await res.text();
    let payload: { messageId?: string; message?: string } = {};
    try {
      payload = bodyText ? (JSON.parse(bodyText) as typeof payload) : {};
    } catch {
      payload = { message: bodyText };
    }

    if (!res.ok) {
      const detail = payload.message || bodyText || res.statusText;
      throw new ServiceUnavailableException(
        `Brevo API error (${res.status}): ${detail}`,
      );
    }

    this.logger.log(
      `OTP email sent to ${to} via Brevo API (messageId=${payload.messageId ?? 'n/a'})`,
    );
  }

  private mapSendError(error: unknown): never {
    const detail = getErrorMessage(error);
    if (
      detail.includes('timeout') ||
      detail.includes('ETIMEDOUT') ||
      detail.includes('ECONNREFUSED') ||
      detail.includes('Connection timeout')
    ) {
      this.logger.error(detail);
      throw new ServiceUnavailableException(
        'SMTP connection timed out (common on Render). Set EMAIL_PROVIDER=brevo and BREVO_API_KEY to send over HTTPS instead.',
      );
    }
    if (detail.includes('SMTP account is not yet activated')) {
      this.logger.error(detail);
      throw new ServiceUnavailableException(
        'Brevo SMTP is not activated on this account. Prefer BREVO_API_KEY, or activate SMTP in Brevo (Settings → SMTP & API).',
      );
    }
    if (detail.includes('Unauthorized IP') || detail.includes('525')) {
      this.logger.error(detail);
      throw new ServiceUnavailableException(
        'Brevo blocked this IP for SMTP. Prefer BREVO_API_KEY, or authorize the host IP in Brevo SMTP settings.',
      );
    }
    if (detail.includes('Invalid login') || detail.includes('535')) {
      this.logger.error(detail);
      throw new ServiceUnavailableException(
        'Brevo SMTP login failed. Check SMTP_USER and SMTP_PASSWORD, or switch to BREVO_API_KEY.',
      );
    }
    rethrowHttpOrWrap(
      error,
      this.logger,
      'sendOtp',
      'Failed to send verification email. Check Brevo API key / SMTP credentials and sender.',
    );
  }
}

function parseSender(from: string): { name?: string; email: string } {
  const match = from.match(/^\s*(.+?)\s*<([^>]+)>\s*$/);
  if (match) {
    return { name: match[1].replace(/^["']|["']$/g, ''), email: match[2].trim() };
  }
  return { email: from.trim() };
}
