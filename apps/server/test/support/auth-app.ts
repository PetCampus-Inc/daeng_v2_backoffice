import 'reflect-metadata';
import { Controller, Get, Module, type INestApplication, type Provider, type Type } from '@nestjs/common';
import { APP_FILTER, APP_GUARD, NestFactory, RouterModule } from '@nestjs/core';
import { AccountService } from '../../src/account/account.service.js';
import { MeController } from '../../src/account/me.controller.js';
import { AccessLogService } from '../../src/auth/access-log.service.js';
import { AUTH_CONFIG, ID_TOKEN_VERIFIER, type AuthConfig } from '../../src/auth/auth.constants.js';
import { AuthController } from '../../src/auth/auth.controller.js';
import { AuthGuard } from '../../src/auth/auth.guard.js';
import { AuthService } from '../../src/auth/auth.service.js';
import type { GoogleIdentity, IdTokenVerifier } from '../../src/auth/google-id-token-verifier.js';
import { OriginGuard } from '../../src/auth/origin.guard.js';
import { RoleGuard } from '../../src/auth/role.guard.js';
import { API_PREFIX } from '../../src/api.module.js';
import { ApiException } from '../../src/common/api-error.js';
import { ApiExceptionFilter } from '../../src/common/api-exception.filter.js';
import type { DatabaseConfig } from '../../src/database/database.config.js';
import { DATABASE_CONFIG, DatabaseService } from '../../src/database/database.service.js';
import { TeamMembersController } from '../../src/team-members/team-members.controller.js';
import { TeamMembersService } from '../../src/team-members/team-members.service.js';

export const AUTH_CONFIG_FOR_TEST: AuthConfig = {
  googleClientId: 'test-client-id.apps.googleusercontent.com',
  allowedOrigins: ['http://localhost:5173'],
  cookieSecure: false,
  devLoginEnabled: true,
};

/** DB에 연결하지 않는 테스트용 설정. 풀은 처음 쿼리할 때 연결하므로 값이 가짜여도 앱은 뜬다. */
export const UNUSED_DATABASE: DatabaseConfig = {
  host: '127.0.0.1',
  port: 1,
  database: 'unused',
  user: 'unused',
  password: 'unused',
};

export const ORIGIN = AUTH_CONFIG_FOR_TEST.allowedOrigins[0];

/** 구글 대신 토큰 문자열이 곧 계정이다: "<이름>" -> `<RUN>-<이름>@example.com`, sub-<이름> ("<이름>|<sub>"로 sub 지정). */
export class FakeVerifier implements IdTokenVerifier {
  constructor(private readonly emailFor: (name: string) => string) {}

  async verify(idToken: string): Promise<GoogleIdentity> {
    if (idToken.startsWith('bad')) throw new ApiException(401, 'INVALID_ID_TOKEN', 'ID 토큰을 확인할 수 없습니다.');
    const [name, sub = `sub-${name}`] = idToken.split('|');
    return { subject: sub, email: this.emailFor(name), name: `구글 ${name}` };
  }
}

// 로그인한 팀원만 부를 수 있는 시험용 API(명세에는 없다). 프로필 제한과 세션 만료 확인에 쓴다.
class ProbeController {
  probe() {
    return { ok: true };
  }
}
Controller('probe')(ProbeController);
Get()(ProbeController.prototype, 'probe', Object.getOwnPropertyDescriptor(ProbeController.prototype, 'probe')!);

export interface AuthTestApp {
  app: INestApplication;
  baseUrl: string;
  database: DatabaseService;
}

/** 실제 앱과 같은 방식으로 모듈에 접두어를 붙여(RouterModule) 인증 기능을 가짜 구글 검증기로 조립해 띄운다. */
export async function startAuthApp(
  database: DatabaseConfig,
  emailFor: (name: string) => string,
  config: AuthConfig = AUTH_CONFIG_FOR_TEST,
  extra: { controllers?: Type[]; providers?: Provider[] } = {}
): Promise<AuthTestApp> {
  class TestApiModule {}
  Module({
    controllers: [AuthController, MeController, TeamMembersController, ProbeController, ...(extra.controllers ?? [])],
    providers: [
      ...(extra.providers ?? []),
      { provide: DATABASE_CONFIG, useValue: database },
      DatabaseService,
      { provide: AUTH_CONFIG, useValue: config },
      { provide: ID_TOKEN_VERIFIER, useValue: new FakeVerifier(emailFor) },
      AccessLogService,
      AuthService,
      AccountService,
      TeamMembersService,
      { provide: APP_GUARD, useClass: OriginGuard },
      { provide: APP_GUARD, useClass: AuthGuard },
      { provide: APP_GUARD, useClass: RoleGuard },
      { provide: APP_FILTER, useClass: ApiExceptionFilter },
    ],
  })(TestApiModule);
  class TestModule {}
  Module({ imports: [TestApiModule, RouterModule.register([{ path: API_PREFIX, children: [TestApiModule] }])] })(
    TestModule
  );

  const app = await NestFactory.create(TestModule, { logger: false });
  await app.listen(0, '127.0.0.1');
  const baseUrl = `http://127.0.0.1:${(app.getHttpServer().address() as { port: number }).port}`;
  return { app, baseUrl, database: app.get(DatabaseService) };
}
