import type { JobRole } from '@daeng/shared';
import type { Role } from '@/type/role';

export type MemberStatus = 'registered' | 'active' | 'inactive' | 'cancelled';
export type TeamMember = {
  email: string;
  displayName: string | null;
  jobRole: JobRole | null;
  role: Role;
  status: MemberStatus;
  lastLoginAt: string | null;
  registeredAt: string;
};
export type RegisterMemberInput = { email: string; role: Role };
export type UpdateMemberInput = { email: string } & (
  | { action: 'changeRole'; role: Role }
  | { action: 'deactivate' | 'cancel' | 'reactivate' }
);

export const MEMBER_STATUS_LABELS: Record<MemberStatus, string> = {
  registered: '등록됨',
  active: '활성',
  inactive: '비활성',
  cancelled: '등록 취소',
};
