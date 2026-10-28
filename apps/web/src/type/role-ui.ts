import { Role } from '@/type/role';

/** 역할 3종(PRD 4.1). 계정당 1개다. */
export const ROLES = [Role.SUPER_ADMIN, Role.OPERATOR, Role.VIEWER] as const;

/** 화면에 보이는 역할 이름. */
export const ROLE_LABELS: Record<Role, string> = {
  SUPER_ADMIN: '최고 관리자',
  OPERATOR: '운영자',
  VIEWER: '조회자',
};
