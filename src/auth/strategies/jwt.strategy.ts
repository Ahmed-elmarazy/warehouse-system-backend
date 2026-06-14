// 📄 src/auth/strategies/jwt.strategy.ts

import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Role } from '../../common/enums/role.enum';
import { OwnerService } from '../../owner/owner.service';
import { EmployeesService } from '../../employees/employees.service'; // 👈 استيراد السيرفس النظيفة بتاعتك

export interface JwtPayload {
  sub: string;
  email: string;
  role: Role;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    configService: ConfigService,
    private readonly ownerService: OwnerService,
    private readonly employeesService: EmployeesService, // 👈 حقن السيرفس هنا بنجاح لأن الموديول عامل ليها Export
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.getOrThrow<string>('JWT_SECRET'),
    });
  }

  async validate(payload: JwtPayload) {
    let user = null;

    // 🎯 التوزيع الديناميكي حسب الـ Role اللي داخلة من الـ Token
    if (payload.role === Role.EMPLOYEE) {
      user = await this.employeesService.findById(payload.sub); // 👈 هيروح ينفذ الـ findById اللي لسة باعتها حالا
    } else {
      user = await this.ownerService.findById(payload.sub);
    }

    // التشيك الموحد على الحساب
    if (!user || !user.isActive) {
      throw new UnauthorizedException(
        'Access denied. Invalid or inactive account.',
      );
    }

    // البيانات دي هي اللي هترجع في الـ req.user في دالة الـ getMe
    return {
      id: user._id.toString(),
      fullName: user.fullName,
      email: user.email,
      role: payload.role, // 👈 بنباصي الـ Role اللي جاية من الـ payload عشان الـ RolesGuard يلقطها
      isActive: user.isActive,
    };
  }
}
