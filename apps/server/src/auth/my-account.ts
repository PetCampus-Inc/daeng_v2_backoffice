import type { MemberJobRole, MemberRole, MemberRow } from '../database/schema.js';

export interface MyAccount {
  id: number;
  email: string;
  googleName: string;
  displayName: string | null;
  jobRole: MemberJobRole | null;
  role: MemberRole;
  isProfileCompleted: boolean;
}

export function isProfileCompleted(member: Pick<MemberRow, 'displayName' | 'jobRole'>): boolean {
  return member.displayName !== null && member.jobRole !== null;
}

export function toMyAccount(member: MemberRow): MyAccount {
  return {
    id: member.id,
    email: member.email,
    googleName: member.googleName ?? member.email,
    displayName: member.displayName,
    jobRole: member.jobRole,
    role: member.role,
    isProfileCompleted: isProfileCompleted(member),
  };
}
