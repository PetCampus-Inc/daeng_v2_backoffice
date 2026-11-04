import { http, HttpResponse } from 'msw';
import { mockUrl } from '../util/response';
import { authenticateMockRequest } from '../util/session';
import type { RegisterTeamMemberRequest } from '@/routes/settings/members/type/register-team-member-request';
import type { ChangeTeamMemberRoleRequest } from '@/routes/settings/members/type/change-team-member-role-request';
import type { TeamMember } from '@/routes/settings/members/type/team-member';
import { TeamMemberConflictErrorCode } from '@/routes/settings/members/type/team-member-conflict-error-code';
import { TeamMemberEmailConflictErrorCode } from '@/routes/settings/members/type/team-member-email-conflict-error-code';
import { TeamMemberNotFoundErrorCode } from '@/routes/settings/members/type/team-member-not-found-error-code';
import {
  getReactivatedStatus,
  isMemberProtected,
  MEMBER_PROTECTION_MESSAGE,
  memberEmailSchema,
} from '@/routes/settings/members/util/member-policy';
import { ForbiddenErrorCode } from '@/type/forbidden-error-code';
import type { MyAccount } from '@/type/my-account';
import { ROLES } from '@/type/role-ui';
import { ValidationFailedErrorCode } from '@/type/validation-failed-error-code';

// 팀원에 `id`가 생기고 상태 값이 명세 표기로 바뀌어 저장 키를 바꿨다. 이전 키(`...-v2`)의 값은 더 읽지 않는다.
const STORAGE_KEY = 'daeng-bo-mock-team-members-v3';
/** TC fixtures.md 기준: 등록일 2026. 09. 01. 09:00, 로그인 이력이 있으면 마지막 로그인 2026. 10. 06. 09:00(KST). */
const REGISTERED_AT = '2026-09-01T00:00:00Z';
const LAST_LOGIN_AT = '2026-10-06T00:00:00Z';
/** TC fixtures.md `팀원-기본` 7명(`미등록` 제외). */
export const DEFAULT_MEMBERS: TeamMember[] = [
  {
    id: 1,
    email: 'admin@knockdog.test',
    displayName: '김관리',
    jobRole: 'PM',
    role: 'SUPER_ADMIN',
    status: 'ACTIVE',
    lastLoginAt: LAST_LOGIN_AT,
    registeredAt: REGISTERED_AT,
  },
  {
    id: 2,
    email: 'ops@knockdog.test',
    displayName: '김운영',
    jobRole: 'PM',
    role: 'OPERATOR',
    status: 'ACTIVE',
    lastLoginAt: LAST_LOGIN_AT,
    registeredAt: REGISTERED_AT,
  },
  {
    id: 3,
    email: 'ops2@knockdog.test',
    displayName: '이담당',
    jobRole: 'FE',
    role: 'OPERATOR',
    status: 'ACTIVE',
    lastLoginAt: LAST_LOGIN_AT,
    registeredAt: REGISTERED_AT,
  },
  {
    id: 4,
    email: 'viewer@knockdog.test',
    displayName: '박조회',
    jobRole: 'UX_UI',
    role: 'VIEWER',
    status: 'ACTIVE',
    lastLoginAt: LAST_LOGIN_AT,
    registeredAt: REGISTERED_AT,
  },
  {
    id: 5,
    email: 'inactive@knockdog.test',
    displayName: '정비활',
    jobRole: 'BE',
    role: 'OPERATOR',
    status: 'INACTIVE',
    lastLoginAt: LAST_LOGIN_AT,
    registeredAt: REGISTERED_AT,
  },
  {
    id: 6,
    email: 'new@knockdog.test',
    displayName: null,
    jobRole: null,
    role: 'SUPER_ADMIN',
    status: 'REGISTERED',
    lastLoginAt: null,
    registeredAt: REGISTERED_AT,
  },
  {
    id: 7,
    email: 'canceled@knockdog.test',
    displayName: null,
    jobRole: null,
    role: 'OPERATOR',
    status: 'CANCELLED',
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
  if (member.status === 'REGISTERED') member.status = 'ACTIVE';
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
  member.status = 'ACTIVE';
  member.lastLoginAt ??= new Date().toISOString();
  saveMockTeamMembers(members);
};

/** 명세의 오류 응답(`{ code, message }`)을 만든다. */
const rejectMemberRequest = (status: number, code: string, message: string) =>
  HttpResponse.json({ code, message }, { status });

/** 입력 검증 실패 응답. 어느 필드가 왜 잘못됐는지 `details`에 담는다. */
const rejectInvalidInput = (field: string, reason: string) =>
  HttpResponse.json(
    {
      code: ValidationFailedErrorCode.VALIDATION_FAILED,
      message: '입력값을 확인해 주세요.',
      details: [{ field, reason }],
    },
    { status: 400 }
  );

/** 모든 팀원 API에서 세션(만료·비활성 포함)과 최고 관리자 권한을 검사한다. */
const authorizeMemberRequest = () => {
  const auth = authenticateMockRequest();
  if (auth.denied) return { denied: auth.denied };
  if (auth.member.role !== 'SUPER_ADMIN') {
    return { denied: rejectMemberRequest(403, ForbiddenErrorCode.FORBIDDEN, '이 기능을 사용할 권한이 없습니다.') };
  }
  return { email: auth.member.email };
};

/** 상태 변경 요청의 거부 사유. 계정 상태가 요청과 맞지 않을 때 쓴다. */
const rejectStateChanged = () =>
  rejectMemberRequest(
    409,
    TeamMemberConflictErrorCode.TEAM_MEMBER_STATE_CHANGED,
    '계정 상태가 변경됐습니다. 다시 확인해 주세요.'
  );

/**
 * 경로의 `memberId`로 팀원을 찾아 `change`를 적용한다. 변경한 팀원을 성공 응답으로 돌려준다.
 * 본인·마지막 최고 관리자 보호(`protect`)와 상태 조건(`canChange`)은 요청마다 다르다.
 */
const applyMemberChange = (
  memberIdParam: string | readonly string[] | undefined,
  options: {
    protect: boolean;
    canChange: (member: TeamMember) => boolean;
    change: (member: TeamMember) => void;
  }
) => {
  const auth = authorizeMemberRequest();
  if (auth.denied) return auth.denied;
  const memberId = Number(memberIdParam);
  if (!Number.isInteger(memberId)) return rejectInvalidInput('memberId', '올바른 팀원 ID가 아닙니다.');
  const members = getMockTeamMembers();
  const member = members.find((item) => item.id === memberId);
  if (!member) {
    return rejectMemberRequest(404, TeamMemberNotFoundErrorCode.TEAM_MEMBER_NOT_FOUND, '계정을 찾을 수 없습니다.');
  }
  if (options.protect && isMemberProtected(member, members, auth.email)) {
    return rejectMemberRequest(409, TeamMemberConflictErrorCode.TEAM_MEMBER_PROTECTED, MEMBER_PROTECTION_MESSAGE);
  }
  if (!options.canChange(member)) return rejectStateChanged();
  options.change(member);
  saveMockTeamMembers(members);
  return HttpResponse.json(member);
};

/** 활성·등록됨 계정인지. 역할 변경이 가능한 상태다. */
const isEnabled = (member: TeamMember) => member.status === 'ACTIVE' || member.status === 'REGISTERED';

export const TEAM_MEMBER_HANDLERS = [
  http.get(mockUrl('/team-members'), () => authorizeMemberRequest().denied ?? HttpResponse.json(getMockTeamMembers())),
  http.post(mockUrl('/team-members'), async ({ request }) => {
    const auth = authorizeMemberRequest();
    if (auth.denied) return auth.denied;
    const input = (await request.json()) as RegisterTeamMemberRequest;
    const parsedEmail = memberEmailSchema.safeParse(input.email);
    if (!parsedEmail.success) return rejectInvalidInput('email', '올바른 이메일 주소를 입력해 주세요.');
    if (!ROLES.includes(input.role)) return rejectInvalidInput('role', '역할을 선택해 주세요.');
    const members = getMockTeamMembers();
    const existing = members.find((member) => member.email.toLowerCase() === parsedEmail.data);
    if (existing) {
      return existing.status === 'INACTIVE' || existing.status === 'CANCELLED'
        ? rejectMemberRequest(
            409,
            TeamMemberEmailConflictErrorCode.TEAM_MEMBER_EMAIL_INACTIVE,
            '비활성·등록 취소 계정은 재활성화로만 되돌릴 수 있습니다.'
          )
        : rejectMemberRequest(
            409,
            TeamMemberEmailConflictErrorCode.TEAM_MEMBER_EMAIL_DUPLICATE,
            '이미 등록된 이메일입니다.'
          );
    }
    const member: TeamMember = {
      id: Math.max(0, ...members.map((item) => item.id)) + 1,
      email: parsedEmail.data,
      role: input.role,
      displayName: null,
      jobRole: null,
      status: 'REGISTERED',
      lastLoginAt: null,
      registeredAt: new Date().toISOString(),
    };
    saveMockTeamMembers([...members, member]);
    return HttpResponse.json(member, { status: 201 });
  }),
  http.patch(mockUrl('/team-members/:memberId'), async ({ request, params }) => {
    const input = (await request.json()) as ChangeTeamMemberRoleRequest;
    if (!ROLES.includes(input.role)) return rejectInvalidInput('role', '역할을 선택해 주세요.');
    return applyMemberChange(params.memberId, {
      protect: true,
      canChange: isEnabled,
      change: (member) => {
        member.role = input.role;
      },
    });
  }),
  http.post(mockUrl('/team-members/:memberId/deactivate'), ({ params }) =>
    applyMemberChange(params.memberId, {
      protect: true,
      canChange: (member) => member.status === 'ACTIVE',
      change: (member) => {
        member.status = 'INACTIVE';
      },
    })
  ),
  http.post(mockUrl('/team-members/:memberId/cancel'), ({ params }) =>
    applyMemberChange(params.memberId, {
      protect: true,
      canChange: (member) => member.status === 'REGISTERED',
      change: (member) => {
        member.status = 'CANCELLED';
      },
    })
  ),
  http.post(mockUrl('/team-members/:memberId/reactivate'), ({ params }) =>
    applyMemberChange(params.memberId, {
      protect: false,
      canChange: (member) => !isEnabled(member),
      change: (member) => {
        member.status = getReactivatedStatus(member);
      },
    })
  ),
];
