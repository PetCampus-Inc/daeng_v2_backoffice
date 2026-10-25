import { type ArgumentsHost, Catch, type ExceptionFilter, HttpException, Logger } from '@nestjs/common';
import { type ApiErrorBody, ApiException, ValidationFailedException } from './api-error.js';

interface JsonResponse {
  status(code: number): { json(body: unknown): void };
}

const STATUS_CODES: Record<number, { code: string; message: string }> = {
  400: { code: 'BAD_REQUEST', message: '잘못된 요청입니다.' },
  401: { code: 'UNAUTHENTICATED', message: '로그인이 필요합니다.' },
  403: { code: 'FORBIDDEN', message: '이 기능을 사용할 권한이 없습니다.' },
  404: { code: 'NOT_FOUND', message: '요청한 대상을 찾을 수 없습니다.' },
};

const INTERNAL_ERROR: ApiErrorBody = { code: 'INTERNAL_ERROR', message: '서버에 문제가 생겼습니다.' };

/** Nest 예외뿐 아니라 Express 본문 파서가 던지는 `status` 달린 오류(413 등)도 읽는다. */
function statusOf(exception: unknown): number | undefined {
  if (exception instanceof HttpException) return exception.getStatus();
  if (typeof exception === 'object' && exception !== null) {
    const { status, statusCode } = exception as { status?: unknown; statusCode?: unknown };
    if (typeof status === 'number') return status;
    if (typeof statusCode === 'number') return statusCode;
  }
  return undefined;
}

export function toErrorResponse(exception: unknown): { status: number; body: ApiErrorBody } {
  if (exception instanceof ValidationFailedException) {
    const { code, message } = exception.getResponse() as ApiErrorBody;
    return { status: exception.getStatus(), body: { code, message, details: exception.details } };
  }
  if (exception instanceof ApiException) {
    return { status: exception.getStatus(), body: exception.getResponse() as ApiErrorBody };
  }
  const status = statusOf(exception);
  if (status !== undefined && status >= 400 && status < 500) {
    return { status, body: STATUS_CODES[status] ?? STATUS_CODES[400]! };
  }
  return { status: 500, body: INTERNAL_ERROR };
}

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(ApiExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const { status, body } = toErrorResponse(exception);
    if (status >= 500) this.logger.error(exception instanceof Error ? exception.stack : String(exception));
    host.switchToHttp().getResponse<JsonResponse>().status(status).json(body);
  }
}
