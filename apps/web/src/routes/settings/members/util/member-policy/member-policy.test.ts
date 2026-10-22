import { describe, expect, it } from 'vitest';
import type { TeamMember } from '../../type/team-member';
import { getReactivatedStatus, isMemberProtected, memberEmailSchema } from '.';

const ADMIN: TeamMember = {
  email: 'admin@example.com',
  displayName: '관리',
  jobRole: 'PM',
  role: 'superAdmin',
  status: 'active',
  lastLoginAt: '2026-10-22T00:00:00Z',
  registeredAt: '2026-10-01T00:00:00Z',
};

describe('팀원 계정 보호', () => {
  it('본인 계정은 다른 활성 최고 관리자가 있어도 보호한다', () => {
    expect(isMemberProtected(ADMIN, [ADMIN, { ...ADMIN, email: 'other@example.com' }], ADMIN.email)).toBe(true);
  });
  it('마지막 활성 최고 관리자를 보호하고 등록됨 최고 관리자는 세지 않는다', () => {
    expect(
      isMemberProtected(
        ADMIN,
        [ADMIN, { ...ADMIN, email: 'new@example.com', status: 'registered' }],
        'other@example.com'
      )
    ).toBe(true);
  });
  it('다른 활성 최고 관리자가 있으면 변경할 수 있다', () => {
    expect(isMemberProtected(ADMIN, [ADMIN, { ...ADMIN, email: 'other@example.com' }], 'other@example.com')).toBe(
      false
    );
  });
  it('비활성 최고 관리자는 마지막 활성 관리자 보호 대상이 아니다', () => {
    expect(isMemberProtected({ ...ADMIN, status: 'inactive' }, [ADMIN], 'other@example.com')).toBe(false);
  });
});

describe('팀원 재활성화', () => {
  it('로그인 이력이 있으면 활성으로 복원한다', () =>
    expect(getReactivatedStatus({ ...ADMIN, status: 'inactive' })).toBe('active'));
  it('로그인 이력이 없으면 등록됨으로 복원한다', () =>
    expect(getReactivatedStatus({ ...ADMIN, status: 'cancelled', lastLoginAt: null })).toBe('registered'));
});

describe('등록 이메일', () => {
  it('앞뒤 공백을 제거하고 대소문자를 구분하지 않는다', () =>
    expect(memberEmailSchema.parse(' New@Example.COM ')).toBe('new@example.com'));
  it.each(['', 'name', 'name@', 'a b@example.com'])('잘못된 형식을 거부한다: %s', (email) =>
    expect(memberEmailSchema.safeParse(email).success).toBe(false)
  );
});
