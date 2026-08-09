import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { randomInt } from 'crypto';
import { rethrowHttpOrWrap } from '../common/errors';
import { MailService } from '../mail/mail.service';
import { User } from '../users/entities/user.entity';
import { UsersService } from '../users/users.service';
import {
  AuthTokenResponse,
  SignupResponse,
  VerificationPendingResponse,
} from './auth.types';
import { LoginDto } from './dto/login.dto';
import { ResendOtpDto } from './dto/resend-otp.dto';
import { SignupDto } from './dto/signup.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';

const OTP_TTL_MS = 10 * 60 * 1000;

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly mailService: MailService,
    private readonly config: ConfigService,
  ) {}

  private get skipEmailVerification(): boolean {
    return this.config.get<string>('SKIP_EMAIL_VERIFICATION') === 'true';
  }

  async signup(dto: SignupDto): Promise<SignupResponse> {
    try {
      this.logger.log(`Signup requested for ${dto.email}`);
      const existing = await this.usersService.findByEmail(dto.email);
      if (existing?.emailVerified) {
        throw new ConflictException(
          'An account with this email already exists. Log in or use a different email.',
        );
      }

      let user = existing;
      if (!user) {
        user = await this.usersService.create(dto.email, dto.password);
      } else {
        user.passwordHash = await bcrypt.hash(dto.password, 10);
        await this.usersService.save(user);
      }

      if (this.skipEmailVerification) {
        user.emailVerified = true;
        user.otpHash = null;
        user.otpExpiresAt = null;
        await this.usersService.save(user);
        this.logger.warn(
          `SKIP_EMAIL_VERIFICATION: auto-verified signup for ${user.email}`,
        );
        return this.tokenResponse(user.id, user.email);
      }

      await this.issueAndSendOtp(user);
      this.logger.log(`OTP issued for ${user.email}`);
      return {
        requiresVerification: true,
        email: user.email,
        message: 'Check your email for a 6-digit verification code.',
      };
    } catch (error: unknown) {
      rethrowHttpOrWrap(
        error,
        this.logger,
        'signup',
        'Signup failed. Please try again.',
      );
    }
  }

  async verifyOtp(dto: VerifyOtpDto): Promise<AuthTokenResponse> {
    try {
      this.logger.log(`OTP verify attempted for ${dto.email}`);
      const user = await this.usersService.findByEmail(dto.email);
      if (!user || !user.otpHash || !user.otpExpiresAt) {
        throw new BadRequestException(
          'No pending verification for this email. Sign up or request a new code.',
        );
      }
      if (user.otpExpiresAt.getTime() < Date.now()) {
        throw new BadRequestException(
          'Verification code expired. Request a new code.',
        );
      }
      const ok = await bcrypt.compare(dto.code, user.otpHash);
      if (!ok) {
        this.logger.warn(`Invalid OTP for ${dto.email}`);
        throw new UnauthorizedException('Invalid verification code');
      }

      user.emailVerified = true;
      user.otpHash = null;
      user.otpExpiresAt = null;
      await this.usersService.save(user);
      this.logger.log(`Email verified for ${user.email}`);
      return this.tokenResponse(user.id, user.email);
    } catch (error: unknown) {
      rethrowHttpOrWrap(
        error,
        this.logger,
        'verifyOtp',
        'OTP verification failed. Please try again.',
      );
    }
  }

  async resendOtp(dto: ResendOtpDto): Promise<VerificationPendingResponse> {
    try {
      this.logger.log(`OTP resend requested for ${dto.email}`);
      if (this.skipEmailVerification) {
        throw new BadRequestException(
          'Email verification is disabled. Sign up or log in with email and password.',
        );
      }
      const user = await this.usersService.findByEmail(dto.email);
      if (!user) {
        throw new BadRequestException('No account found for this email');
      }
      if (user.emailVerified) {
        throw new BadRequestException(
          'Email is already verified. Please log in.',
        );
      }
      await this.issueAndSendOtp(user);
      return {
        requiresVerification: true,
        email: user.email,
        message: 'A new verification code was sent to your email.',
      };
    } catch (error: unknown) {
      rethrowHttpOrWrap(
        error,
        this.logger,
        'resendOtp',
        'Could not resend verification code. Please try again.',
      );
    }
  }

  async login(dto: LoginDto): Promise<AuthTokenResponse> {
    try {
      this.logger.log(`Login attempted for ${dto.email}`);
      const user = await this.usersService.findByEmail(dto.email);
      if (
        !user ||
        !(await this.usersService.validatePassword(user, dto.password))
      ) {
        throw new UnauthorizedException('Invalid email or password');
      }

      if (!user.emailVerified) {
        if (this.skipEmailVerification) {
          user.emailVerified = true;
          user.otpHash = null;
          user.otpExpiresAt = null;
          await this.usersService.save(user);
          this.logger.warn(
            `SKIP_EMAIL_VERIFICATION: auto-verified login for ${user.email}`,
          );
        } else {
          throw new UnauthorizedException(
            'Email not verified. Check your inbox for the code, or request a new one.',
          );
        }
      }

      this.logger.log(`Login success for ${user.email}`);
      return this.tokenResponse(user.id, user.email);
    } catch (error: unknown) {
      rethrowHttpOrWrap(
        error,
        this.logger,
        'login',
        'Login failed. Please try again.',
      );
    }
  }

  private async issueAndSendOtp(user: User): Promise<void> {
    try {
      const fixed = this.config.get<string>('OTP_FIXED_CODE');
      const code = fixed ?? String(randomInt(100000, 1000000));
      user.otpHash = await bcrypt.hash(code, 10);
      user.otpExpiresAt = new Date(Date.now() + OTP_TTL_MS);
      await this.usersService.save(user);
      await this.mailService.sendOtp(user.email, code);
    } catch (error: unknown) {
      rethrowHttpOrWrap(
        error,
        this.logger,
        'issueAndSendOtp',
        'Could not send verification email. Check SMTP settings and try again.',
      );
    }
  }

  private tokenResponse(userId: string, email: string): AuthTokenResponse {
    const accessToken = this.jwtService.sign({ sub: userId, email });
    return {
      accessToken,
      user: { id: userId, email },
      requiresVerification: false,
    };
  }
}
