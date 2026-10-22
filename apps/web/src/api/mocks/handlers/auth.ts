import { http, type AnyHandler } from 'msw';

import { toMockAccount } from '@/api/mocks/util/account';
import { judgeLogin } from '@/api/mocks/util/auth-rule';
import { readDevCredential } from '@/api/mocks/util/dev-credential';
import { errorResponse, mockUrl, okResponse } from '@/api/mocks/util/response';
import { endMockSession, startMockSession } from '@/api/mocks/util/session';
import { AUTH_ERROR_CODES, type GoogleLoginInput } from '@/type/auth';
import { getMockTeamMembers, recordMockMemberLogin } from './team-members';

const LOGIN_NOT_ALLOWED_MESSAGE = '접근 권한이 없는 계정입니다. 관리자에게 문의해 주세요.';
const INVALID_CREDENTIAL_MESSAGE = '구글 로그인 정보를 확인하지 못했습니다.';

/** 로그인·로그아웃 가짜 API. 실제 서버의 토큰 검증 대신 개발용 가짜 토큰을 읽는다. 접속 기록은 남기지 않는다. */
export const AUTH_HANDLERS: AnyHandler[] = [
  http.post(mockUrl('/auth/google'), async ({ request }) => {
    const input = (await request.json()) as GoogleLoginInput;
    const payload = readDevCredential(input.credential);
    if (!payload) {
      return errorResponse(401, {
        code: 'INVALID_GOOGLE_CREDENTIAL',
        message: INVALID_CREDENTIAL_MESSAGE,
        errorMessage: INVALID_CREDENTIAL_MESSAGE,
      });
    }

    const judgement = judgeLogin(payload.email, getMockTeamMembers());
    if (judgement.result === 'denied') {
      return errorResponse(403, {
        code: AUTH_ERROR_CODES.loginNotAllowed,
        message: LOGIN_NOT_ALLOWED_MESSAGE,
        errorMessage: LOGIN_NOT_ALLOWED_MESSAGE,
      });
    }

    recordMockMemberLogin(judgement.member.email);
    startMockSession(judgement.member.email, payload.name);
    const members = getMockTeamMembers();
    const member = members.find((item) => item.email === judgement.member.email) ?? judgement.member;
    return okResponse(toMockAccount(member, payload.name, members));
  }),
  http.post(mockUrl('/auth/logout'), () => {
    endMockSession();
    return okResponse(null);
  }),
];
