import type { CorsOptions } from '@nestjs/common/interfaces/external/cors-options.interface.js';

/**
 * 웹이 다른 주소의 API를 직접 부를 수 있게 허용한다(ADR 0020).
 * 허용 주소는 쓰기 요청 Origin 검사와 같은 `ALLOWED_ORIGINS`다. 목록에 없는 주소의 응답은 브라우저가 읽지 못한다.
 * 쿠키를 보내야 하므로 `credentials`를 켠다. 이때 허용 주소는 `*`가 아니라 요청한 주소 그대로 돌려준다.
 */
export function buildCorsOptions(allowedOrigins: string[]): CorsOptions {
  return {
    origin: allowedOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    allowedHeaders: ['Content-Type'],
    // 사전 요청(OPTIONS) 결과를 브라우저가 10분 동안 다시 쓰게 해 요청 수를 줄인다.
    maxAge: 600,
  };
}
