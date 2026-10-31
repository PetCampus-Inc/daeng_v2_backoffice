import { z } from 'zod';
import { CHANGE_TARGET_TYPES } from './record.js';

const date = z.iso.date();

export const changeLogsQuerySchema = z
  .object({
    from: date.optional(),
    to: date.optional(),
    actorId: z.coerce.number().int().positive().max(Number.MAX_SAFE_INTEGER).optional(),
    targetType: z.enum(CHANGE_TARGET_TYPES).optional(),
    page: z.coerce.number().int().min(1).default(1),
    size: z.coerce.number().int().min(1).max(100).default(20),
  })
  .refine((query) => !query.from || !query.to || query.from <= query.to, {
    message: '시작일은 종료일보다 늦을 수 없습니다.',
    path: ['from'],
  });

export type ChangeLogsQuery = z.infer<typeof changeLogsQuerySchema>;
