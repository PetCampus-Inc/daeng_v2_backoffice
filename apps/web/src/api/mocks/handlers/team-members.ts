import { http } from 'msw';
import { errorResponse, mockUrl, okResponse } from '../util/response';
import type { TeamMember, RegisterMemberInput, UpdateMemberInput } from '@/routes/settings/members/type/team-member';
import {
  getReactivatedStatus,
  isMemberProtected,
  MEMBER_PROTECTION_MESSAGE,
  memberEmailSchema,
} from '@/routes/settings/members/util/member-policy';
import { ROLES } from '@/type/role';
import type { MyAccount } from '@/type/account';

const STORAGE_KEY = 'daeng-bo-mock-team-members';
const DEFAULT_MEMBERS: TeamMember[] = [
  {
    email: 'admin@knockdog.net',
    displayName: '김관리',
    jobRole: 'PM',
    role: 'superAdmin',
    status: 'active',
    lastLoginAt: '2026-10-22T00:02:00Z',
    registeredAt: '2026-09-20T00:00:00Z',
  },
  {
    email: 'operator@knockdog.net',
    displayName: '이운영',
    jobRole: 'FE',
    role: 'operator',
    status: 'active',
    lastLoginAt: '2026-10-22T00:11:00Z',
    registeredAt: '2026-10-06T00:00:00Z',
  },
  {
    email: 'viewer@knockdog.net',
    displayName: null,
    jobRole: null,
    role: 'viewer',
    status: 'registered',
    lastLoginAt: null,
    registeredAt: '2026-10-08T00:00:00Z',
  },
  {
    email: 'inactive@example.com',
    displayName: '최비활',
    jobRole: 'BE',
    role: 'operator',
    status: 'inactive',
    lastLoginAt: '2026-09-30T09:20:00Z',
    registeredAt: '2026-09-22T00:00:00Z',
  },
  {
    email: 'new@example.com',
    displayName: null,
    jobRole: null,
    role: 'viewer',
    status: 'registered',
    lastLoginAt: null,
    registeredAt: '2026-10-08T00:00:00Z',
  },
  {
    email: 'cancelled@example.com',
    displayName: null,
    jobRole: null,
    role: 'viewer',
    status: 'cancelled',
    lastLoginAt: null,
    registeredAt: '2026-10-07T00:00:00Z',
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

/** 프로필 저장 결과를 팀원 목록에도 반영한다. */
export const syncMockMemberProfile = (account: MyAccount) => {
  const members = getMockTeamMembers();
  const member = members.find((item) => item.email === account.email);
  if (!member) return;
  member.displayName = account.displayName;
  member.jobRole = account.jobRole;
  member.status = 'active';
  member.lastLoginAt ??= new Date().toISOString();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(members));
};

/** 서버 오류와 같은 모양으로 요청 거부 사유를 전달한다. */
const rejectMemberRequest = (status: number, message: string) =>
  errorResponse(status, { code: 'TEAM_MEMBER_ERROR', message, errorMessage: message });

/** 모든 팀원 API에서 현재 계정의 활성 상태와 최고 관리자 권한을 검사한다. */
const authorizeMemberRequest = (request: Request) => {
  const member = getMockTeamMembers().find((item) => item.email === request.headers.get('X-Dev-Email'));
  if (!member || member.status !== 'active') return rejectMemberRequest(401, '로그인이 필요합니다.');
  if (member.role !== 'superAdmin') return rejectMemberRequest(403, '접근 권한이 없습니다.');
  return null;
};

export const TEAM_MEMBER_HANDLERS = [
  http.get(
    mockUrl('/team-members'),
    ({ request }) => authorizeMemberRequest(request) ?? okResponse(getMockTeamMembers())
  ),
  http.post(mockUrl('/team-members'), async ({ request }) => {
    const denied = authorizeMemberRequest(request);
    if (denied) return denied;
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
    const denied = authorizeMemberRequest(request);
    if (denied) return denied;
    const members = getMockTeamMembers();
    const member = members.find((item) => item.email === params.email);
    if (!member) return rejectMemberRequest(404, '계정을 찾을 수 없습니다.');
    if (isMemberProtected(member, members, request.headers.get('X-Dev-Email') ?? '')) {
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
