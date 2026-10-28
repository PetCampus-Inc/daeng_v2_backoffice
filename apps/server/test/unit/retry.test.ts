import { describe, expect, test } from 'vitest';
import { retry } from '../../src/common/retry.js';

const fakeSleep = () => {
  const waited: number[] = [];
  return { waited, sleep: async (ms: number) => void waited.push(ms) };
};

describe('retry', () => {
  test('returns the first result without waiting when the first attempt works', async () => {
    const { waited, sleep } = fakeSleep();
    let calls = 0;

    const result = await retry(async () => ++calls, { delaysMs: [10, 20], sleep });

    expect(result).toBe(1);
    expect(waited).toEqual([]);
  });

  test('retries after each failure with the given delays and returns the first success', async () => {
    const { waited, sleep } = fakeSleep();
    let calls = 0;

    const result = await retry(
      async () => {
        calls += 1;
        if (calls < 3) throw new Error(`fail ${calls}`);
        return 'ok';
      },
      { delaysMs: [10, 20], sleep }
    );

    expect(result).toBe('ok');
    expect(calls).toBe(3);
    expect(waited).toEqual([10, 20]);
  });

  test('tries once plus one per delay, then throws the last error', async () => {
    const { waited, sleep } = fakeSleep();
    let calls = 0;

    await expect(
      retry(
        async () => {
          throw new Error(`fail ${++calls}`);
        },
        { delaysMs: [10, 20], sleep }
      )
    ).rejects.toThrow('fail 3');

    expect(calls).toBe(3);
    expect(waited).toEqual([10, 20]);
  });

  test('an error that is not worth retrying is thrown at once, without waiting', async () => {
    const { waited, sleep } = fakeSleep();
    let calls = 0;

    await expect(
      retry(
        async () => {
          calls += 1;
          throw new Error('permanent');
        },
        { delaysMs: [10, 20], sleep, shouldRetry: (error) => (error as Error).message !== 'permanent' }
      )
    ).rejects.toThrow('permanent');

    expect(calls).toBe(1);
    expect(waited).toEqual([]);
  });

  test('keeps retrying while the error is worth retrying, then stops at one that is not', async () => {
    const { waited, sleep } = fakeSleep();
    let calls = 0;

    await expect(
      retry(
        async () => {
          calls += 1;
          throw new Error(calls < 2 ? 'transient' : 'permanent');
        },
        { delaysMs: [10, 20], sleep, shouldRetry: (error) => (error as Error).message === 'transient' }
      )
    ).rejects.toThrow('permanent');

    expect(calls).toBe(2);
    expect(waited).toEqual([10]);
  });

  test('without delays it tries only once', async () => {
    const { sleep } = fakeSleep();
    let calls = 0;

    await expect(
      retry(
        async () => {
          calls += 1;
          throw new Error('fail');
        },
        { delaysMs: [], sleep }
      )
    ).rejects.toThrow('fail');

    expect(calls).toBe(1);
  });
});
