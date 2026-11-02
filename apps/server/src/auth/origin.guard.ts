import { type CanActivate, type ExecutionContext, Inject, Injectable } from '@nestjs/common';
import { ApiException } from '../common/api-error.js';
import { AUTH_CONFIG, type AuthConfig } from './auth.constants.js';
import type { AuthRequest } from './request.js';

const WRITE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/**
 * 쓰기 요청의 `Origin`이 허용된 웹 주소가 아니거나 없으면 403이다(CSRF 방어, ADR 0014).
 * 읽기 요청에는 적용하지 않는다. http·https 가리지 않고 주소 문자열을 그대로 비교한다.
 */
@Injectable()
export class OriginGuard implements CanActivate {
  constructor(@Inject(AUTH_CONFIG) private readonly config: AuthConfig) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<AuthRequest>();
    if (!WRITE_METHODS.has(request.method.toUpperCase())) return true;
    const origin = request.headers.origin;
    if (typeof origin !== 'string' || !this.config.allowedOrigins.includes(origin)) {
      throw new ApiException(403, 'FORBIDDEN', '이 기능을 사용할 권한이 없습니다.');
    }
    return true;
  }
}
