import type { RichContent } from '@/type/rich-content';
import type { ImageUploadRule } from '@/util/image-upload-rule';
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

/**
 * 공지 본문 이미지 규칙 값. 판정은 공용 편집기가 한다.
 * 용량은 서버와 같은 20MB(바이트), 개수는 서버(`MAX_IMAGES`)와 같은 본문당 10장이다.
 * 허용 형식은 서버가 요구하는 파일 확장자를 함께 준다. HEIC·HEIF는 공지에서 제외한다.
 */
export const NOTICE_IMAGE_RULE: ImageUploadRule = {
  allowedTypes: {
    'image/jpeg': ['.jpg', '.jpeg'],
    'image/png': ['.png'],
  } satisfies Record<NoticeImageFileContentType, string[]>,
  typeLabel: 'JPG·PNG',
  maxBytes: 20_971_520,
  maxCount: 10,
};

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
