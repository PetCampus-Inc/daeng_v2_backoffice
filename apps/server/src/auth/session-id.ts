import { createHash, randomBytes } from 'node:crypto';

/** 추측할 수 없는 무작위 값(256비트). */
export function generateSessionId(): string {
  return randomBytes(32).toString('base64url');
}

/** DB에는 해시만 저장해서, DB가 노출돼도 세션을 그대로 쓸 수 없게 한다. */
export function hashSessionId(sessionId: string): string {
  return createHash('sha256').update(sessionId).digest('hex');
}
