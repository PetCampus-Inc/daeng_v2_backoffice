import { HttpException } from '@nestjs/common';

export interface ValidationErrorDetail {
  field: string;
  reason: string;
}

export interface ApiErrorBody {
  code: string;
  message: string;
  details?: ValidationErrorDetail[];
}

/** 명세의 에러 코드를 가진 도메인 예외. 응답 본문은 `{ code, message }`다. */
export class ApiException extends HttpException {
  constructor(status: number, code: string, message: string) {
    super({ code, message } satisfies ApiErrorBody, status);
  }
}

export class ValidationFailedException extends ApiException {
  readonly details: ValidationErrorDetail[];

  constructor(details: ValidationErrorDetail[]) {
    super(400, 'VALIDATION_FAILED', '입력값이 올바르지 않습니다.');
    this.details = details;
  }
}
