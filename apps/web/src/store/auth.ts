import type { JobRole } from '@daeng/shared';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

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
type DevProfile = Omit<PendingSessionUser, 'role'> | Omit<CompletedSessionUser, 'role'>;

/**
 * 개발용 가짜 팀원. 조회자는 첫 로그인 프로필 설정, 나머지는 프로필 패널 확인에 쓴다.
 * 실제 로그인·세션 API를 붙이면 이 목록은 없앤다.
 */
const DEFAULT_DEV_PROFILES: Record<Role, DevProfile> = {
  superAdmin: {
    email: 'admin@knockdog.net',
    googleName: '김관리',
    displayName: '김관리',
    jobRole: 'PM',
    profileCompleted: true,
  },
  operator: {
    email: 'operator@knockdog.net',
    googleName: '이운영',
    displayName: '이운영',
    jobRole: 'FE',
    profileCompleted: true,
  },
  viewer: {
    email: 'viewer@knockdog.net',
    googleName: '박조회',
    displayName: null,
    jobRole: null,
    profileCompleted: false,
  },
};

type AuthState = {
  user: SessionUser | null;
  devProfiles: typeof DEFAULT_DEV_PROFILES;
  /** 개발용 로그인. 고른 역할의 가짜 팀원으로 들어가며, 로그인한 채로 부르면 역할만 바뀐다. */
  devLogin: (role: Role) => void;
  /** 내 계정 저장 성공 뒤 세션 표시와 다음 개발 로그인을 함께 갱신한다. */
  updateProfile: (account: MyAccount) => void;
  logout: () => void;
};

/**
 * 로그인 상태. 지금은 구글 로그인 대신 쓰는 개발용 가짜 로그인이다.
 * 새로고침해도 유지되도록 localStorage에 둔다. 서버 세션을 붙이면 이 store를 바꾼다.
 */
export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      devProfiles: DEFAULT_DEV_PROFILES,
      devLogin: (role) => set((state) => ({ user: { role, ...state.devProfiles[role] } as SessionUser })),
      updateProfile: (account) =>
        set((state) => {
          const profile = {
            email: account.email,
            googleName: account.googleName,
            displayName: account.displayName,
            jobRole: account.jobRole,
            profileCompleted: account.profileCompleted,
          } as DevProfile;
          return {
            user: { role: account.role, ...profile } as SessionUser,
            devProfiles: { ...state.devProfiles, [account.role]: profile },
          };
        }),
      logout: () => set({ user: null }),
    }),
    {
      name: 'daeng-bo-dev-auth',
      storage: createJSONStorage(() => localStorage),
      version: 2,
      // 이전 버전에는 이메일·첫 로그인 상태가 없어 개발용 기본 계정으로 한 번 옮긴다.
      migrate: (persistedState) => {
        const previous = persistedState as Partial<AuthState>;
        const role = previous.user?.role;
        return {
          user: role ? ({ role, ...DEFAULT_DEV_PROFILES[role] } as SessionUser) : null,
          devProfiles: DEFAULT_DEV_PROFILES,
        };
      },
    }
  )
);
