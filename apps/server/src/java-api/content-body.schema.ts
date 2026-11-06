import { z } from 'zod';

/** 본문(블록 JSON)은 객체만 받는다. 문자열·배열·`null`은 입력 검증 오류다. */
export const contentBodySchema = z.record(z.string(), z.unknown());
