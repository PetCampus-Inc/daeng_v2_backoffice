import type { TeamMember } from '@/routes/settings/members/type/team-member';

/** 세션 유지 시간. 마지막 요청 뒤 24시간이 되면 만료한다(PRD 4.5, R-세션). */
export const SESSION_IDLE_LIMIT_MS = 24 * 60 * 60 * 1000;

/** 로그인 판정 결과(R-로그인판정). 실패 사유는 서버가 접속 기록에 남기는 값이다(미등록·비활성). */
export type LoginJudgement =
  | { result: 'allowed'; member: TeamMember; isFirstLogin: boolean }
  | { result: 'denied'; reason: 'unregistered' | 'inactive' };

/**
 * 가짜 서버의 로그인 판정(PRD 7.1). 실제 판정은 서버가 한다.
 * 등록 이메일과 구글 이메일을 대소문자 없이 비교하고, 비활성·등록 취소는 '비활성'으로 막는다.
 * 등록됨 계정의 로그인은 첫 로그인이다.
 */
export function judgeLogin(googleEmail: string, members: TeamMember[]): LoginJudgement {
  const email = googleEmail.toLowerCase();
  const member = members.find((item) => item.email.toLowerCase() === email);
  if (!member) return { result: 'denied', reason: 'unregistered' };
  if (member.status === 'inactive' || member.status === 'cancelled') return { result: 'denied', reason: 'inactive' };
  return { result: 'allowed', member, isFirstLogin: member.status === 'registered' };
}

/** 마지막 요청 뒤 24시간이 지났으면 세션 만료다. 24시간 0분부터 만료로 본다(R-세션 표 아래 메모). */
export function isSessionExpired(lastRequestAt: number, now: number) {
  return now - lastRequestAt >= SESSION_IDLE_LIMIT_MS;
}
