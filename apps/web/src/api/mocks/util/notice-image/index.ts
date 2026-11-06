import type { ContentBody } from '@/type/content-body';
import { collectImageBlocks } from '@/util/rich-content';

/** 서버 규칙: 본문 이미지 최대 10개, 업로드 요청 최대 10개, 파일당 20MB, JPEG·PNG만. */
export const MOCK_NOTICE_IMAGE_MAX = 10;
export const MOCK_NOTICE_IMAGE_MAX_BYTES = 20_971_520;
/** 업로드 주소 발급이 돌려주는 임시 키의 접두어. 서버 규칙(`TEMP_PREFIX`)과 같다. */
export const MOCK_TEMP_KEY_PREFIX = 'platform-content-temp/notice/';

/** 가짜 서버가 확정해 둔 공지 이미지. */
export type MockNoticeImage = { id: number; noticeId: number; originalFilename: string };

/** 가짜 서버의 이미지 저장소. 올렸지만 아직 확정하지 않은 임시 키와 이미 쓴 임시 키를 따로 센다. */
export type MockImageStore = {
  images: MockNoticeImage[];
  uploadedTempKeys: string[];
  usedTempKeys: string[];
  lastImageId: number;
};

export const createEmptyImageStore = (): MockImageStore => ({
  images: [],
  uploadedTempKeys: [],
  usedTempKeys: [],
  lastImageId: 0,
});

const EXTENSIONS: Record<string, string[]> = { 'image/jpeg': ['.jpg', '.jpeg'], 'image/png': ['.png'] };

/** 업로드 주소 발급 요청의 파일 한 개가 서버 규칙(형식·확장자 일치·1바이트 이상 20MB 이하)을 지키는지 본다. */
const isValidImageFile = (file: unknown): boolean => {
  if (typeof file !== 'object' || file === null) return false;
  const { fileName, contentType, size } = file as { fileName?: unknown; contentType?: unknown; size?: unknown };
  if (typeof fileName !== 'string' || typeof contentType !== 'string' || typeof size !== 'number') return false;
  const lower = fileName.toLowerCase();
  const matches = (EXTENSIONS[contentType] ?? []).some((extension) => lower.endsWith(extension));
  return matches && Number.isInteger(size) && size > 0 && size <= MOCK_NOTICE_IMAGE_MAX_BYTES;
};

/**
 * 업로드 주소 발급 요청이 서버 규칙을 지키는지 본다. 파일은 1~10개, 공지 번호가 있으면 있는 공지여야 한다.
 * 어기면 400 `NOTICE_IMAGE_INVALID`다.
 */
export function isValidUploadRequest(input: unknown, hasNotice: (noticeId: number) => boolean): boolean {
  if (typeof input !== 'object' || input === null) return false;
  const { noticeId, files } = input as { noticeId?: unknown; files?: unknown };
  if (noticeId !== undefined) {
    if (typeof noticeId !== 'number' || !Number.isSafeInteger(noticeId) || noticeId < 1 || !hasNotice(noticeId)) {
      return false;
    }
  }
  return (
    Array.isArray(files) && files.length >= 1 && files.length <= MOCK_NOTICE_IMAGE_MAX && files.every(isValidImageFile)
  );
}

/** 저장할 본문의 이미지를 서버 규칙대로 확정한다. 규칙을 어기면 `null`이고, 저장소는 바뀌지 않는다. */
export function attachNoticeImages(
  body: ContentBody,
  noticeId: number,
  store: MockImageStore
): { body: ContentBody; store: MockImageStore } | null {
  const next = structuredClone(body);
  if (!Array.isArray(next.blocks)) return { body: next, store };
  const images = collectImageBlocks(next.blocks);
  if (images.length > MOCK_NOTICE_IMAGE_MAX) return null;

  const tempKeys = new Set<string>();
  const pending: Record<string, unknown>[] = [];
  for (const image of images) {
    // 주소는 서버가 조회 때 채우므로 받은 값은 버린다.
    delete image.url;
    delete image.unavailable;
    if (!('tempKey' in image)) {
      if ('originalFilename' in image) return null;
      continue;
    }
    const { tempKey, originalFilename } = image;
    if (
      'imageId' in image ||
      typeof tempKey !== 'string' ||
      typeof originalFilename !== 'string' ||
      originalFilename.trim() === '' ||
      tempKeys.has(tempKey) ||
      !tempKey.startsWith(MOCK_TEMP_KEY_PREFIX) ||
      !store.uploadedTempKeys.includes(tempKey) ||
      store.usedTempKeys.includes(tempKey)
    ) {
      return null;
    }
    tempKeys.add(tempKey);
    pending.push(image);
  }

  let lastImageId = store.lastImageId;
  const created: MockNoticeImage[] = [];
  for (const image of pending) {
    lastImageId += 1;
    created.push({ id: lastImageId, noticeId, originalFilename: String(image.originalFilename) });
    image.imageId = lastImageId;
    delete image.tempKey;
    delete image.originalFilename;
  }
  const owned = [...store.images, ...created].filter((item) => item.noticeId === noticeId);
  const referenced = new Set<number>();
  for (const image of images) {
    const { imageId } = image;
    // 모든 이미지 블록은 이 공지가 가진 `imageId`(1 이상 정수)를 가리켜야 한다.
    if (typeof imageId !== 'number' || !Number.isInteger(imageId) || imageId < 1) return null;
    if (!owned.some((item) => item.id === imageId)) return null;
    referenced.add(imageId);
  }
  return {
    body: next,
    store: {
      // 본문이 더 이상 가리키지 않는 이 공지의 이미지는 지운다.
      images: [...store.images, ...created].filter((item) => item.noticeId !== noticeId || referenced.has(item.id)),
      uploadedTempKeys: store.uploadedTempKeys.filter((key) => !tempKeys.has(key)),
      usedTempKeys: [...store.usedTempKeys, ...tempKeys],
      lastImageId,
    },
  };
}

/** 저장된 본문을 화면용 본문(`previewBody`)으로 바꾼다. 이미지 블록에 보기 주소를 채우고, 없는 이미지는 사용 불가로 표시한다. */
export function toPreviewBody(
  body: ContentBody,
  store: MockImageStore,
  getImageUrl: (imageId: number) => string
): ContentBody {
  const preview = structuredClone(body);
  if (!Array.isArray(preview.blocks)) return preview;
  for (const image of collectImageBlocks(preview.blocks)) {
    const exists = store.images.some((item) => item.id === image.imageId);
    if (exists && typeof image.imageId === 'number') {
      image.url = getImageUrl(image.imageId);
    } else {
      image.url = null;
      image.unavailable = true;
    }
  }
  return preview;
}

/** 공지를 지우면 그 공지의 이미지도 함께 지운다. */
export const removeNoticeImages = (store: MockImageStore, noticeId: number): MockImageStore => ({
  ...store,
  images: store.images.filter((item) => item.noticeId !== noticeId),
});
