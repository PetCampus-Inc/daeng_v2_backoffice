import { z } from 'zod';
import { ZodValidationPipe } from './zod-validation.pipe.js';

/** 경로의 양의 정수 ID. JS 안전 정수를 넘으면 정밀도를 잃으므로 거부한다. */
export const idPipe = new ZodValidationPipe(z.coerce.number().int().positive().max(Number.MAX_SAFE_INTEGER), 'id');
