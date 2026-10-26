import { type CanActivate, type ExecutionContext, Inject, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ApiException } from '../common/api-error.js';
import { ALLOW_INCOMPLETE_PROFILE, IS_PUBLIC } from './decorators.js';
import { AUTH_CONFIG, type AuthConfig } from './auth.constants.js';
import { AuthService } from './auth.service.js';
import { readSessionId, setSessionCookie } from './cookies.js';
import { isProfileCompleted } from './my-account.js';
import type { AuthRequest, CookieResponse } from './request.js';

/** 모든 API의 기본 문지기. `@Public()`이 아니면 로그인한 팀원만 통과하고, 프로필을 완료하지 않았다면 일부만 허용한다. */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    @Inject(Reflector) private readonly reflector: Reflector,
    @Inject(AuthService) private readonly auth: AuthService,
    @Inject(AUTH_CONFIG) private readonly config: AuthConfig
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const targets = [context.getHandler(), context.getClass()];
    if (this.reflector.getAllAndOverride<boolean | undefined>(IS_PUBLIC, targets)) return true;

    const http = context.switchToHttp();
    const request = http.getRequest<AuthRequest>();
    const sessionId = readSessionId(request);
    if (!sessionId) throw new ApiException(401, 'UNAUTHENTICATED', '로그인이 필요합니다.');

    const { member, extended } = await this.auth.authenticate(sessionId);
    request.member = member;
    if (extended) setSessionCookie(http.getResponse<CookieResponse>(), this.config, sessionId);

    const allowIncomplete = this.reflector.getAllAndOverride<boolean | undefined>(ALLOW_INCOMPLETE_PROFILE, targets);
    if (!allowIncomplete && !isProfileCompleted(member)) {
      throw new ApiException(403, 'PROFILE_INCOMPLETE', '프로필을 먼저 설정해 주세요.');
    }
    return true;
  }
}
