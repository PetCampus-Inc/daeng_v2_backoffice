import { z } from 'zod';
import { ApiException } from '../common/api-error.js';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';
import { TERMS_KINDS } from './terms.types.js';

export const kindPipe = new ZodValidationPipe(z.enum(TERMS_KINDS), 'kind');

const date = z.iso.date();
export const createTermsSchema = z.object({ effectiveDate: date, content: z.string() });
export const updateTermsSchema = z.object({
  effectiveDate: date.optional(),
  content: z.string().optional(),
  version: z.number().int().nonnegative(),
});
export const termsVersionSchema = z.object({ version: z.number().int().nonnegative() });

/** 시행일 형식 오류는 일반 검증 오류가 아니라 명세의 전용 코드로 알린다. */
export class TermsBodyPipe<T> extends ZodValidationPipe<T> {
  override transform(value: unknown): T {
    if (
      typeof value === 'object' &&
      value !== null &&
      'effectiveDate' in value &&
      !date.safeParse(value.effectiveDate).success
    )
      throw new ApiException(400, 'TERMS_EFFECTIVE_DATE_INVALID_FORMAT', '시행일 형식이 올바르지 않습니다.');
    return super.transform(value);
  }
}
