import type { JobRole } from '@daeng/shared';

import type { Role } from '@/type/role';

/** 로그인한 팀원의 내 계정 정보. 첫 로그인 전에는 표시명·직무가 비어 있다. */
export type MyAccount = {
  email: string;
  googleName: string;
  suggestedDisplayName: string | null;
  displayName: string | null;
  jobRole: JobRole | null;
  role: Role;
  profileCompleted: boolean;
};

/** 내 계정 저장 요청. 첫 로그인 설정과 프로필 패널이 함께 쓴다. */
export type UpdateMyAccountInput = {
  displayName: string;
  jobRole: JobRole;
};
