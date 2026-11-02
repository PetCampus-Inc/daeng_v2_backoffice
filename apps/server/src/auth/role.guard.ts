import { type CanActivate, type ExecutionContext, Inject, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ApiException } from '../common/api-error.js';
import type { MemberRole } from '../database/schema.js';
import { AccessLogService } from './access-log.service.js';
import { REQUIRED_ROLES } from './decorators.js';
import type { AuthRequest } from './request.js';

@Injectable()
export class RoleGuard implements CanActivate {
  constructor(
    @Inject(Reflector) private readonly reflector: Reflector,
    @Inject(AccessLogService) private readonly accessLog: AccessLogService
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const roles = this.reflector.getAllAndOverride<MemberRole[] | undefined>(REQUIRED_ROLES, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!roles?.length) return true;

    const member = context.switchToHttp().getRequest<AuthRequest>().member;
    if (!member) throw new ApiException(401, 'UNAUTHENTICATED', '로그인이 필요합니다.');
    if (roles.includes(member.role)) return true;

    await this.accessLog.record({ event: 'ACCESS_DENIED', result: 'FORBIDDEN', email: member.email });
    throw new ApiException(403, 'FORBIDDEN', '이 기능을 사용할 권한이 없습니다.');
  }
}
