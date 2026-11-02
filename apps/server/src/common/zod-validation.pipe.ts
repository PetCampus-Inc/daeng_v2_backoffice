import { type PipeTransform } from '@nestjs/common';
import { z, type ZodType } from 'zod';
import { ValidationFailedException } from './api-error.js';

export class ZodValidationPipe<T> implements PipeTransform<unknown, T> {
  constructor(
    private readonly schema: ZodType<T>,
    private readonly fieldName?: string
  ) {}

  transform(value: unknown): T {
    const result = this.schema.safeParse(value, { error: z.locales.ko().localeError });
    if (result.success) return result.data;
    throw new ValidationFailedException(
      result.error.issues.map((issue) => ({
        field: [this.fieldName, ...issue.path].filter((part) => part !== undefined).join('.'),
        reason: issue.message,
      }))
    );
  }
}
