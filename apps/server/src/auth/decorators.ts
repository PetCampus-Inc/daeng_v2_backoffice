import { createParamDecorator, type ExecutionContext, SetMetadata } from '@nestjs/common';
import { ApiException } from '../common/api-error.js';
import type { MemberRole, MemberRow } from '../database/schema.js';
import type { AuthRequest } from './request.js';

export const IS_PUBLIC = 'auth:isPublic';
export const ALLOW_INCOMPLETE_PROFILE = 'auth:allowIncompleteProfile';
export const REQUIRED_ROLES = 'auth:requiredRoles';

/** 로그인하지 않아도 부를 수 있는 API. 나머지는 기본이 로그인 필수다. */
export const Public = () => SetMetadata(IS_PUBLIC, true);

/** 첫 로그인 프로필을 완료하기 전에도 부를 수 있는 API(`/me`, 프로필 저장, 로그아웃). */
export const AllowIncompleteProfile = () => SetMetadata(ALLOW_INCOMPLETE_PROFILE, true);

/** 접근 가능한 역할. AuthGuard가 팀원을 확인한 다음 RoleGuard가 검사한다. */
export const Roles = (...roles: MemberRole[]) => SetMetadata(REQUIRED_ROLES, roles);

/** 로그인한 팀원. 가드를 통과한 요청에만 있으므로 `@Public()` API에서는 쓰지 않는다. */
export const CurrentMember = createParamDecorator((_data: unknown, context: ExecutionContext): MemberRow => {
  const { member } = context.switchToHttp().getRequest<AuthRequest>();
  if (!member) throw new ApiException(401, 'UNAUTHENTICATED', '로그인이 필요합니다.');
  return member;
});
