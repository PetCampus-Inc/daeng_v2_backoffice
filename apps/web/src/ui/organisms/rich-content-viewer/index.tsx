import { useMemo } from 'react';
import { BaseBasicBlocksPlugin, BaseBasicMarksPlugin } from '@platejs/basic-nodes';
import { BaseListPlugin } from '@platejs/list-classic';
import { BaseLinkPlugin } from '@platejs/link';
import { BaseTablePlugin } from '@platejs/table';
import { BaseImagePlugin } from '@platejs/media';
import { createSlatePlugin } from 'platejs';
import { PlateStatic, createStaticEditor } from 'platejs/static';
import type { RichContent } from '@/type/rich-content';
import { cn } from '@/util/cn';
import { toEditorValue } from '@/util/rich-content';
import { RICH_CONTENT_CLASS, RICH_CONTENT_COMPONENTS } from './util';

type RichContentViewerProps = {
  /** 보여 줄 본문 블록. 서버가 준 화면 표시용 본문(공지 `previewBody` 등)을 `fromContentBody`로 바꿔 넘긴다. */
  value: RichContent;
  className?: string;
};

/** 읽기 전용 본문 표시. Plate의 PlateStatic으로 그리며, 공지·약관 등 어느 화면에서나 쓴다. */
export function RichContentViewer({ value, className }: RichContentViewerProps) {
  const editor = useMemo(
    () =>
      createStaticEditor({
        plugins: [
          BaseBasicBlocksPlugin,
          BaseBasicMarksPlugin,
          BaseListPlugin,
          BaseLinkPlugin,
          BaseTablePlugin,
          BaseImagePlugin,
          createSlatePlugin({ key: 'fontSize', node: { isLeaf: true } }),
        ],
        components: RICH_CONTENT_COMPONENTS,
      }),
    []
  );
  return <PlateStatic editor={editor} value={toEditorValue(value)} className={cn(RICH_CONTENT_CLASS, className)} />;
}
