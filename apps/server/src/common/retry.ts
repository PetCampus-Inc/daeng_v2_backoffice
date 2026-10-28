export interface RetryOptions {
  /** 실패할 때마다 다음 시도 전에 기다리는 시간. 시도 횟수는 이 길이 + 1이다. */
  delaysMs: readonly number[];
  /** 시험에서 기다림을 대신하려고 바꿀 수 있다. */
  sleep?: (ms: number) => Promise<void>;
}

const wait = (ms: number) => new Promise<void>((done) => setTimeout(done, ms));

/** 실패하면 정해진 간격으로 다시 시도하고, 모두 실패하면 마지막 오류를 던진다. */
export async function retry<T>(run: () => Promise<T>, options: RetryOptions): Promise<T> {
  const sleep = options.sleep ?? wait;
  for (const delayMs of options.delaysMs) {
    try {
      return await run();
    } catch {
      await sleep(delayMs);
    }
  }
  return run();
}
