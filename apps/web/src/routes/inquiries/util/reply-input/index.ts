import { countCharacters } from '@/util/profile';

/** 답변 최대 글자 수(PRD 6.2). */
export const REPLY_MAX_LENGTH = 500;

/** 500자를 넘으면 줄일 글자 수 안내를, 아니면 null을 준다. 입력은 자르지 않는다. */
export function getReplyLengthError(value: string) {
  const overflow = countCharacters(value) - REPLY_MAX_LENGTH;
  return overflow > 0 ? `답변은 ${REPLY_MAX_LENGTH}자까지 입력할 수 있습니다. ${overflow}자를 줄여 주세요.` : null;
}

/** [답변 저장] 활성 조건: 공백·줄바꿈만이 아니고 500자 이하이며 저장 요청 중이 아닐 때. */
export function canSubmitReply(value: string, isPending: boolean) {
  return !isPending && value.trim().length > 0 && countCharacters(value) <= REPLY_MAX_LENGTH;
}
