import axios from 'axios';
import { ValidationFailedErrorCode } from '@/type/validation-failed-error-code';
import { TermsEffectiveDateErrorCode } from '../../type/terms-effective-date-error-code';
import { TermsVersionConflictErrorCode } from '../../type/terms-version-conflict-error-code';
import { TermsWithdrawNotAllowedErrorCode } from '../../type/terms-withdraw-not-allowed-error-code';
import {
  getTermDateTooSoonMessage,
  TERM_DATE_FORMAT_MESSAGE,
  TERM_DATE_DUPLICATED_MESSAGE,
  TERM_DATE_NOT_LATEST_MESSAGE,
  TERM_DATE_PAST_MESSAGE,
  TERM_DATE_REQUIRED_MESSAGE,
} from '../term-policy';

/** 약관 요청이 거절됐을 때 화면 위 빨간 박스나 토스트에 보여 줄 안내. `field`가 있으면 그 입력 칸을 가리킨다. */
export type TermErrorGuide = {
  description: string;
  isMissing: boolean;
  field?: 'date' | 'body';
};

/** 400 `VALIDATION_FAILED`: 시행일이 아닌 입력 오류(본문 오류). */
export const TERM_BODY_INVALID_MESSAGE = '본문을 확인해 주세요.';
/** 409 `TERMS_VERSION_CONFLICT`. */
export const TERM_CONFLICT_MESSAGE =
  '다른 팀원이 먼저 저장한 내용이 있습니다. 입력한 내용을 복사해 둔 뒤 새로고침해 최신 내용을 불러와 주세요.';
/** 409 `TERMS_VERSION_NOT_DRAFT`: 이미 공개된 버전. */
export const TERM_NOT_DRAFT_MESSAGE = '이미 공개된 버전이라 수정하거나 삭제할 수 없습니다. 최신 상태를 확인해 주세요.';
/** 409 `TERMS_WITHDRAW_NOT_ALLOWED`: 시행일이 지났거나 공개 상태가 아님. */
export const TERM_WITHDRAW_BLOCKED_MESSAGE =
  '시행일이 지났거나 이미 철회되어 공개를 철회할 수 없습니다. 최신 상태를 확인해 주세요.';
/** 404. */
export const TERM_MISSING_MESSAGE =
  '다른 팀원이 삭제한 초안입니다. 입력한 내용이 필요하면 복사해 둔 뒤 목록으로 이동해 주세요.';

/** 요청 오류에서 HTTP 상태와 서버 오류 코드를 읽는다. 서버 응답이 아니면 둘 다 없다. */
export function readTermError(error: unknown): {
  status?: number;
  code?: string;
} {
  if (!axios.isAxiosError<{ code?: string }>(error)) return {};
  return { status: error.response?.status, code: error.response?.data?.code };
}

/** 400 시행일 코드에 맞는 기존 시행일 검증 문구. 시행일 코드가 아니면 `null`. */
function getDateMessage(code: string | undefined, now: Date): string | null {
  switch (code) {
    case TermsEffectiveDateErrorCode.TERMS_EFFECTIVE_DATE_INVALID_FORMAT:
      return TERM_DATE_FORMAT_MESSAGE;
    case TermsEffectiveDateErrorCode.TERMS_EFFECTIVE_DATE_DUPLICATED:
      return TERM_DATE_DUPLICATED_MESSAGE;
    case TermsEffectiveDateErrorCode.TERMS_EFFECTIVE_DATE_REQUIRED:
      return TERM_DATE_REQUIRED_MESSAGE;
    case TermsEffectiveDateErrorCode.TERMS_EFFECTIVE_DATE_IN_PAST:
      return TERM_DATE_PAST_MESSAGE;
    case TermsEffectiveDateErrorCode.TERMS_EFFECTIVE_DATE_TOO_SOON:
      return getTermDateTooSoonMessage(now);
    case TermsEffectiveDateErrorCode.TERMS_EFFECTIVE_DATE_NOT_AFTER_LATEST:
      return TERM_DATE_NOT_LATEST_MESSAGE;
    default:
      return null;
  }
}

/**
 * 서버가 거절한 이유(400·404·409)에 맞는 안내를 고른다. 그 밖의 오류(500·네트워크 등)는 `null`이라
 * 호출한 쪽이 일시적 오류 토스트를 띄운다. 400은 시행일 코드면 시행일 칸 안내, `VALIDATION_FAILED`면 본문 안내다.
 */
export function getTermErrorGuide(
  status: number | undefined,
  code: string | undefined,
  now = new Date()
): TermErrorGuide | null {
  if (status === 400) {
    const dateMessage = getDateMessage(code, now);
    if (dateMessage) return { description: dateMessage, isMissing: false, field: 'date' };
    if (code === ValidationFailedErrorCode.VALIDATION_FAILED) {
      return {
        description: TERM_BODY_INVALID_MESSAGE,
        isMissing: false,
        field: 'body',
      };
    }
    return null;
  }
  if (status === 404) return { description: TERM_MISSING_MESSAGE, isMissing: true };
  if (status === 409) {
    if (code === TermsVersionConflictErrorCode.TERMS_VERSION_CONFLICT) {
      return { description: TERM_CONFLICT_MESSAGE, isMissing: false };
    }
    if (code === TermsWithdrawNotAllowedErrorCode.TERMS_WITHDRAW_NOT_ALLOWED) {
      return { description: TERM_WITHDRAW_BLOCKED_MESSAGE, isMissing: false };
    }
    return { description: TERM_NOT_DRAFT_MESSAGE, isMissing: false };
  }
  return null;
}
