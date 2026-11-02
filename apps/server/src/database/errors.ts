const MYSQL_DUPLICATE_ENTRY = 1062;

/**
 * 유니크 인덱스 위반(`ER_DUP_ENTRY`)인지 확인한다. drizzle이 mysql2 에러를 한 겹 감싸므로 원인까지 따라간다.
 * `indexName`을 주면 그 인덱스가 걸렸을 때만 참이다(`Duplicate entry '...' for key 'member.<인덱스>'`).
 */
export function isDuplicateEntry(error: unknown, indexName?: string): boolean {
  for (let current = error; current instanceof Error; current = current.cause) {
    const { errno, sqlMessage } = current as { errno?: number; sqlMessage?: string };
    if (errno === MYSQL_DUPLICATE_ENTRY && (indexName === undefined || sqlMessage?.endsWith(`.${indexName}'`)))
      return true;
  }
  return false;
}

/** 잠시 뒤 다시 하면 성공할 수 있는 연결·잠금 오류의 코드(mysql2의 `code`). */
const TRANSIENT_CODES = new Set([
  'PROTOCOL_CONNECTION_LOST',
  'ECONNRESET',
  'ECONNREFUSED',
  'ETIMEDOUT',
  'EPIPE',
  'ER_LOCK_DEADLOCK',
  'ER_LOCK_WAIT_TIMEOUT',
]);

/**
 * 연결 끊김, 교착, 잠금 대기 초과처럼 다시 해 볼 만한 오류인지 확인한다. 같은 요청이 같은 이유로 또 실패하는
 * 오류(중복 키, 잘못된 값, 코드 오류)는 거짓이다. drizzle이 mysql2 에러를 감싸므로 원인까지 따라간다.
 */
export function isTransientDatabaseError(error: unknown): boolean {
  for (let current = error; current instanceof Error; current = current.cause) {
    const { code } = current as { code?: unknown };
    if (typeof code === 'string' && TRANSIENT_CODES.has(code)) return true;
  }
  return false;
}
