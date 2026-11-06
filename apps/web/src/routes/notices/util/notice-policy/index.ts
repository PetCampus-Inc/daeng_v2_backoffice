import type { RichContent } from '@/type/rich-content';
import { collectImageBlocks, countRichTextLength, getRichText as getNoticeText } from '@/util/rich-content';
import type { NoticeImageFileContentType } from '../../type';
import type { NoticeInput } from '../../type/notice-ui';

export { createRichContent as createNoticeBody, getRichText as getNoticeText } from '@/util/rich-content';

/** 서버가 이보다 긴 검색어를 400으로 거절하므로 공지 검색창에서 막는다. 공용 값(100자)과 달리 이 화면은 50자다. */
export const NOTICE_KEYWORD_MAX_LENGTH = 50;

/**
 * 제목·본문 입력을 검사한다. 제목 글자 수는 서버와 같은 내부 길이(UTF-16, `.length`)로 센다.
 * 본문 글자 수는 서버 기준으로 센다(`countRichTextLength`: 블록 사이 줄바꿈 제외, 코드포인트 단위).
 */
export function validateNotice(input: NoticeInput) {
  const titleCount = input.title.length;
  const bodyCount = countRichTextLength(input.body);
  return {
    titleCount,
    bodyCount,
    canSave: titleCount <= 50 && bodyCount <= 5000,
    canPublish:
      titleCount <= 50 &&
      bodyCount <= 5000 &&
      input.title.trim().length > 0 &&
      getNoticeText(input.body).trim().length > 0,
  };
}

/** 파일당 이미지 크기 한도(20MB, 바이트). 서버와 같다. */
export const NOTICE_IMAGE_MAX_BYTES = 20_971_520;
/** 공지 본문 하나에 넣을 수 있는 이미지 수. 서버(`MAX_IMAGES`)와 같다. */
export const NOTICE_IMAGE_MAX_COUNT = 10;
/** 업로드 주소를 한 번에 요청할 수 있는 파일 수. */
export const NOTICE_IMAGE_MAX_BATCH = 10;
/** 올릴 수 있는 이미지 형식과 서버가 요구하는 파일 확장자. HEIC·HEIF는 공지에서 제외한다. */
export const NOTICE_IMAGE_EXTENSIONS: Record<NoticeImageFileContentType, string[]> = {
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/png': ['.png'],
};
/** 파일 선택창에 거는 허용 형식. */
export const NOTICE_IMAGE_ACCEPT = Object.keys(NOTICE_IMAGE_EXTENSIONS).join(',');

/** 올릴 수 없는 형식(JPG·PNG 외, 확장자가 형식과 다른 파일 포함). */
export const NOTICE_IMAGE_TYPE_MESSAGE = 'JPG, PNG 파일만 올릴 수 있어요.';
/** 20MB 초과. */
export const NOTICE_IMAGE_SIZE_MESSAGE = '이미지는 한 장에 20MB까지 올릴 수 있어요.';
/** 크기가 0인 파일. */
export const NOTICE_IMAGE_EMPTY_MESSAGE = '비어 있는 파일은 올릴 수 없어요.';
/** 한 번에 10개 초과. */
export const NOTICE_IMAGE_BATCH_MESSAGE = '이미지는 한 번에 10장까지 올릴 수 있어요.';
/** 본문 이미지 10장 초과. */
export const NOTICE_IMAGE_COUNT_MESSAGE = '이미지는 한 공지에 10장까지 넣을 수 있어요.';

/** 이미지 파일 판정에 필요한 값만 담은 모양(브라우저 `File`도 맞는다). */
export type NoticeImageCandidate = { name: string; type: string; size: number };

/** 형식(MIME)이 JPG·PNG이고 확장자가 그 형식과 맞는지 본다. 서버가 이름과 형식이 다른 파일을 거절한다. */
export function isNoticeImageType(file: Pick<NoticeImageCandidate, 'name' | 'type'>): boolean {
  const extensions = NOTICE_IMAGE_EXTENSIONS[file.type as NoticeImageFileContentType];
  const name = file.name.toLowerCase();
  return !!extensions && extensions.some((extension) => name.endsWith(extension));
}

/**
 * 고른 파일을 서버에 묻기 전에 검사한다. 하나라도 걸리면 전부 올리지 않고 안내 문구 하나를 돌려준다.
 * 순서: 한 번에 10개 → 본문 10장 → 형식 → 빈 파일 → 20MB. 통과하면 `null`.
 */
export function checkNoticeImageFiles(files: NoticeImageCandidate[], currentImageCount: number): string | null {
  if (files.length > NOTICE_IMAGE_MAX_BATCH) return NOTICE_IMAGE_BATCH_MESSAGE;
  if (currentImageCount + files.length > NOTICE_IMAGE_MAX_COUNT) return NOTICE_IMAGE_COUNT_MESSAGE;
  if (files.some((file) => !isNoticeImageType(file))) return NOTICE_IMAGE_TYPE_MESSAGE;
  if (files.some((file) => file.size <= 0)) return NOTICE_IMAGE_EMPTY_MESSAGE;
  if (files.some((file) => file.size > NOTICE_IMAGE_MAX_BYTES)) return NOTICE_IMAGE_SIZE_MESSAGE;
  return null;
}

/**
 * 저장하려고 보낸 본문(`sent`)의 새 이미지(`tempKey`)를 저장 응답 본문(`saved`)의 `imageId`로 바꾼다.
 * 서버가 이미지를 확정하면 같은 `tempKey`를 다시 받지 않으므로, 화면 본문도 `imageId`로 맞춰야 다시 저장할 수 있다.
 * 두 본문의 이미지는 문서 순서로 짝지으며, 수가 다르면 바꾸지 않는다. 바뀐 `tempKey`→`imageId` 짝도 함께 돌려준다.
 */
export function confirmNoticeImages(
  sent: RichContent,
  saved: RichContent
): { body: RichContent; confirmed: Record<string, number> } {
  const body = structuredClone(sent);
  const confirmed: Record<string, number> = {};
  const sentImages = collectImageBlocks(body.blocks);
  const savedImages = collectImageBlocks(saved.blocks);
  if (sentImages.length !== savedImages.length) return { body: sent, confirmed };
  sentImages.forEach((image, index) => {
    const imageId = savedImages[index].imageId;
    if (typeof image.tempKey !== 'string' || typeof imageId !== 'number') return;
    confirmed[image.tempKey] = imageId;
    image.imageId = imageId;
    delete image.tempKey;
    delete image.originalFilename;
  });
  return { body, confirmed };
}
