import type { TeamMember } from '@/routes/settings/members/type/team-member';
import type { MyAccount } from '@/type/my-account';

/** 세션 팀원과 로그인 때 받은 구글 이름으로 내 계정 응답을 만든다. */
export function toMockAccount(member: TeamMember, googleName: string): MyAccount {
  return {
    id: member.id,
    email: member.email,
    googleName,
    displayName: member.displayName,
    jobRole: member.jobRole,
    role: member.role,
    isProfileCompleted: member.displayName !== null && member.jobRole !== null,
  };
}
