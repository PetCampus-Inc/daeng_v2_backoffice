import { http, HttpResponse, type AnyHandler } from 'msw';

import { toMockAccount } from '@/api/mocks/util/account';
import { errorResponse, mockUrl } from '@/api/mocks/util/response';
import type { MyAccount } from '@/type/my-account';
import { ProfileDisplayNameDuplicateErrorCode } from '@/type/profile-display-name-duplicate-error-code';
import type { UpdateMyAccountRequest } from '@/type/update-my-account-request';
import { CHANGE_HISTORY_HANDLERS } from './change-histories';
import { authenticateMockRequest } from '@/api/mocks/util/session';
import { AUTH_HANDLERS } from './auth';
import { IDEA_HANDLERS } from './ideas';
import { NOTIFICATION_HANDLERS } from './notifications';
import { KINDERGARTEN_HANDLERS } from './kindergartens';
import { MEMBER_HANDLERS } from './members';
import { INQUIRY_HANDLERS } from './inquiries';
import { TERM_HANDLERS } from './terms';
import { NOTICE_HANDLERS } from './notices';
import { OVERVIEW_HANDLERS } from './overview';
import { OWNER_VERIFICATION_HANDLERS } from './owner-verifications';
import { TEAM_MEMBER_HANDLERS, syncMockMemberProfile } from './team-members';

const DISPLAY_NAME_ERROR = '표시명은 1~10자이며 이미 사용 중인 이름은 사용할 수 없습니다.';

/** 내 계정 가짜 API. 현재 계정은 가짜 세션(실제 서버의 세션 쿠키 자리)으로 구분한다. 명세대로 응답을 `data`로 감싸지 않는다. */
const ACCOUNT_HANDLERS: AnyHandler[] = [
  http.get(mockUrl('/me'), () => {
    const auth = authenticateMockRequest();
    if (auth.denied) return auth.denied;
    return HttpResponse.json(toMockAccount(auth.member, auth.session.googleName));
  }),
  http.patch(mockUrl('/me'), async ({ request }) => {
    const auth = authenticateMockRequest();
    if (auth.denied) return auth.denied;

    const input = (await request.json()) as UpdateMyAccountRequest;
    const isDisplayNameDuplicate = auth.members.some(
      (other) => other.email !== auth.member.email && other.displayName === input.displayName
    );
    if (isDisplayNameDuplicate) {
      return errorResponse(409, {
        code: ProfileDisplayNameDuplicateErrorCode.PROFILE_DISPLAY_NAME_DUPLICATE,
        message: DISPLAY_NAME_ERROR,
        errorMessage: DISPLAY_NAME_ERROR,
      });
    }

    const updatedAccount: MyAccount = {
      ...toMockAccount(auth.member, auth.session.googleName),
      displayName: input.displayName,
      jobRole: input.jobRole,
      isProfileCompleted: true,
    };
    syncMockMemberProfile(updatedAccount);
    return HttpResponse.json(updatedAccount);
  }),
];

/** 가짜 API 주소별 응답 모음. */
export const handlers: AnyHandler[] = [
  ...AUTH_HANDLERS,
  ...ACCOUNT_HANDLERS,
  ...TEAM_MEMBER_HANDLERS,
  ...INQUIRY_HANDLERS,
  ...IDEA_HANDLERS,
  ...NOTIFICATION_HANDLERS,
  ...NOTICE_HANDLERS,
  ...TERM_HANDLERS,
  ...KINDERGARTEN_HANDLERS,
  ...OVERVIEW_HANDLERS,
  ...OWNER_VERIFICATION_HANDLERS,
  ...MEMBER_HANDLERS,
  ...CHANGE_HISTORY_HANDLERS,
];
