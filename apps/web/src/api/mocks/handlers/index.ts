import { http, type AnyHandler } from 'msw';

import type { MyAccount, UpdateMyAccountInput } from '@/type/account';
import { toMockAccount } from '@/api/mocks/util/account';
import { errorResponse, mockUrl, okResponse } from '@/api/mocks/util/response';
import { CHANGE_HISTORY_HANDLERS } from './change-histories';
import { authenticateMockRequest } from '@/api/mocks/util/session';
import { AUTH_HANDLERS } from './auth';
import { IDEA_HANDLERS } from './ideas';
import { KINDERGARTEN_HANDLERS } from './kindergartens';
import { MEMBER_HANDLERS } from './members';
import { INQUIRY_HANDLERS } from './inquiries';
import { TERM_HANDLERS } from './terms';
import { NOTICE_HANDLERS } from './notices';
import { OVERVIEW_HANDLERS } from './overview';
import { OWNER_VERIFICATION_HANDLERS } from './owner-verifications';
import { TEAM_MEMBER_HANDLERS, syncMockMemberProfile } from './team-members';

const DISPLAY_NAME_DUPLICATE_CODE = 'PROFILE_DISPLAY_NAME_DUPLICATE';
const DISPLAY_NAME_ERROR = '표시명은 1~10자이며 이미 사용 중인 이름은 사용할 수 없습니다.';

/** 내 계정 가짜 API. 현재 계정은 가짜 세션(실제 서버의 세션 쿠키 자리)으로 구분한다. */
const ACCOUNT_HANDLERS: AnyHandler[] = [
  http.get(mockUrl('/me'), () => {
    const auth = authenticateMockRequest();
    if (auth.denied) return auth.denied;
    return okResponse(toMockAccount(auth.member, auth.session.googleName, auth.members));
  }),
  http.patch(mockUrl('/me'), async ({ request }) => {
    const auth = authenticateMockRequest();
    if (auth.denied) return auth.denied;

    const input = (await request.json()) as UpdateMyAccountInput;
    const isDisplayNameDuplicate = auth.members.some(
      (other) => other.email !== auth.member.email && other.displayName === input.displayName
    );
    if (isDisplayNameDuplicate) {
      return errorResponse(409, {
        code: DISPLAY_NAME_DUPLICATE_CODE,
        message: DISPLAY_NAME_ERROR,
        errorMessage: DISPLAY_NAME_ERROR,
      });
    }

    const updatedAccount: MyAccount = {
      ...toMockAccount(auth.member, auth.session.googleName, auth.members),
      displayName: input.displayName,
      jobRole: input.jobRole,
      profileCompleted: true,
    };
    syncMockMemberProfile(updatedAccount);
    return okResponse(updatedAccount);
  }),
];

/** 가짜 API 주소별 응답 모음. */
export const handlers: AnyHandler[] = [
  ...AUTH_HANDLERS,
  ...ACCOUNT_HANDLERS,
  ...TEAM_MEMBER_HANDLERS,
  ...INQUIRY_HANDLERS,
  ...IDEA_HANDLERS,
  ...NOTICE_HANDLERS,
  ...TERM_HANDLERS,
  ...KINDERGARTEN_HANDLERS,
  ...OVERVIEW_HANDLERS,
  ...OWNER_VERIFICATION_HANDLERS,
  ...MEMBER_HANDLERS,
  ...CHANGE_HISTORY_HANDLERS,
];
