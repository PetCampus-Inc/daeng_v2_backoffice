import { type PipeTransform } from '@nestjs/common';
import type { ZodType } from 'zod';
import { ValidationFailedException } from './api-error.js';

export class ZodValidationPipe<T> implements PipeTransform<unknown, T> {
  constructor(private readonly schema: ZodType<T>) {}

  transform(value: unknown): T {
    const result = this.schema.safeParse(value);
    if (result.success) return result.data;
    throw new ValidationFailedException(
      result.error.issues.map((issue) => ({ field: issue.path.join('.'), reason: issue.message }))
    );
  }
}
