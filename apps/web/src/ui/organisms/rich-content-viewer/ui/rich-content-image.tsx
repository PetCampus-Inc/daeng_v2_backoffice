import { useContext, type ReactNode } from 'react';
import type { PlateElementProps } from 'platejs/react';
import type { SlateElementProps } from 'platejs/static';
import { RichContentImageSourcesContext, pickImageSrc } from '../util/image-sources';

/** 이미지 블록 모양. 편집기와 보기 화면이 같이 쓰고, 편집기는 `actions`로 삭제 버튼 같은 조작을 얹는다. */
export function ImageElement({
  attributes,
  children,
  element,
  actions,
}: (PlateElementProps | SlateElementProps) & { actions?: ReactNode }) {
  const sources = useContext(RichContentImageSourcesContext);
  const src = pickImageSrc(element, sources);
  const name = typeof element.originalFilename === 'string' ? element.originalFilename : '';
  return (
    <div {...attributes} className='my-2'>
      <div contentEditable={false} className='relative inline-block max-w-full select-none align-top'>
        {src ? (
          <img src={src} alt={name || '본문 이미지'} className='block h-auto max-w-full rounded-kd-3' />
        ) : (
          <div className='rounded-kd-3 border border-kd-border bg-kd-surface p-4 text-kd-sub text-kd-foreground-muted'>
            이미지를 불러올 수 없어요.
          </div>
        )}
        {actions}
      </div>
      {children}
    </div>
  );
}
