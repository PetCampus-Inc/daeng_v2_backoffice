import { ImageElement } from '../ui/rich-content-image';
import { ContentElement, FontSizeLeaf } from '../ui/rich-content-nodes';

export { RICH_CONTENT_FONT_SIZES, isRichContentFontSize } from './font-size';
export { RichContentImageSourcesContext, type RichContentImageSources } from './image-sources';

/** 편집기와 보기 화면이 함께 쓰는 노드별 컴포넌트. 굵게·기울임·밑줄·취소선은 각 플러그인이 직접 그린다. */
export const RICH_CONTENT_COMPONENTS = {
  ...Object.fromEntries(
    [
      'p',
      'h1',
      'h2',
      'h3',
      'h4',
      'h5',
      'h6',
      'blockquote',
      'ul',
      'ol',
      'li',
      'lic',
      'table',
      'tr',
      'td',
      'th',
      'hr',
      'a',
    ].map((key) => [key, ContentElement])
  ),
  img: ImageElement,
  fontSize: FontSizeLeaf,
};

/** 편집기와 보기 화면이 함께 쓰는 본문 모양(글자·제목·목록·표·링크 스타일). */
export const RICH_CONTENT_CLASS =
  'min-w-0 whitespace-pre-wrap text-kd-body [overflow-wrap:anywhere] [&_p]:min-h-6 [&_h1]:text-kd-title-1 [&_h2]:text-kd-title-2 [&_h3]:text-kd-title-3 [&_h4]:font-bold [&_h5]:font-bold [&_h6]:font-bold [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:list-decimal [&_ol]:pl-6 [&_a]:text-kd-primary [&_a]:underline [&_blockquote]:border-l-4 [&_blockquote]:border-kd-border [&_blockquote]:pl-4 [&_hr]:my-4 [&_hr]:border-kd-border [&_table]:w-full [&_table]:min-w-80 [&_table]:border-collapse [&_td]:min-w-24 [&_td]:border [&_td]:border-kd-border [&_td]:p-2 [&_th]:min-w-24 [&_th]:border [&_th]:border-kd-border [&_th]:bg-kd-surface [&_th]:p-2';
