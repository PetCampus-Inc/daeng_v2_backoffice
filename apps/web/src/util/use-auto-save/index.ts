import { useEffect, useRef, useState } from 'react';

/** 자동 저장의 진행 상태. `idle`은 아직 한 번도 시도하지 않았다는 뜻이다. */
export type AutoSaveStatus = 'idle' | 'saving' | 'saved' | 'failed';

export type AutoSaveState = { status: AutoSaveStatus; savedAt: string | null };

/** 한 번의 주기마다 화면이 알려 주는 현재 상황. */
export type AutoSaveInput = {
  /** 자동 저장을 쓸 수 있는 화면 상태인지(예: 초안 편집 중). */
  enabled: boolean;
  /** 마지막 저장 이후 바뀐 내용이 있는지. */
  hasChanged: boolean;
  /** 지금 저장해도 되는지(입력 검사 통과, 다른 요청 없음). */
  canSave: boolean;
  /** 입력 내용이 바뀔 때마다 달라지는 값. 같은 내용에서 영구 오류가 났으면 내용이 바뀔 때까지 멈춘다. */
  contentKey: unknown;
  /** 저장 요청. 실패하면 던진다. */
  save: () => Promise<void>;
  /** 다시 해도 같은 결과가 나는 오류인지. 맞으면 내용을 고치기 전까지 멈춘다. */
  isPermanentError?: (error: unknown) => boolean;
};

export const AUTO_SAVE_INTERVAL_MS = 60_000;

/** 이번 주기에 저장을 요청할지 판단한다. */
export function shouldAutoSave(check: {
  enabled: boolean;
  hasChanged: boolean;
  canSave: boolean;
  isSaving: boolean;
  isStopped: boolean;
}) {
  return check.enabled && check.canSave && check.hasChanged && !check.isSaving && !check.isStopped;
}

/**
 * 일정 주기마다 `read()`가 알려 주는 상황을 보고 저장한다. React와 무관한 타이머 본체다.
 * 일시 오류는 다음 주기에 다시 시도하고, 영구 오류는 같은 내용(`contentKey`)에서는 다시 시도하지 않는다.
 */
export function createAutoSaver({
  read,
  onState,
  intervalMs = AUTO_SAVE_INTERVAL_MS,
  now = () => new Date(),
}: {
  read: () => AutoSaveInput;
  onState: (state: AutoSaveState) => void;
  intervalMs?: number;
  now?: () => Date;
}) {
  let state: AutoSaveState = { status: 'idle', savedAt: null };
  let isSaving = false;
  let stoppedKey: { value: unknown } | null = null;
  let timer: ReturnType<typeof setInterval> | undefined;

  const update = (next: Partial<AutoSaveState>) => {
    state = { ...state, ...next };
    onState(state);
  };

  /** 한 주기를 실행한다. */
  const tick = async () => {
    const input = read();
    const isStopped = !!stoppedKey && stoppedKey.value === input.contentKey;
    if (!shouldAutoSave({ ...input, isSaving, isStopped })) return;
    isSaving = true;
    update({ status: 'saving' });
    try {
      await input.save();
      stoppedKey = null;
      update({ status: 'saved', savedAt: now().toISOString() });
    } catch (error) {
      if (input.isPermanentError?.(error)) stoppedKey = { value: input.contentKey };
      update({ status: 'failed' });
    } finally {
      isSaving = false;
    }
  };

  return {
    tick,
    start: () => {
      timer = setInterval(() => void tick(), intervalMs);
    },
    stop: () => clearInterval(timer),
  };
}

/**
 * 작성 중인 글을 `intervalMs`(기본 1분)마다 저장한다. 바뀐 내용이 있고 저장해도 될 때만 `save`를 부른다.
 * 최신 입력은 매 렌더링마다 따라가므로 호출한 쪽은 값을 그대로 넘기면 된다.
 */
export function useAutoSave(input: AutoSaveInput, intervalMs = AUTO_SAVE_INTERVAL_MS): AutoSaveState {
  const [state, setState] = useState<AutoSaveState>({ status: 'idle', savedAt: null });
  const inputRef = useRef(input);
  useEffect(() => {
    inputRef.current = input;
  });
  useEffect(() => {
    const saver = createAutoSaver({ read: () => inputRef.current, onState: setState, intervalMs });
    saver.start();
    return saver.stop;
  }, [intervalMs]);
  return state;
}
