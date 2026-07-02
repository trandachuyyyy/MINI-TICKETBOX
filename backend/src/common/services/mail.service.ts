import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

@Injectable()
export class MailService {
  private readonly logger = new Logger('MailService');
  private transporter: nodemailer.Transporter | null = null;

  constructor(private readonly configService: ConfigService) {
    this.initializeTransporter();
  }

  private initializeTransporter() {
    const host = this.configService.get<string>('SMTP_HOST');
    const port = Number(this.configService.get<string>('SMTP_PORT') || '587');
    const user = this.configService.get<string>('SMTP_USER');
    const pass = this.configService.get<string>('SMTP_PASS');
    const from = this.configService.get<string>('SMTP_FROM') || 'ticketbox@example.com';

    if (!host || !user || !pass) {
      this.logger.warn('SMTP is not configured. Payment confirmation emails will be skipped.');
      return;
    }

    this.transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: { user, pass },
      logger: false,
      debug: false,
    });

    this.transporter.verify().catch((error) => {
      this.logger.warn(`SMTP verification failed: ${error.message}`);
    });

    this.transporter.options.from = from;
  }

  async testConnection() {
    if (!this.transporter) {
      return { ok: false, message: 'SMTP is not configured' };
    }

    try {
      await this.transporter.verify();
      return { ok: true, message: 'SMTP connection is working' };
    } catch (error: any) {
      return { ok: false, message: error.message || 'SMTP verification failed' };
    }
  }

  async sendOtpEmail(to: string, otp: string) {
    if (!this.transporter) {
      this.logger.warn('SMTP is not configured; skipped sending OTP email.');
      return { ok: false, message: 'SMTP is not configured' };
    }

    try {
      await this.transporter.sendMail({
        from: this.configService.get<string>('SMTP_FROM') || 'ticketbox@example.com',
        to,
        subject: 'Mã OTP đăng nhập - NOVA NIGHT',
        html: `<div style="font-family: Arial, sans-serif; line-height: 1.6;"><h2>OTP đăng nhập</h2><p>Mã OTP của bạn là <strong>${otp}</strong>.</p><p>Hiệu lực trong 5 phút.</p></div>`,
      });
      return { ok: true, message: `OTP email sent to ${to}` };
    } catch (error: any) {
      return { ok: false, message: error.message || 'Failed to send OTP email' };
    }
  }

  async sendPaymentSuccessEmail(to: string, reservationId: string, customerName: string) {
    if (!this.transporter) {
      this.logger.warn('SMTP is not configured; skipped sending payment email.');
      return { ok: false, message: 'SMTP is not configured' };
    }

    const subject = 'Thanh toán vé thành công - NOVA NIGHT';
    const html = `
      <div style="font-family: Arial, sans-serif; line-height: 1.6;">
        <h2>Thanh toán thành công</h2>
        <p>Xin chào <strong>${customerName}</strong>,</p>
        <p>Đơn vé của bạn đã được xác nhận thành công.</p>
        <p><strong>Mã đơn:</strong> ${reservationId}</p>
        <p>Cảm ơn bạn đã tham gia Concert NOVA NIGHT.</p>
      </div>
    `;

    try {
      await this.transporter.sendMail({
        from: this.configService.get<string>('SMTP_FROM') || 'ticketbox@example.com',
        to,
        subject,
        html,
      });
      this.logger.log(`Payment success email sent to ${to}`);
      return { ok: true, message: `Email sent to ${to}` };
    } catch (error: any) {
      this.logger.warn(`Failed to send payment success email: ${error.message}`);
      return { ok: false, message: error.message || 'Failed to send email' };
    }
  }
}
