import { z } from 'zod';

/** 블록 JSON 객체만 받는다. 블록 규칙·글자 수·이미지는 Java가 검증한다. */
export const contentBodySchema = z.record(z.string(), z.unknown());
export type ContentBody = z.infer<typeof contentBodySchema>;
