import type { Logger } from '@nestjs/common';
import { retry } from '../common/retry.js';
import type { DatabaseService } from '../database/database.service.js';
import { isTransientDatabaseError } from '../database/errors.js';
import { recordChange, type ChangeLogInput } from './record.js';

const RETRY_DELAYS_MS = [100, 300] as const;

/**
 * 이미 반영된 외부 쓰기 뒤에 변경 이력을 남긴다. 일시적인 DB 오류는 짧게 다시 시도하고, 끝내 실패하면 쓰기를 되돌리거나
 * 다시 보내지 않고 수동 보완에 필요한 값만 로그로 남긴다.
 */
export async function recordChangeBestEffort(
  database: DatabaseService,
  logger: Logger,
  input: ChangeLogInput
): Promise<void> {
  try {
    await retry(() => database.db.transaction((tx) => recordChange(tx, input)), {
      delaysMs: RETRY_DELAYS_MS,
      shouldRetry: isTransientDatabaseError,
    });
  } catch (cause) {
    logger.error(
      `변경 이력 수동 보완 필요: ${JSON.stringify({ actorMemberId: input.actor.id, target: input.target, action: input.action })}`,
      cause instanceof Error ? cause.stack : String(cause)
    );
  }
}
