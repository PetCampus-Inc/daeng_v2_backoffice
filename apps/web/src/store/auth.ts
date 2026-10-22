import type { JobRole } from '@daeng/shared';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import type { Role } from '@/type/role';

/** 로그인한 팀원. 상단바 프로필에 `표시명 · 직무`로 보인다. */
export type SessionUser = {
  role: Role;
  displayName: string;
  jobRole: JobRole;
};

/**
 * 개발용 가짜 팀원. 구글 로그인(OQ-D4)을 붙이기 전까지 역할별로 하나씩 쓴다.
 * 이름·직무는 화면 확인용 예시 값이다.
 */
const DEV_USERS: Record<Role, Omit<SessionUser, 'role'>> = {
  superAdmin: { displayName: '김관리', jobRole: 'PM' },
  operator: { displayName: '이운영', jobRole: 'FE' },
  viewer: { displayName: '박조회', jobRole: 'BE' },
};

type AuthState = {
  user: SessionUser | null;
  /** 개발용 로그인. 고른 역할의 가짜 팀원으로 들어가며, 로그인한 채로 부르면 역할만 바뀐다. */
  devLogin: (role: Role) => void;
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
      devLogin: (role) => set({ user: { role, ...DEV_USERS[role] } }),
      logout: () => set({ user: null }),
    }),
    { name: 'daeng-bo-dev-auth', storage: createJSONStorage(() => localStorage) }
  )
);
