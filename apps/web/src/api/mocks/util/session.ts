import type { TeamMember } from '@/routes/settings/members/type/team-member';
import { AUTH_ERROR_CODES } from '@/type/auth';
import { getMockTeamMembers } from '../handlers/team-members';
import { isSessionExpired } from './auth-rule';
import { errorResponse } from './response';

/**
 * 가짜 서버의 세션. 실제 서버의 세션 쿠키 대신 localStorage에 둔다.
 * 쿠키처럼 같은 브라우저의 모든 탭이 함께 쓰고 새로고침해도 남는다.
 * 브라우저 확인 때 `lastRequestAt`을 24시간 전으로 바꾸면 다음 요청이 세션 만료가 된다.
 */
const STORAGE_KEY = 'daeng-bo-mock-session';

type MockSession = {
  email: string;
  /** 로그인할 때 구글 토큰에서 받은 이름. 첫 로그인 표시명 처음 값에 쓴다. */
  googleName: string;
  lastRequestAt: number;
};

/** 저장된 가짜 세션을 읽는다. 잘못된 값은 세션이 없는 것으로 본다. */
function readMockSession(): MockSession | null {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null') as MockSession | null;
    return stored && typeof stored.email === 'string' ? stored : null;
  } catch {
    return null;
  }
}

/** 가짜 세션을 저장한다. 로그인 성공과 매 요청의 마지막 요청 시각 갱신에 쓴다. */
function writeMockSession(session: MockSession) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
}

/** 로그인 성공 시 세션을 만든다(서버가 세션 쿠키를 심는 자리). */
export function startMockSession(email: string, googleName: string) {
  writeMockSession({ email, googleName, lastRequestAt: Date.now() });
}

/** 로그아웃·만료·비활성으로 세션을 지운다. */
export function endMockSession() {
  localStorage.removeItem(STORAGE_KEY);
}

/** 인증 오류 응답. 실제 서버의 오류 모양을 따른다. 문구는 서버 확인 필요. */
function createAuthErrorResponse(code: string, message: string) {
  return errorResponse(401, { code, message, errorMessage: message });
}

/**
 * 요청마다 세션을 검사한다(PRD 4.5 서버 보장).
 * - 세션 없음 → 401 UNAUTHORIZED
 * - 마지막 요청 뒤 24시간 → 세션 삭제, 401 SESSION_EXPIRED
 * - 그 사이 비활성·등록 취소 → 세션 삭제, 401 ACCOUNT_INACTIVE(FR-BO-014)
 * 통과하면 마지막 요청 시각을 갱신하고 세션과 현재 팀원을 돌려준다.
 */
export function authenticateMockRequest():
  | { session: MockSession; member: TeamMember; members: TeamMember[]; denied?: undefined }
  | { denied: Response } {
  const session = readMockSession();
  if (!session) {
    return { denied: createAuthErrorResponse(AUTH_ERROR_CODES.unauthorized, '로그인이 필요합니다.') };
  }
  const now = Date.now();
  if (isSessionExpired(session.lastRequestAt, now)) {
    endMockSession();
    return { denied: createAuthErrorResponse(AUTH_ERROR_CODES.sessionExpired, '로그인이 만료되었습니다.') };
  }
  const members = getMockTeamMembers();
  const member = members.find((item) => item.email === session.email);
  if (!member || member.status === 'inactive' || member.status === 'cancelled') {
    endMockSession();
    return { denied: createAuthErrorResponse(AUTH_ERROR_CODES.accountInactive, '접근 권한이 없는 계정입니다.') };
  }
  const touchedSession = { ...session, lastRequestAt: now };
  writeMockSession(touchedSession);
  return { session: touchedSession, member, members };
}
