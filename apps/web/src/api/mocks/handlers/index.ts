import { http, type AnyHandler } from 'msw';

import type { MyAccount, UpdateMyAccountInput } from '@/type/account';
import { errorResponse, mockUrl, okResponse } from '@/api/mocks/util/response';
import { TEAM_MEMBER_HANDLERS, getMockTeamMembers, syncMockMemberProfile } from './team-members';

const DISPLAY_NAME_DUPLICATE_CODE = 'PROFILE_DISPLAY_NAME_DUPLICATE';
const DISPLAY_NAME_ERROR = '표시명은 1~10자이며 이미 사용 중인 이름은 사용할 수 없습니다.';

const DEFAULT_ACCOUNTS: MyAccount[] = [
  {
    email: 'admin@knockdog.net',
    googleName: '김관리',
    suggestedDisplayName: '김관리',
    displayName: '김관리',
    jobRole: 'PM',
    role: 'superAdmin',
    profileCompleted: true,
  },
  {
    email: 'operator@knockdog.net',
    googleName: '이운영',
    suggestedDisplayName: '이운영',
    displayName: '이운영',
    jobRole: 'FE',
    role: 'operator',
    profileCompleted: true,
  },
  {
    email: 'viewer@knockdog.net',
    googleName: '박조회',
    suggestedDisplayName: '박조회',
    displayName: null,
    jobRole: null,
    role: 'viewer',
    profileCompleted: false,
  },
];

/** 페이지를 새로 열 때도 저장한 개발 계정 프로필을 이어 쓰기 위해 zustand 저장값을 읽는다. */
function getStoredAccounts() {
  const mockAccounts = new Map(DEFAULT_ACCOUNTS.map((account) => [account.email, account]));
  try {
    const persistedAuth = JSON.parse(localStorage.getItem('daeng-bo-dev-auth') ?? '{}') as {
      version?: number;
      state?: { devProfiles?: Record<string, Omit<MyAccount, 'role' | 'suggestedDisplayName'>> };
    };
    // auth store가 새 모양으로 migrate하기 전 저장값은 가짜 서버도 기본값으로 시작한다.
    if (persistedAuth.version !== 2) return mockAccounts;
    Object.entries(persistedAuth.state?.devProfiles ?? {}).forEach(([role, profile]) => {
      const displayNameIsAvailable =
        profile.googleName.length <= 10 &&
        !Object.values(persistedAuth.state?.devProfiles ?? {}).some(
          (other) => other.email !== profile.email && other.displayName === profile.googleName
        );
      mockAccounts.set(profile.email, {
        ...profile,
        role: role as MyAccount['role'],
        suggestedDisplayName: displayNameIsAvailable ? profile.googleName : null,
      });
    });
  } catch {
    // 잘못된 개발용 localStorage는 로그인 store의 migrate가 복구한다.
  }
  return mockAccounts;
}

const mockAccounts = getStoredAccounts();

/** 개발용 로그인 계정의 이메일을 요청 헤더에서 읽는다. */
function getRequestEmail(request: Request) {
  return request.headers.get('X-Dev-Email');
}

/** 현재 계정이 없을 때 실제 서버와 같은 인증 오류 모양으로 응답한다. */
function createUnauthorizedResponse() {
  return errorResponse(401, {
    code: 'UNAUTHORIZED',
    message: '로그인이 필요합니다.',
    errorMessage: '로그인이 필요합니다.',
  });
}

const ACCOUNT_HANDLERS: AnyHandler[] = [
  http.get(mockUrl('/me'), ({ request }) => {
    const email = getRequestEmail(request);
    const account = email ? mockAccounts.get(email) : undefined;
    const member = getMockTeamMembers().find((item) => item.email === email);
    return account && member && member.status !== 'inactive' && member.status !== 'cancelled'
      ? okResponse({ ...account, role: member.role })
      : createUnauthorizedResponse();
  }),
  http.patch(mockUrl('/me'), async ({ request }) => {
    const email = getRequestEmail(request);
    const account = email ? mockAccounts.get(email) : undefined;
    const member = getMockTeamMembers().find((item) => item.email === email);
    if (!account || !member || member.status === 'inactive' || member.status === 'cancelled') {
      return createUnauthorizedResponse();
    }

    const input = (await request.json()) as UpdateMyAccountInput;
    const isDisplayNameDuplicate = [...mockAccounts.values()].some(
      (other) => other.email !== account.email && other.displayName === input.displayName
    );
    if (isDisplayNameDuplicate) {
      return errorResponse(409, {
        code: DISPLAY_NAME_DUPLICATE_CODE,
        message: DISPLAY_NAME_ERROR,
        errorMessage: DISPLAY_NAME_ERROR,
      });
    }

    const updatedAccount: MyAccount = {
      ...account,
      role: member.role,
      displayName: input.displayName,
      jobRole: input.jobRole,
      profileCompleted: true,
    };
    mockAccounts.set(account.email, updatedAccount);
    syncMockMemberProfile(updatedAccount);
    return okResponse(updatedAccount);
  }),
];

/** 가짜 API 주소별 응답 모음. */
export const handlers: AnyHandler[] = [...ACCOUNT_HANDLERS, ...TEAM_MEMBER_HANDLERS];
