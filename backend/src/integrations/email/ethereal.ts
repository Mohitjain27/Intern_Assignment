import nodemailer, { Transporter } from 'nodemailer';
import { env } from '../../config/env';

export interface EmailPayload {
  from: string;
  fromName: string;
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export interface SendResult {
  messageId: string;
  previewUrl?: string;
}

export interface EmailProvider {
  send(payload: EmailPayload): Promise<SendResult>;
}

export class EtherealEmailProvider implements EmailProvider {
  private transporter: Transporter;

  constructor() {
    this.transporter = nodemailer.createTransport({
      host: env.ethereal.host,
      port: env.ethereal.port,
      secure: false, // TLS via STARTTLS
      auth: {
        user: env.ethereal.user,
        pass: env.ethereal.password,
      },
      tls: {
        rejectUnauthorized: false,
      },
    });
  }

  async send(payload: EmailPayload): Promise<SendResult> {
    const info = await this.transporter.sendMail({
      from: `"${payload.fromName}" <${payload.from}>`,
      to: payload.to,
      subject: payload.subject,
      html: payload.html,
      text: payload.text || this.htmlToText(payload.html),
    });

    const previewUrl = nodemailer.getTestMessageUrl(info) || undefined;

    return {
      messageId: info.messageId,
      previewUrl: typeof previewUrl === 'string' ? previewUrl : undefined,
    };
  }

  private htmlToText(html: string): string {
    return html
      .replace(/<[^>]*>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/\s+/g, ' ')
      .trim();
  }

  async verify(): Promise<boolean> {
    try {
      await this.transporter.verify();
      return true;
    } catch {
      return false;
    }
  }
}

// Create test account dynamically if no credentials configured
export async function createTestAccount(): Promise<{ user: string; pass: string }> {
  const account = await nodemailer.createTestAccount();
  return { user: account.user, pass: account.pass };
}

// Singleton provider
let provider: EmailProvider | null = null;

export function getEmailProvider(): EmailProvider {
  if (!provider) {
    provider = new EtherealEmailProvider();
  }
  return provider;
}
