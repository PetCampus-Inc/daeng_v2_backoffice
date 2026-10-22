import { z } from 'zod';
import type { TeamMember } from '../../type/team-member';

export const MEMBER_PROTECTION_MESSAGE = '마지막 최고 관리자와 본인 계정은 변경할 수 없습니다.';
export const memberEmailSchema = z.string().trim().toLowerCase().pipe(z.email('올바른 이메일 주소를 입력해 주세요.'));

/** 본인 또는 마지막 활성 최고 관리자 계정의 변경을 막는다. 등록됨 계정은 관리자 수에 넣지 않는다. */
export const isMemberProtected = (member: TeamMember, members: TeamMember[], currentEmail: string) =>
  member.email === currentEmail ||
  (member.status === 'active' &&
    member.role === 'superAdmin' &&
    members.filter((other) => other.status === 'active' && other.role === 'superAdmin').length <= 1);

/** 재활성화는 로그인 이력이 있는 계정만 활성 상태로 돌린다. */
export const getReactivatedStatus = (member: TeamMember) =>
  member.lastLoginAt ? ('active' as const) : ('registered' as const);
