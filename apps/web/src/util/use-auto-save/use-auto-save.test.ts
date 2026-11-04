import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { createAutoSaver, shouldAutoSave, type AutoSaveInput, type AutoSaveState } from '.';

const base = { enabled: true, hasChanged: true, canSave: true, isSaving: false, isStopped: false };

describe('shouldAutoSave', () => {
  test.each([
    ['바뀐 내용이 있고 저장해도 된다', {}, true],
    ['바뀐 내용이 없다', { hasChanged: false }, false],
    ['저장 요청이 진행 중이다', { isSaving: true }, false],
    ['자동 저장을 쓸 수 없는 화면이다', { enabled: false }, false],
    ['저장할 수 없는 입력이다', { canSave: false }, false],
    ['영구 오류로 멈췄다', { isStopped: true }, false],
  ])('%s', (_name, change, expected) => {
    expect(shouldAutoSave({ ...base, ...change })).toBe(expected);
  });
});

describe('createAutoSaver', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  /** 가짜 화면 상황으로 자동 저장기를 만든다. */
  const setup = (override: Partial<AutoSaveInput> = {}) => {
    const save = vi.fn<() => Promise<void>>().mockResolvedValue(undefined);
    const input: AutoSaveInput = { enabled: true, hasChanged: true, canSave: true, contentKey: 'a', save, ...override };
    const states: AutoSaveState[] = [];
    const saver = createAutoSaver({ read: () => input, onState: (state) => states.push(state), intervalMs: 60_000 });
    saver.start();
    return { input, save, states, saver };
  };

  test('1분이 지나기 전에는 저장하지 않고, 지나면 저장한다', async () => {
    const { save, states } = setup();
    await vi.advanceTimersByTimeAsync(59_999);
    expect(save).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(save).toHaveBeenCalledTimes(1);
    expect(states.at(-1)?.status).toBe('saved');
    expect(states.at(-1)?.savedAt).not.toBeNull();
  });

  test('바뀐 내용이 없으면 저장 요청을 하지 않는다', async () => {
    const { save } = setup({ hasChanged: false });
    await vi.advanceTimersByTimeAsync(180_000);
    expect(save).not.toHaveBeenCalled();
  });

  test('저장 중에 다음 주기가 와도 겹쳐 저장하지 않는다', async () => {
    let finish: () => void = () => undefined;
    const save = vi.fn(() => new Promise<void>((resolve) => (finish = resolve)));
    setup({ save });
    await vi.advanceTimersByTimeAsync(120_000);
    expect(save).toHaveBeenCalledTimes(1);
    finish();
  });

  test('일시 오류는 실패로 표시하고 다음 주기에 다시 시도한다', async () => {
    const save = vi.fn<() => Promise<void>>().mockRejectedValueOnce(new Error('network')).mockResolvedValue(undefined);
    const { states } = setup({ save, isPermanentError: () => false });
    await vi.advanceTimersByTimeAsync(60_000);
    expect(states.at(-1)?.status).toBe('failed');
    await vi.advanceTimersByTimeAsync(60_000);
    expect(save).toHaveBeenCalledTimes(2);
    expect(states.at(-1)?.status).toBe('saved');
  });

  test('영구 오류는 내용을 고치기 전까지 다시 시도하지 않고, 고치면 다시 시도한다', async () => {
    const save = vi.fn<() => Promise<void>>().mockRejectedValue(new Error('conflict'));
    const { input, states } = setup({ save, isPermanentError: () => true });
    await vi.advanceTimersByTimeAsync(180_000);
    expect(save).toHaveBeenCalledTimes(1);
    expect(states.at(-1)?.status).toBe('failed');
    input.contentKey = 'b';
    await vi.advanceTimersByTimeAsync(60_000);
    expect(save).toHaveBeenCalledTimes(2);
  });

  test('멈추면 더 이상 저장하지 않는다', async () => {
    const { save, saver } = setup();
    saver.stop();
    await vi.advanceTimersByTimeAsync(120_000);
    expect(save).not.toHaveBeenCalled();
  });
});
