import { createContext } from 'react';
import { isHttpUrl } from '@/util/rich-content';

/**
 * 이미지 블록에 보여 줄 주소 모음. 저장 본문에는 주소를 넣지 않으므로(서버가 채움), 편집 화면이 따로 알려 준다.
 * `byTempKey`는 방금 올려 아직 저장하지 않은 이미지의 내 컴퓨터 미리보기, `byImageId`는 저장된 이미지의 보기 주소다.
 */
export type RichContentImageSources = {
  byTempKey: Record<string, string>;
  byImageId: Record<number, string>;
};

/** 이미지 주소를 알려 주는 곳이 없는 화면(약관·공지 읽기 등)의 기본값. 블록에 든 `url`만 쓴다. */
export const RichContentImageSourcesContext = createContext<RichContentImageSources>({ byTempKey: {}, byImageId: {} });

/** 열 수 있는 이미지 주소인지 본다. `http`·`https`와 내 컴퓨터 미리보기(`blob:`)만 허용한다. */
export function isImageSrc(value: unknown): value is string {
  return typeof value === 'string' && (isHttpUrl(value) || value.startsWith('blob:'));
}

/** 이미지 블록이 보여 줄 주소를 고른다. 내 컴퓨터 미리보기 → 저장된 이미지 주소 → 블록의 `url` 순이다. */
export function pickImageSrc(element: Record<string, unknown>, sources: RichContentImageSources): string | undefined {
  const candidates = [
    typeof element.tempKey === 'string' ? sources.byTempKey[element.tempKey] : undefined,
    typeof element.imageId === 'number' ? sources.byImageId[element.imageId] : undefined,
    element.url,
  ];
  return candidates.find(isImageSrc);
}
