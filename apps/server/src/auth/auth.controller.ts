import { Body, Controller, HttpCode, Inject, Post, Req, Res } from '@nestjs/common';
import { z } from 'zod';
import { ApiException } from '../common/api-error.js';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';
import { AUTH_CONFIG, type AuthConfig } from './auth.constants.js';
import { AuthService } from './auth.service.js';
import { clearSessionCookie, readSessionId, setSessionCookie } from './cookies.js';
import { AllowIncompleteProfile, Public } from './decorators.js';
import { toMyAccount, type MyAccount } from './my-account.js';
import type { AuthRequest, CookieResponse } from './request.js';

const loginBodySchema = z.object({ idToken: z.string().min(1) });

@Controller('auth')
export class AuthController {
  constructor(
    @Inject(AuthService) private readonly auth: AuthService,
    @Inject(AUTH_CONFIG) private readonly config: AuthConfig
  ) {}

  @Public()
  @Post('login')
  @HttpCode(200)
  async login(
    @Body(new ZodValidationPipe(loginBodySchema)) body: z.infer<typeof loginBodySchema>,
    @Res({ passthrough: true }) response: CookieResponse
  ): Promise<MyAccount> {
    const { member, sessionId } = await this.auth.login(body.idToken);
    setSessionCookie(response, this.config, sessionId);
    return toMyAccount(member);
  }

  @AllowIncompleteProfile()
  @Post('logout')
  @HttpCode(204)
  async logout(@Req() request: AuthRequest, @Res({ passthrough: true }) response: CookieResponse): Promise<void> {
    const sessionId = readSessionId(request);
    // 가드를 통과했으면 세션과 팀원이 있다.
    if (!sessionId || !request.member) throw new ApiException(401, 'UNAUTHENTICATED', '로그인이 필요합니다.');
    await this.auth.logout(sessionId, request.member);
    clearSessionCookie(response, this.config);
  }
}
