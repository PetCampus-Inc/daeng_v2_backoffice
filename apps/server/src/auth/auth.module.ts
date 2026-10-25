import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { readAllowedOrigins, readCookieSecure, readGoogleClientId } from './auth.config.js';
import { AccessLogService } from './access-log.service.js';
import { AUTH_CONFIG, ID_TOKEN_VERIFIER, type AuthConfig } from './auth.constants.js';
import { AuthController } from './auth.controller.js';
import { AuthGuard } from './auth.guard.js';
import { AuthService } from './auth.service.js';
import { GoogleIdTokenVerifier } from './google-id-token-verifier.js';
import { OriginGuard } from './origin.guard.js';

@Module({
  controllers: [AuthController],
  providers: [
    {
      provide: AUTH_CONFIG,
      useFactory: (): AuthConfig => ({
        googleClientId: readGoogleClientId(process.env.GOOGLE_CLIENT_ID),
        allowedOrigins: readAllowedOrigins(process.env.ALLOWED_ORIGINS),
        cookieSecure: readCookieSecure(process.env.COOKIE_SECURE),
      }),
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
  ],
})
export class AuthModule {}
