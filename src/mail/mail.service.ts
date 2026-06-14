import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import * as nodemailer from 'nodemailer';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private transporter: nodemailer.Transporter;

  constructor() {
    this.transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS, // Gmail App Password (not account password)
      },
    });
  }

  async sendOtpEmail(to: string, otp: string): Promise<void> {
    const html = this.buildOtpTemplate(otp);

    try {
      await this.transporter.sendMail({
        from: `"WMS System" <${process.env.EMAIL_USER}>`,
        to,
        subject: 'Your OTP Code — Password Reset',
        html,
      });
      this.logger.log(`OTP email sent to ${to}`);
    } catch (err) {
      this.logger.error(`Failed to send OTP email to ${to}`, err);
      throw new InternalServerErrorException(
        'Failed to send OTP email. Please try again.',
      );
    }
  }

  private buildOtpTemplate(otp: string): string {
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8" />
          <style>
            body { font-family: Arial, sans-serif; background: #f4f4f4; margin: 0; padding: 0; }
            .container { max-width: 480px; margin: 40px auto; background: #fff;
                         border-radius: 8px; padding: 32px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
            .otp-box { font-size: 36px; font-weight: bold; letter-spacing: 8px;
                       color: #2563eb; text-align: center; padding: 20px 0; }
            .footer { color: #9ca3af; font-size: 12px; margin-top: 24px; text-align: center; }
            .warning { color: #ef4444; font-size: 13px; text-align: center; margin-top: 8px; }
          </style>
        </head>
        <body>
          <div class="container">
            <h2 style="text-align:center; color:#1f2937;">Password Reset Request</h2>
            <p style="color:#4b5563; text-align:center;">
              Use the OTP code below to reset your password.
            </p>
            <div class="otp-box">${otp}</div>
            <p class="warning">⏰ This code expires in <strong>10 minutes</strong>.</p>
            <p class="warning">If you did not request this, please ignore this email.</p>
            <div class="footer">WMS — Warehouse Management System</div>
          </div>
        </body>
      </html>
    `;
  }
}
