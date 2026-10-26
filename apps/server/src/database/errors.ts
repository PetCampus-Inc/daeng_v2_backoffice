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
