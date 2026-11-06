import { createElement, type ReactNode } from 'react';
import type { PlateElementProps } from 'platejs/react';
import type { SlateElementProps } from 'platejs/static';
import { isHttpUrl } from '@/util/rich-content';
import { isRichContentFontSize } from '../util/font-size';

/** 블록 요소(제목·목록·표·링크·구분선 등)를 그린다. 편집기와 보기 화면이 같은 모양을 쓴다. */
export function ContentElement({ attributes, children, element }: PlateElementProps | SlateElementProps) {
  if (element.type === 'hr') {
    return (
      <div {...attributes}>
        <div contentEditable={false}>
          <hr />
        </div>
        {children}
      </div>
    );
  }
  if (element.type === 'table') {
    return (
      <div className='max-w-full overflow-x-auto'>
        <table {...attributes}>
          <tbody>{children}</tbody>
        </table>
      </div>
    );
  }
  if (element.type === 'a') {
    return isHttpUrl(String(element.url)) ? (
      <a {...attributes} href={String(element.url)} target='_blank' rel='noopener noreferrer'>
        {children}
      </a>
    ) : (
      <span {...attributes}>{children}</span>
    );
  }
  const tag =
    (
      {
        h1: 'h1',
        h2: 'h2',
        h3: 'h3',
        h4: 'h4',
        h5: 'h5',
        h6: 'h6',
        blockquote: 'blockquote',
        ul: 'ul',
        ol: 'ol',
        li: 'li',
        lic: 'div',
        tr: 'tr',
        td: 'td',
        th: 'th',
      } as Record<string, string>
    )[element.type] ?? 'p';
  return createElement(tag, attributes, children);
}

/** 글자 크기 표시를 위한 mark. 목록에 있는 px 숫자만 그린다. */
export function FontSizeLeaf({
  attributes,
  children,
  leaf,
}: {
  attributes: object;
  children: ReactNode;
  leaf: { fontSize?: unknown };
}) {
  const size = isRichContentFontSize(leaf.fontSize) ? leaf.fontSize : undefined;
  return (
    <span {...attributes} style={size ? { fontSize: `${size}px` } : undefined}>
      {children}
    </span>
  );
}
