import { Module, forwardRef } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import type { StringValue } from 'ms';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { AuthGuard } from './guards/auth.guard';
import { RolesGuard } from './guards/roles.guard';
import { JwtStrategy } from './strategies/jwt.strategy';
import { OwnerModule } from '../owner/owner.module';
import { EmployeesModule } from '../employees/employees.module';

@Module({
  imports: [
    OwnerModule,
    forwardRef(() => EmployeesModule), // ← forwardRef هنا
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>('JWT_SECRET'),
        signOptions: {
          expiresIn: (config.get<string>('JWT_EXPIRES_IN') ??
            '7d') as StringValue,
        },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy, AuthGuard, RolesGuard],
  exports: [AuthGuard, RolesGuard, JwtModule, PassportModule],
})
export class AuthModule {}
