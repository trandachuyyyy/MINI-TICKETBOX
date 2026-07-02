import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MailService } from '../common/services/mail.service';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly otpStore = new Map<string, { code: string; expiresAt: number }>();
  private readonly sessionStore = new Map<string, { userId: string; email: string; expiresAt: number }>();

  constructor(
    private readonly mailService: MailService,
    private readonly configService: ConfigService,
  ) {}

  async requestOtp(email: string) {
    const code = this.generateCode();
    this.otpStore.set(email, { code, expiresAt: Date.now() + 5 * 60 * 1000 });

    const smtpConfigured = !!this.configService.get<string>('SMTP_HOST');
    if (smtpConfigured) {
      await this.mailService.sendOtpEmail(email, code);
    } else {
      this.logger.warn(`OTP requested for ${email} but SMTP is not configured. Code: ${code}`);
    }

    return { ok: true, message: 'OTP sent', debugCode: code };
  }

  async verifyOtp(email: string, code: string) {
    const entry = this.otpStore.get(email);
    if (!entry || entry.expiresAt < Date.now()) {
      return { ok: false, message: 'OTP expired or invalid' };
    }

    if (entry.code !== code) {
      return { ok: false, message: 'OTP invalid' };
    }

    this.otpStore.delete(email);

    const userId = `user-${Date.now()}`;
    const sessionToken = `sess-${Math.random().toString(36).slice(2, 10)}`;
    this.sessionStore.set(sessionToken, { userId, email, expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000 });

    return { ok: true, userId, sessionToken, message: 'Authenticated' };
  }

  getSession(sessionToken: string) {
    const session = this.sessionStore.get(sessionToken);
    if (!session || session.expiresAt < Date.now()) {
      return null;
    }
    return session;
  }

  private generateCode() {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }
}
