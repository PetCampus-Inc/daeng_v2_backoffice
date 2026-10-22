import type { JobRole } from '@daeng/shared';
import { create } from 'zustand';

import type { MyAccount } from '@/type/account';
import type { Role } from '@/type/role';

type SessionUserBase = {
  role: Role;
  email: string;
  googleName: string;
};

/** 첫 로그인 프로필 설정을 아직 끝내지 않은 팀원. */
export type PendingSessionUser = SessionUserBase & {
  profileCompleted: false;
  displayName: null;
  jobRole: null;
};

/** 프로필 설정을 마쳐 상단바에 `표시명 · 직무`가 보이는 팀원. */
export type CompletedSessionUser = SessionUserBase & {
  profileCompleted: true;
  displayName: string;
  jobRole: JobRole;
};

export type SessionUser = PendingSessionUser | CompletedSessionUser;

/**
 * 세션 상태.
 * - unknown: 아직 서버에 묻지 않음(앱을 막 열었을 때)
 * - guest: 앱을 열 때부터 세션이 없음. 로그인하면 원래 가려던 주소로 돌아간다
 * - signedIn: 로그인함
 * - signedOut: 이 탭에서 로그아웃·세션 만료·계정 비활성으로 세션이 끝남. 다시 로그인하면 홈으로 간다
 */
export type SessionStatus = 'unknown' | 'guest' | 'signedIn' | 'signedOut';

/** 로그인 화면 안내 박스. expired는 파란 박스(만료), denied는 빨간 박스(접근 권한 없음)다(PRD 7.1). */
export type LoginNotice = 'expired' | 'denied';

type AuthState = {
  status: SessionStatus;
  user: SessionUser | null;
  loginNotice: LoginNotice | null;
  /** 로그인 성공·세션 확인 결과로 로그인 상태를 채운다. 로그인 화면 안내는 지운다. */
  signIn: (account: MyAccount) => void;
  /** 내 계정 저장 성공 뒤 세션 표시를 갱신한다. */
  updateProfile: (account: MyAccount) => void;
  /** 앱을 열 때 세션이 없었음을 기록한다. */
  markGuest: () => void;
  /** 로그아웃·세션 만료·계정 비활성으로 세션을 끝낸다. notice가 있으면 로그인 화면에 안내 박스를 띄운다. */
  endSession: (notice: LoginNotice | null) => void;
  /** 로그인 실패 등으로 로그인 화면에 안내 박스를 띄운다. */
  showLoginNotice: (notice: LoginNotice) => void;
};

/** 서버의 내 계정 정보를 화면이 쓰는 세션 팀원 모양으로 바꾼다. */
function toSessionUser(account: MyAccount): SessionUser {
  const base = { role: account.role, email: account.email, googleName: account.googleName };
  if (account.profileCompleted && account.displayName && account.jobRole) {
    return { ...base, profileCompleted: true, displayName: account.displayName, jobRole: account.jobRole };
  }
  return { ...base, profileCompleted: false, displayName: null, jobRole: null };
}

/**
 * 로그인 상태. 로그인 유지는 서버 세션 쿠키가 맡고(OQ-D4), 이 store는 이번 탭에서 확인한 결과만 둔다.
 * 새로고침하면 `unknown`으로 돌아가 서버(`GET /me`)에 다시 묻는다.
 */
export const useAuthStore = create<AuthState>()((set) => ({
  status: 'unknown',
  user: null,
  loginNotice: null,
  signIn: (account) => set({ status: 'signedIn', user: toSessionUser(account), loginNotice: null }),
  updateProfile: (account) => set({ user: toSessionUser(account) }),
  markGuest: () => set({ status: 'guest', user: null }),
  endSession: (notice) => set({ status: 'signedOut', user: null, loginNotice: notice }),
  showLoginNotice: (notice) => set({ loginNotice: notice }),
}));
