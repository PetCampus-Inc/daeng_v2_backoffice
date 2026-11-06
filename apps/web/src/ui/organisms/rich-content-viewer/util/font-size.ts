/** 글자 크기 선택 목록(px). 편집기 도구 모음과 보기 화면이 함께 쓴다. */
export const RICH_CONTENT_FONT_SIZES = [12, 14, 16, 18, 20, 24, 28];

/** 선택 목록에 있는 px 값인지 확인한다. */
export function isRichContentFontSize(value: unknown): value is number {
  return typeof value === 'number' && RICH_CONTENT_FONT_SIZES.includes(value);
}
