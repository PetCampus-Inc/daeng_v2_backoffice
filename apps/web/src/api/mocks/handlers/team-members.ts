import { http } from 'msw';
import { errorResponse, mockUrl, okResponse } from '../util/response';
import { authenticateMockRequest } from '../util/session';
import type { TeamMember, RegisterMemberInput, UpdateMemberInput } from '@/routes/settings/members/type/team-member';
import {
  getReactivatedStatus,
  isMemberProtected,
  MEMBER_PROTECTION_MESSAGE,
  memberEmailSchema,
} from '@/routes/settings/members/util/member-policy';
import { ROLES } from '@/type/role';
import type { MyAccount } from '@/type/account';

// fixtures가 바뀌어 저장 키를 바꿨다. 이전 키(`daeng-bo-mock-team-members`)의 값은 더 읽지 않는다.
const STORAGE_KEY = 'daeng-bo-mock-team-members-v2';
/** TC fixtures.md 기준: 등록일 2026. 09. 01. 09:00, 로그인 이력이 있으면 마지막 로그인 2026. 10. 06. 09:00(KST). */
const REGISTERED_AT = '2026-09-01T00:00:00Z';
const LAST_LOGIN_AT = '2026-10-06T00:00:00Z';
/** TC fixtures.md `팀원-기본` 7명(`미등록` 제외). */
export const DEFAULT_MEMBERS: TeamMember[] = [
  {
    email: 'admin@knockdog.test',
    displayName: '김관리',
    jobRole: 'PM',
    role: 'superAdmin',
    status: 'active',
    lastLoginAt: LAST_LOGIN_AT,
    registeredAt: REGISTERED_AT,
  },
  {
    email: 'ops@knockdog.test',
    displayName: '김운영',
    jobRole: 'PM',
    role: 'operator',
    status: 'active',
    lastLoginAt: LAST_LOGIN_AT,
    registeredAt: REGISTERED_AT,
  },
  {
    email: 'ops2@knockdog.test',
    displayName: '이담당',
    jobRole: 'FE',
    role: 'operator',
    status: 'active',
    lastLoginAt: LAST_LOGIN_AT,
    registeredAt: REGISTERED_AT,
  },
  {
    email: 'viewer@knockdog.test',
    displayName: '박조회',
    jobRole: 'UX/UI',
    role: 'viewer',
    status: 'active',
    lastLoginAt: LAST_LOGIN_AT,
    registeredAt: REGISTERED_AT,
  },
  {
    email: 'inactive@knockdog.test',
    displayName: '정비활',
    jobRole: 'BE',
    role: 'operator',
    status: 'inactive',
    lastLoginAt: LAST_LOGIN_AT,
    registeredAt: REGISTERED_AT,
  },
  {
    email: 'new@knockdog.test',
    displayName: null,
    jobRole: null,
    role: 'superAdmin',
    status: 'registered',
    lastLoginAt: null,
    registeredAt: REGISTERED_AT,
  },
  {
    email: 'canceled@knockdog.test',
    displayName: null,
    jobRole: null,
    role: 'operator',
    status: 'cancelled',
    lastLoginAt: null,
    registeredAt: REGISTERED_AT,
  },
];

/** 개발용 목록은 새로고침 뒤에도 유지한다. */
export const getMockTeamMembers = (): TeamMember[] => {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null');
    if (Array.isArray(stored)) return stored;
  } catch {
    /* 잘못된 개발 데이터는 기본값으로 복구한다. */
  }
  return DEFAULT_MEMBERS.map((member) => ({ ...member }));
};

/** 개발용 팀원 목록을 저장한다. */
const saveMockTeamMembers = (members: TeamMember[]) => localStorage.setItem(STORAGE_KEY, JSON.stringify(members));

/** 로그인 성공을 팀원에 반영한다. 첫 로그인(등록됨)은 활성으로 바꾼다(PRD 5.1). */
export const recordMockMemberLogin = (email: string) => {
  const members = getMockTeamMembers();
  const member = members.find((item) => item.email === email);
  if (!member) return;
  if (member.status === 'registered') member.status = 'active';
  member.lastLoginAt = new Date().toISOString();
  saveMockTeamMembers(members);
};

/** 프로필 저장 결과를 팀원 목록에도 반영한다. */
export const syncMockMemberProfile = (account: MyAccount) => {
  const members = getMockTeamMembers();
  const member = members.find((item) => item.email === account.email);
  if (!member) return;
  member.displayName = account.displayName;
  member.jobRole = account.jobRole;
  member.status = 'active';
  member.lastLoginAt ??= new Date().toISOString();
  saveMockTeamMembers(members);
};

/** 서버 오류와 같은 모양으로 요청 거부 사유를 전달한다. */
const rejectMemberRequest = (status: number, message: string) =>
  errorResponse(status, { code: 'TEAM_MEMBER_ERROR', message, errorMessage: message });

/** 모든 팀원 API에서 세션(만료·비활성 포함)과 최고 관리자 권한을 검사한다. */
const authorizeMemberRequest = () => {
  const auth = authenticateMockRequest();
  if (auth.denied) return { denied: auth.denied };
  if (auth.member.role !== 'superAdmin') return { denied: rejectMemberRequest(403, '접근 권한이 없습니다.') };
  return { email: auth.member.email };
};

export const TEAM_MEMBER_HANDLERS = [
  http.get(mockUrl('/team-members'), () => authorizeMemberRequest().denied ?? okResponse(getMockTeamMembers())),
  http.post(mockUrl('/team-members'), async ({ request }) => {
    const auth = authorizeMemberRequest();
    if (auth.denied) return auth.denied;
    const input = (await request.json()) as RegisterMemberInput;
    const parsedEmail = memberEmailSchema.safeParse(input.email);
    if (!parsedEmail.success) return rejectMemberRequest(400, '올바른 이메일 주소를 입력해 주세요.');
    if (!ROLES.includes(input.role)) return rejectMemberRequest(400, '역할을 선택해 주세요.');
    const members = getMockTeamMembers();
    const existing = members.find((member) => member.email.toLowerCase() === parsedEmail.data);
    if (existing) {
      return rejectMemberRequest(
        409,
        existing.status === 'inactive' || existing.status === 'cancelled'
          ? '비활성·등록 취소 계정은 재활성화로만 되돌릴 수 있습니다.'
          : '이미 등록된 이메일입니다.'
      );
    }
    const member: TeamMember = {
      email: parsedEmail.data,
      role: input.role,
      displayName: null,
      jobRole: null,
      status: 'registered',
      lastLoginAt: null,
      registeredAt: new Date().toISOString(),
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...members, member]));
    return okResponse(member);
  }),
  http.patch(mockUrl('/team-members/:email'), async ({ request, params }) => {
    const auth = authorizeMemberRequest();
    if (auth.denied) return auth.denied;
    const members = getMockTeamMembers();
    const member = members.find((item) => item.email === params.email);
    if (!member) return rejectMemberRequest(404, '계정을 찾을 수 없습니다.');
    if (isMemberProtected(member, members, auth.email)) {
      return rejectMemberRequest(409, MEMBER_PROTECTION_MESSAGE);
    }
    const input = (await request.json()) as UpdateMemberInput;
    const isEnabled = member.status === 'active' || member.status === 'registered';
    if (input.action === 'changeRole' && isEnabled && ROLES.includes(input.role)) member.role = input.role;
    else if (input.action === 'deactivate' && member.status === 'active') member.status = 'inactive';
    else if (input.action === 'cancel' && member.status === 'registered') member.status = 'cancelled';
    else if (input.action === 'reactivate' && !isEnabled) member.status = getReactivatedStatus(member);
    else return rejectMemberRequest(409, '계정 상태가 변경되었습니다. 목록을 다시 확인해 주세요.');
    localStorage.setItem(STORAGE_KEY, JSON.stringify(members));
    return okResponse(member);
  }),
];
