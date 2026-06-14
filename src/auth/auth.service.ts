import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { OwnerService } from '../owner/owner.service';
import { EmployeesService } from '../employees/employees.service';
import { MailService } from '../mail/mail.service';
import { generateOtp, getOtpExpiry } from '../common/utils/otp.util';
import { LoginDto } from './dto/login.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';

// Unified user shape for OTP operations
interface UserWithOtp {
  otp: string | null;
  otpExpiresAt: Date | null;
}

type UserSource = 'owner' | 'employee';

@Injectable()
export class AuthService {
  constructor(
    private readonly ownerService: OwnerService,
    private readonly employeesService: EmployeesService,
    private readonly jwtService: JwtService,
    private readonly mailService: MailService,
  ) {}

  // ─── Login ──────────────────────────────────────────────────────────────────
  async login(dto: LoginDto) {
    const invalidError = new UnauthorizedException('Invalid email or password');

    let user: any = await this.ownerService.findByEmail(dto.email);
    let userType: UserSource = 'owner';

    if (!user) {
      user = await this.employeesService.findByEmail(dto.email);
      userType = 'employee';
    }

    if (!user) throw invalidError;
    if (!user.isActive) throw new UnauthorizedException('Account is disabled');

    const passwordMatch = await bcrypt.compare(dto.password, user.password);
    if (!passwordMatch) throw invalidError;

    if (userType === 'employee') {
      await this.employeesService.updateLastLogin(user._id.toString());
    }

    const payload = {
      sub: user._id.toString(),
      email: user.email,
      role: user.role,
    };

    return {
      accessToken: this.jwtService.sign(payload),
      user: user.toJSON(),
    };
  }

  // ─── Forgot Password ─────────────────────────────────────────────────────────
  async forgotPassword(dto: ForgotPasswordDto): Promise<{ message: string }> {
    const SAFE_RESPONSE = {
      message: 'If this email exists, an OTP has been sent.',
    };

    // Search Owner first, then Employee
    const { user, source } = await this.findUserByEmail(dto.email);
    if (!user) return SAFE_RESPONSE; // never reveal if email exists

    const otp = generateOtp();
    const otpExpiresAt = getOtpExpiry(10);

    // Store OTP in the correct collection
    if (source === 'owner') {
      await this.ownerService.setOtp(dto.email, otp, otpExpiresAt);
    } else {
      await this.employeesService.setOtp(dto.email, otp, otpExpiresAt);
    }

    await this.mailService.sendOtpEmail(dto.email, otp);

    return SAFE_RESPONSE;
  }

  // ─── Verify OTP ──────────────────────────────────────────────────────────────
  async verifyOtp(
    dto: VerifyOtpDto,
  ): Promise<{ message: string; verified: boolean }> {
    const { user } = await this.findUserByEmail(dto.email);
    this.validateOtp(user, dto.otp);
    return { message: 'OTP verified successfully.', verified: true };
  }

  // ─── Reset Password ───────────────────────────────────────────────────────────
  async resetPassword(dto: ResetPasswordDto): Promise<{ message: string }> {
    const { user, source } = await this.findUserByEmail(dto.email);
    this.validateOtp(user, dto.otp);

    const hashed = await bcrypt.hash(dto.newPassword, 12);

    // Update password in the correct collection
    if (source === 'owner') {
      await this.ownerService.updatePassword(dto.email, hashed);
    } else {
      await this.employeesService.updatePassword(dto.email, hashed);
    }

    return { message: 'Password reset successfully. Please login.' };
  }

  // ─── Private: find user across both collections ───────────────────────────────
  private async findUserByEmail(
    email: string,
  ): Promise<{ user: any; source: UserSource }> {
    // Owner has priority — check Owner collection first
    const owner = await this.ownerService.findByEmail(email);
    if (owner) return { user: owner, source: 'owner' };

    // Fall back to Employee collection
    const employee = await this.employeesService.findByEmailWithOtp(email);
    if (employee) return { user: employee, source: 'employee' };

    return { user: null, source: 'owner' }; // source irrelevant when user is null
  }

  // ─── Private: validate OTP ───────────────────────────────────────────────────
  private validateOtp(user: UserWithOtp | null, inputOtp: string): void {
    if (!user?.otp || !user?.otpExpiresAt) {
      throw new BadRequestException('No OTP found. Please request a new one.');
    }
    if (new Date() > new Date(user.otpExpiresAt)) {
      throw new BadRequestException(
        'OTP has expired. Please request a new one.',
      );
    }
    if (user.otp !== inputOtp) {
      throw new BadRequestException('Invalid OTP.');
    }
  }
}
