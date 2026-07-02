import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { MailService } from '../common/services/mail.service';
import { ConfigService } from '@nestjs/config';

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: MailService,
          useValue: {
            sendOtpEmail: jest.fn().mockResolvedValue({ ok: true, message: 'sent' }),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  it('creates a session after verifying the correct otp', async () => {
    const result = await service.requestOtp('user@example.com');
    expect(result.ok).toBe(true);

    const otp = result.debugCode;
    expect(otp).toBeDefined();

    const session = await service.verifyOtp('user@example.com', otp as string);
    expect(session.ok).toBe(true);
    expect(session.userId).toBeDefined();
    expect(session.sessionToken).toBeDefined();
  });
});
