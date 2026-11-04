import axios from 'axios';
import { ValidationFailedErrorCode } from '@/type/validation-failed-error-code';
import {
  NoticeContentRequiredErrorCode,
  NoticeNotDraftErrorCode,
  NoticeNotPublishedErrorCode,
  NoticePublishConflictErrorCode,
  NoticeVersionConflictErrorCode,
} from '../../type';

/** 공지 저장·게시 요청이 거절됐을 때 화면 위 빨간 박스에 보여 줄 안내. */
export type NoticeErrorGuide = { description: string; isMissing: boolean };

/** 400 `NOTICE_CONTENT_REQUIRED`: 제목 또는 본문이 비어 있음. */
export const NOTICE_EMPTY_MESSAGE = '제목과 본문을 모두 입력해야 게시할 수 있습니다.';
/** 400 `VALIDATION_FAILED`: 제목·본문 길이 초과 등. */
export const NOTICE_TOO_LONG_MESSAGE = '제목은 50자, 본문은 5,000자까지 입력할 수 있습니다. 글자 수를 확인해 주세요.';
/** 409 `NOTICE_VERSION_CONFLICT`. */
export const NOTICE_CONFLICT_MESSAGE =
  '다른 팀원이 먼저 저장한 내용이 있습니다. 입력한 내용을 복사해 둔 뒤 새로고침해 최신 내용을 불러와 주세요.';
/** 409 `NOTICE_NOT_DRAFT`. */
export const NOTICE_NOT_DRAFT_MESSAGE = '초안이 아닌 공지입니다. 최신 상태를 확인해 주세요.';
/** 409 `NOTICE_NOT_PUBLISHED`. */
export const NOTICE_NOT_PUBLISHED_MESSAGE = '이미 게시가 해제된 공지입니다. 최신 상태를 확인해 주세요.';
/** 409 `NOTICE_ALREADY_PUBLISHED`. */
export const NOTICE_PUBLISHED_MESSAGE = '이미 게시된 공지입니다. 최신 상태를 확인해 주세요.';
/** 404. */
export const NOTICE_MISSING_MESSAGE =
  '다른 팀원이 삭제한 초안입니다. 입력한 내용이 필요하면 복사해 둔 뒤 목록으로 이동해 주세요.';

/** 요청 오류에서 HTTP 상태와 서버 오류 코드를 읽는다. 서버 응답이 아니면 둘 다 없다. */
export function readNoticeError(error: unknown): {
  status?: number;
  code?: string;
} {
  if (!axios.isAxiosError<{ code?: string }>(error)) return {};
  return { status: error.response?.status, code: error.response?.data?.code };
}

/**
 * 서버가 거절한 이유(400·404·409)에 맞는 안내를 고른다. 그 밖의 오류(500·네트워크 등)는 `null`이라
 * 호출한 쪽이 일시적 오류 토스트를 띄운다.
 */
export function getNoticeErrorGuide(status: number | undefined, code: string | undefined): NoticeErrorGuide | null {
  if (status === 400) {
    if (code === NoticeContentRequiredErrorCode.NOTICE_CONTENT_REQUIRED) {
      return { description: NOTICE_EMPTY_MESSAGE, isMissing: false };
    }
    if (code === ValidationFailedErrorCode.VALIDATION_FAILED) {
      return { description: NOTICE_TOO_LONG_MESSAGE, isMissing: false };
    }
    return null;
  }
  if (status === 404) return { description: NOTICE_MISSING_MESSAGE, isMissing: true };
  if (status === 409) {
    if (code === NoticeVersionConflictErrorCode.NOTICE_VERSION_CONFLICT) {
      return { description: NOTICE_CONFLICT_MESSAGE, isMissing: false };
    }
    if (code === NoticeNotDraftErrorCode.NOTICE_NOT_DRAFT) {
      return { description: NOTICE_NOT_DRAFT_MESSAGE, isMissing: false };
    }
    if (code === NoticeNotPublishedErrorCode.NOTICE_NOT_PUBLISHED) {
      return { description: NOTICE_NOT_PUBLISHED_MESSAGE, isMissing: false };
    }
    if (code === NoticePublishConflictErrorCode.NOTICE_ALREADY_PUBLISHED) {
      return { description: NOTICE_PUBLISHED_MESSAGE, isMissing: false };
    }
  }
  return null;
}
