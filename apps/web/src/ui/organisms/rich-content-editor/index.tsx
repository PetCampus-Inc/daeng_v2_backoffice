import { type ComponentProps, type Ref } from 'react';
import { Plate, PlateContent, usePlateEditor } from 'platejs/react';
import type { RichContent } from '@/type/rich-content';
import { fromEditorValue, toEditorValue } from '@/util/rich-content';
import { RICH_CONTENT_CLASS, RICH_CONTENT_COMPONENTS } from '@/ui/organisms/rich-content-viewer/util';
import { cn } from '@/util/cn';
import type { RichContentImageUpload } from './type/rich-content-image-upload';
import { PLUGINS } from './util/plugins';
import { useImageFilesInsert } from './util/use-image-files-insert';
import { EditableImageElement } from './ui/editable-image-element';
import { EditorToolbar } from './ui/editor-toolbar';

type EditorProps = {
  value: RichContent;
  onChange: (value: RichContent) => void;
  readOnly?: boolean;
  /** 주면 도구 모음에 이미지 버튼이 생긴다. 주지 않으면(약관 등) 이미지 버튼이 없다. */
  imageUpload?: RichContentImageUpload;
  ref?: Ref<HTMLDivElement>;
} & Pick<ComponentProps<typeof PlateContent>, 'id' | 'placeholder' | 'aria-invalid' | 'aria-describedby'>;

export function RichContentEditor({ value, onChange, readOnly = false, imageUpload, ref, ...props }: EditorProps) {
  const editor = usePlateEditor({
    plugins: PLUGINS,
    components: { ...RICH_CONTENT_COMPONENTS, img: EditableImageElement },
    value: toEditorValue(value),
  });
  const { isProcessing, insertImageFiles, handleDragOverFiles, handleDropFiles, handlePasteFiles } =
    useImageFilesInsert({ editor, imageUpload, readOnly });
  return (
    <div className='min-w-0 rounded-kd-3 border border-kd-border focus-within:ring-2 focus-within:ring-kd-primary'>
      <Plate editor={editor} readOnly={readOnly} onValueChange={({ value }) => onChange(fromEditorValue(value))}>
        <EditorToolbar
          readOnly={readOnly}
          imageUpload={imageUpload}
          isImageProcessing={isProcessing}
          onImageFiles={insertImageFiles}
        />
        <PlateContent
          {...props}
          ref={ref}
          role='textbox'
          aria-label='본문 *'
          aria-multiline='true'
          aria-readonly={readOnly}
          onDragOver={handleDragOverFiles}
          onDrop={handleDropFiles}
          onPaste={handlePasteFiles}
          className={cn(
            RICH_CONTENT_CLASS,
            'h-96 min-h-96 overflow-y-auto p-4 outline-none [&_[data-slate-placeholder]]:top-4! [&_[data-slate-placeholder]]:w-[calc(100%-2rem)]!'
          )}
        />
      </Plate>
    </div>
  );
}
