import { z } from 'zod';
import { ApiException } from '../common/api-error.js';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';
import { contentBodySchema } from '../java-api/content-body.schema.js';
import { TERMS_KINDS } from './terms.types.js';

export const kindPipe = new ZodValidationPipe(z.enum(TERMS_KINDS), 'kind');

const date = z.iso.date();
export const createTermsSchema = z.object({ effectiveDate: date.nullish(), content: contentBodySchema });
export const updateTermsSchema = z.object({
  effectiveDate: date.nullable().optional(),
  content: contentBodySchema.optional(),
  version: z.number().int().nonnegative(),
});
export const termsVersionSchema = z.object({ version: z.number().int().nonnegative() });
/** 본문이 없는 DELETE 요청은 `version`을 쿼리로 받는다. */
export const termsVersionQuerySchema = z.object({ version: z.coerce.number().int().nonnegative() });

/** 시행일 형식 오류는 일반 검증 오류가 아니라 명세의 전용 코드로 알린다. */
export class TermsBodyPipe<T> extends ZodValidationPipe<T> {
  override transform(value: unknown): T {
    if (
      typeof value === 'object' &&
      value !== null &&
      'effectiveDate' in value &&
      value.effectiveDate !== null &&
      !date.safeParse(value.effectiveDate).success
    )
      throw new ApiException(400, 'TERMS_EFFECTIVE_DATE_INVALID_FORMAT', '시행일 형식이 올바르지 않습니다.');
    return super.transform(value);
  }
}
