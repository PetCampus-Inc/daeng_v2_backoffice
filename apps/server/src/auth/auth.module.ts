import { Logger, Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { readAllowedOrigins, readCookieSecure, readDevLoginEnabled, readGoogleClientId } from './auth.config.js';
import { AccessLogService } from './access-log.service.js';
import { AUTH_CONFIG, ID_TOKEN_VERIFIER, type AuthConfig } from './auth.constants.js';
import { AuthController } from './auth.controller.js';
import { AuthGuard } from './auth.guard.js';
import { AuthService } from './auth.service.js';
import { GoogleIdTokenVerifier } from './google-id-token-verifier.js';
import { OriginGuard } from './origin.guard.js';
import { RoleGuard } from './role.guard.js';

@Module({
  controllers: [AuthController],
  providers: [
    {
      provide: AUTH_CONFIG,
      useFactory: (): AuthConfig => {
        const cookieSecure = readCookieSecure(process.env.COOKIE_SECURE);
        const devLoginEnabled = readDevLoginEnabled(process.env.DEV_LOGIN_ENABLED, cookieSecure);
        if (devLoginEnabled)
          new Logger('Auth').warn('개발용 로그인이 켜져 있습니다. 구글 검증 없이 이메일로 로그인할 수 있습니다.');
        return {
          googleClientId: readGoogleClientId(process.env.GOOGLE_CLIENT_ID),
          allowedOrigins: readAllowedOrigins(process.env.ALLOWED_ORIGINS),
          cookieSecure,
          devLoginEnabled,
        };
      },
    },
    {
      provide: ID_TOKEN_VERIFIER,
      inject: [AUTH_CONFIG],
      useFactory: (config: AuthConfig) => new GoogleIdTokenVerifier(config.googleClientId),
    },
    AccessLogService,
    AuthService,
    // 순서가 중요하다: 먼저 Origin을 확인하고 그다음에 로그인 여부를 확인한다.
    { provide: APP_GUARD, useClass: OriginGuard },
    { provide: APP_GUARD, useClass: AuthGuard },
    { provide: APP_GUARD, useClass: RoleGuard },
  ],
})
export class AuthModule {}
