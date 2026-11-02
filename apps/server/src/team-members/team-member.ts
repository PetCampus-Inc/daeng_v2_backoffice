import type { MemberJobRole, MemberRole, MemberRow, MemberStatus } from '../database/schema.js';

export interface TeamMember {
  id: number;
  email: string;
  displayName: string | null;
  jobRole: MemberJobRole | null;
  role: MemberRole;
  status: MemberStatus;
  lastLoginAt: string | null;
  registeredAt: string;
}

export function toTeamMember(row: MemberRow): TeamMember {
  return {
    id: row.id,
    email: row.email,
    displayName: row.displayName,
    jobRole: row.jobRole,
    role: row.role,
    status: row.status,
    lastLoginAt: row.lastLoginAt?.toISOString() ?? null,
    registeredAt: row.registeredAt.toISOString(),
  };
}
