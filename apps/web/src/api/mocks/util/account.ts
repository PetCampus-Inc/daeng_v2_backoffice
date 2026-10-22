import type { TeamMember } from '@/routes/settings/members/type/team-member';
import type { MyAccount } from '@/type/account';

const DISPLAY_NAME_MAX_LENGTH = 10;

/**
 * 세션 팀원과 로그인 때 받은 구글 이름으로 내 계정 응답을 만든다.
 * 구글 이름이 10자를 넘거나 다른 팀원이 쓰면 표시명 처음 값을 비운다(PRD 7.2).
 */
export function toMockAccount(member: TeamMember, googleName: string, members: TeamMember[]): MyAccount {
  const isGoogleNameAvailable =
    googleName.length <= DISPLAY_NAME_MAX_LENGTH &&
    !members.some((other) => other.email !== member.email && other.displayName === googleName);
  return {
    email: member.email,
    googleName,
    suggestedDisplayName: isGoogleNameAvailable ? googleName : null,
    displayName: member.displayName,
    jobRole: member.jobRole,
    role: member.role,
    profileCompleted: member.displayName !== null && member.jobRole !== null,
  };
}
