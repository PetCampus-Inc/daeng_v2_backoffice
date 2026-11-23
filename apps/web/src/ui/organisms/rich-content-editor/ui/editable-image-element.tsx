import { useEditorRef, useReadOnly, type PlateElementProps } from 'platejs/react';
import { X } from 'lucide-react';
import { Button } from '@/ui/atoms/button';
import { ImageElement } from '@/ui/organisms/rich-content-viewer/ui/rich-content-image';

/** 편집기 안의 이미지. 보기 모양에 삭제 버튼을 얹는다. */
export function EditableImageElement(props: PlateElementProps) {
  const editor = useEditorRef();
  const readOnly = useReadOnly();
  return (
    <ImageElement
      {...props}
      actions={
        !readOnly && (
          <Button
            type='button'
            size='icon'
            variant='outline'
            className='absolute top-2 right-2 size-8'
            aria-label='이미지 삭제'
            title='이미지 삭제'
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => {
              const path = editor.api.findPath(props.element);
              if (path) editor.tf.removeNodes({ at: path });
            }}
          >
            <X className='size-4' />
          </Button>
        )
      }
    />
  );
}
