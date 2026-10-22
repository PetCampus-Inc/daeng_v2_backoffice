/** 역할 3종(PRD 4.1). 계정당 1개다. */
export const ROLES = ['superAdmin', 'operator', 'viewer'] as const;

export type Role = (typeof ROLES)[number];

/** 화면에 보이는 역할 이름. */
export const ROLE_LABELS: Record<Role, string> = {
  superAdmin: '최고 관리자',
  operator: '운영자',
  viewer: '조회자',
};
