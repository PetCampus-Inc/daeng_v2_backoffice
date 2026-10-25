import { Body, Controller, HttpCode, Inject, Post, Req, Res } from '@nestjs/common';
import { z } from 'zod';
import { ApiException } from '../common/api-error.js';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';
import { AUTH_CONFIG, type AuthConfig } from './auth.constants.js';
import { AuthService } from './auth.service.js';
import { clearSessionCookie, readSessionId, setSessionCookie } from './cookies.js';
import { AllowIncompleteProfile, Public } from './decorators.js';
import { isLoopbackAddress } from './loopback.js';
import { toMyAccount, type MyAccount } from './my-account.js';
import type { AuthRequest, CookieResponse } from './request.js';

const loginBodySchema = z.object({ idToken: z.string().min(1) });
const devLoginBodySchema = z.object({ email: z.email() });

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

  /**
   * 개발용. 구글 검증이 없어서 이메일만 알면 로그인되므로 `Origin` 검사(curl로 흉내 낼 수 있음)에 기대지 않고, 서버와 같은
   * 컴퓨터에서 온 요청만 받는다. 꺼져 있거나 다른 컴퓨터에서 온 요청은 입력 검증보다 먼저 404를 돌려서 이 경로가 있다는 것도
   * 드러내지 않는다.
   */
  @Public()
  @Post('dev-login')
  @HttpCode(200)
  async devLogin(
    @Body() body: unknown,
    @Req() request: AuthRequest,
    @Res({ passthrough: true }) response: CookieResponse
  ): Promise<MyAccount> {
    if (!this.config.devLoginEnabled || !isLoopbackAddress(request.socket?.remoteAddress))
      throw new ApiException(404, 'NOT_FOUND', '요청한 대상을 찾을 수 없습니다.');
    const { email } = new ZodValidationPipe(devLoginBodySchema).transform(body);
    const { member, sessionId } = await this.auth.devLogin(email);
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
