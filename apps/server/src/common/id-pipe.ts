import { z } from 'zod';
import { ZodValidationPipe } from './zod-validation.pipe.js';

/** 경로의 양의 정수 ID. */
export const idPipe = new ZodValidationPipe(z.coerce.number().int().positive(), 'id');
