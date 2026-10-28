import { http, HttpResponse, type AnyHandler } from 'msw';

import { toMockAccount } from '@/api/mocks/util/account';
import { judgeLogin } from '@/api/mocks/util/auth-rule';
import { readDevCredential } from '@/api/mocks/util/dev-credential';
import { errorResponse, mockUrl } from '@/api/mocks/util/response';
import { endMockSession, startMockSession } from '@/api/mocks/util/session';
import { InvalidIdTokenErrorCode } from '@/type/invalid-id-token-error-code';
import type { LoginRequest } from '@/type/login-request';
import { LoginNotAllowedErrorCode } from '@/type/login-not-allowed-error-code';
import { getMockTeamMembers, recordMockMemberLogin } from './team-members';

const LOGIN_NOT_ALLOWED_MESSAGE = '접근 권한이 없는 계정입니다. 관리자에게 문의해 주세요.';
const INVALID_ID_TOKEN_MESSAGE = 'ID 토큰을 확인할 수 없습니다.';

/**
 * 로그인·로그아웃 가짜 API. 실제 서버의 토큰 검증 대신 개발용 가짜 토큰을 읽는다. 접속 기록은 남기지 않는다.
 * 명세대로 응답을 `data`로 감싸지 않는다(로그인은 내 계정 그대로, 로그아웃은 204).
 */
export const AUTH_HANDLERS: AnyHandler[] = [
  http.post(mockUrl('/auth/login'), async ({ request }) => {
    const input = (await request.json()) as LoginRequest;
    const payload = readDevCredential(input.idToken);
    if (!payload) {
      return errorResponse(401, {
        code: InvalidIdTokenErrorCode.INVALID_ID_TOKEN,
        message: INVALID_ID_TOKEN_MESSAGE,
        errorMessage: INVALID_ID_TOKEN_MESSAGE,
      });
    }

    const judgement = judgeLogin(payload.email, getMockTeamMembers());
    if (judgement.result === 'denied') {
      return errorResponse(403, {
        code: LoginNotAllowedErrorCode.LOGIN_NOT_ALLOWED,
        message: LOGIN_NOT_ALLOWED_MESSAGE,
        errorMessage: LOGIN_NOT_ALLOWED_MESSAGE,
      });
    }

    recordMockMemberLogin(judgement.member.email);
    startMockSession(judgement.member.email, payload.name);
    const members = getMockTeamMembers();
    const member = members.find((item) => item.email === judgement.member.email) ?? judgement.member;
    return HttpResponse.json(toMockAccount(member, payload.name));
  }),
  http.post(mockUrl('/auth/logout'), () => {
    endMockSession();
    return new HttpResponse(null, { status: 204 });
  }),
];
