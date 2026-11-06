import { Fragment, useEffect, useId, useRef, useState, type ChangeEvent, type ComponentProps, type Ref } from 'react';
import {
  BasicBlocksPlugin,
  BoldPlugin,
  ItalicPlugin,
  UnderlinePlugin,
  StrikethroughPlugin,
} from '@platejs/basic-nodes/react';
import { ListPlugin } from '@platejs/list-classic/react';
import { LinkPlugin } from '@platejs/link/react';
import { upsertLink, unwrapLink } from '@platejs/link';
import { ImagePlugin } from '@platejs/media/react';
import { TablePlugin } from '@platejs/table/react';
import { insertTable, insertTableRow, insertTableColumn, deleteTable } from '@platejs/table';
import type { Value } from 'platejs';
import {
  Plate,
  PlateContent,
  usePlateEditor,
  useEditorRef,
  useEditorSelector,
  useReadOnly,
  createPlatePlugin,
  type PlateElementProps,
} from 'platejs/react';
import {
  Bold,
  Italic,
  Underline,
  Strikethrough,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  Link,
  Unlink,
  Table,
  ImagePlus,
  X,
  Minus,
  Undo2,
  Redo2,
} from 'lucide-react';
import type { RichContent } from '@/type/rich-content';
import { countRichContentImages, fromEditorValue, isHttpUrl, toEditorValue } from '@/util/rich-content';
import {
  RICH_CONTENT_CLASS,
  RICH_CONTENT_COMPONENTS,
  RICH_CONTENT_FONT_SIZES as FONT_SIZES,
  isRichContentFontSize as isFontSize,
} from '@/ui/organisms/rich-content-viewer/util';
import { ImageElement } from '@/ui/organisms/rich-content-viewer/ui/rich-content-image';
import { Button } from '@/ui/atoms/button';
import { Input } from '@/ui/atoms/input';
import { Label } from '@/ui/atoms/label';
import { Dialog as DialogPrimitive } from 'radix-ui';
import { cn } from '@/util/cn';

const Dialog = DialogPrimitive.Root;
const DialogTitle = DialogPrimitive.Title;
function DialogContent(props: ComponentProps<typeof DialogPrimitive.Content>) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className='fixed inset-0 z-50 bg-black/40' />
      <DialogPrimitive.Content
        {...props}
        aria-describedby={undefined}
        className='fixed top-1/2 left-1/2 z-50 w-[calc(100%_-_2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 space-y-4 rounded-kd-3 border border-kd-border bg-kd-background p-6 shadow-kd-float'
      />
    </DialogPrimitive.Portal>
  );
}
function DialogHeader(props: ComponentProps<'div'>) {
  return <div {...props} className='text-kd-title-2' />;
}
function DialogFooter(props: ComponentProps<'div'>) {
  return <div {...props} className='flex justify-end gap-2' />;
}

const PLUGINS = [
  createPlatePlugin({ key: 'fontSize', node: { isLeaf: true } }),
  BasicBlocksPlugin,
  BoldPlugin,
  ItalicPlugin,
  UnderlinePlugin,
  StrikethroughPlugin,
  ListPlugin,
  LinkPlugin.configure({ options: { isUrl: isHttpUrl } }),
  TablePlugin,
  // 붙여넣기·주소로 들어오는 이미지는 서버가 받지 않는 모양(url)이라 막고, 이미지는 업로드 버튼으로만 넣는다.
  ImagePlugin.configure({
    options: { disableEmbedInsert: true, disableUploadInsert: true },
    parsers: { html: { deserializer: { query: () => false } } },
  }),
];

/** 이미지 업로드를 켜는 값. 업로드 실행은 화면(공지)이 맡고 편집기는 파일 선택과 블록 삽입만 한다. */
export type RichContentImageUpload = {
  /** 파일 선택창에 거는 허용 형식. */
  accept: string;
  /** 업로드 중이면 이미지 버튼을 잠근다. */
  isUploading: boolean;
  /** 파일을 올리고 성공한 이미지를 돌려준다. `currentImageCount`는 본문에 든 이미지 수다. */
  upload: (files: File[], currentImageCount: number) => Promise<{ tempKey: string; originalFilename: string }[]>;
  /** 저장으로 확정된 이미지(`tempKey`→`imageId`). 본문의 같은 이미지 블록을 `imageId`로 바꾼다. */
  confirmed?: Record<string, number>;
};

/** 편집기 안의 이미지. 보기 모양에 삭제 버튼을 얹는다. */
function EditableImageElement(props: PlateElementProps) {
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
  return (
    <div className='min-w-0 rounded-kd-3 border border-kd-border focus-within:ring-2 focus-within:ring-kd-primary'>
      <Plate editor={editor} readOnly={readOnly} onValueChange={({ value }) => onChange(fromEditorValue(value))}>
        <EditorToolbar readOnly={readOnly} imageUpload={imageUpload} />
        <PlateContent
          {...props}
          ref={ref}
          role='textbox'
          aria-label='본문 *'
          aria-multiline='true'
          aria-readonly={readOnly}
          className={cn(
            RICH_CONTENT_CLASS,
            'h-96 min-h-96 overflow-y-auto p-4 outline-none [&_[data-slate-placeholder]]:top-4! [&_[data-slate-placeholder]]:w-[calc(100%-2rem)]!'
          )}
        />
      </Plate>
    </div>
  );
}

function EditorToolbar({ readOnly, imageUpload }: { readOnly: boolean; imageUpload?: RichContentImageUpload }) {
  const editor = useEditorRef();
  const fileInputId = useId();
  const confirmed = imageUpload?.confirmed;
  // 저장으로 확정된 이미지는 `tempKey`를 `imageId`로 바꾼다. 실행 취소 기록에는 남기지 않는다.
  useEffect(() => {
    if (!confirmed) return;
    editor.tf.withoutSaving(() => {
      for (const [tempKey, imageId] of Object.entries(confirmed)) {
        const match = (node: { type?: unknown; tempKey?: unknown }) => node.type === 'img' && node.tempKey === tempKey;
        editor.tf.setNodes({ imageId }, { at: [], match });
        editor.tf.unsetNodes(['tempKey', 'originalFilename'], { at: [], match });
      }
    });
  }, [editor, confirmed]);
  const marks = useEditorSelector((editor) => editor.api.marks() ?? {}, []);
  const block = useEditorSelector(
    (editor) =>
      ['h1', 'h2', 'h3', 'ul', 'ol', 'table', 'a'].filter((type) => editor.api.some({ match: { type } })).join(','),
    []
  );
  const fontSize = useEditorSelector(
    (editor) =>
      editor.selection
        ? isFontSize(editor.api.marks()?.fontSize)
          ? (editor.api.marks()?.fontSize as number)
          : undefined
        : null,
    []
  );
  const selection = useEditorSelector((editor) => editor.selection, []);
  const lastSelection = useRef(selection);
  useEffect(() => {
    if (selection) lastSelection.current = selection;
  }, [selection]);
  const [linkOpen, setLinkOpen] = useState(false);
  const [url, setUrl] = useState('');
  const [linkError, setLinkError] = useState(false);
  const act = (run: () => void) => {
    if (readOnly) return;
    // 브라우저의 selectionchange가 처리되기 전 빠르게 툴바를 눌러도 현재 선택을 적용한다.
    const selection = window.getSelection();
    if (selection?.anchorNode && editor.api.hasDOMNode(selection.anchorNode, { editable: true })) {
      const range = editor.api.toSlateRange(selection, { exactMatch: false, suppressThrow: true });
      if (range) editor.tf.select(range);
    }
    // 입력칸처럼 편집기 밖을 눌러 선택이 풀린 경우, 마지막 선택으로 되돌려 적용한다.
    if (!editor.selection && lastSelection.current) editor.tf.select(lastSelection.current);
    run();
    editor.tf.focus();
  };
  /** 고른 이미지 파일을 올리고, 성공한 이미지를 이미지 블록으로 넣는다. */
  const handleImageFiles = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    event.target.value = '';
    if (!imageUpload || files.length === 0) return;
    const target = lastSelection.current;
    const uploaded = await imageUpload.upload(files, countRichContentImages(editor.children as Value));
    if (uploaded.length === 0) return;
    const nodes = [
      ...uploaded.map(({ tempKey, originalFilename }) => ({
        type: 'img',
        tempKey,
        originalFilename,
        children: [{ text: '' }],
      })),
      { type: 'p', children: [{ text: '' }] },
    ];
    try {
      if (!editor.selection && target) editor.tf.select(target);
    } catch {
      // 올리는 사이 문서가 바뀌어 위치를 못 찾으면 맨 끝에 넣는다.
    }
    if (editor.selection) editor.tf.insertNodes(nodes, { nextBlock: true });
    else editor.tf.insertNodes(nodes, { at: [editor.children.length] });
    editor.tf.focus();
  };
  /** 파일 선택창을 연다. */
  const openFilePicker = () => document.getElementById(fileInputId)?.click();
  const buttons = [
    { label: '굵게', Icon: Bold, active: !!marks.bold, run: () => editor.tf.toggleMark('bold') },
    { label: '기울임', Icon: Italic, active: !!marks.italic, run: () => editor.tf.toggleMark('italic') },
    { label: '밑줄', Icon: Underline, active: !!marks.underline, run: () => editor.tf.toggleMark('underline') },
    {
      label: '취소선',
      Icon: Strikethrough,
      active: !!marks.strikethrough,
      run: () => editor.tf.toggleMark('strikethrough'),
    },
    { label: '큰 제목', Icon: Heading1, active: block.includes('h1'), run: () => editor.tf.toggleBlock('h1') },
    { label: '소제목', Icon: Heading2, active: block.includes('h2'), run: () => editor.tf.toggleBlock('h2') },
    { label: '작은 제목', Icon: Heading3, active: block.includes('h3'), run: () => editor.tf.toggleBlock('h3') },
    {
      label: '글머리 목록',
      Icon: List,
      active: block.includes('ul'),
      run: () => editor.getTransforms(ListPlugin).toggle.bulletedList(),
    },
    {
      label: '번호 목록',
      Icon: ListOrdered,
      active: block.includes('ol'),
      run: () => editor.getTransforms(ListPlugin).toggle.numberedList(),
    },
    {
      label: '링크',
      Icon: Link,
      run: () => {
        const entry = editor.api.node({ match: { type: 'a' } });
        setUrl(String(entry?.[0].url ?? ''));
        setLinkError(false);
        setLinkOpen(true);
      },
    },
    { label: '링크 해제', Icon: Unlink, run: () => unwrapLink(editor) },
    {
      label: '표 삽입',
      Icon: Table,
      run: () => {
        insertTable(editor, { rowCount: 2, colCount: 2 });
      },
    },
    ...(imageUpload
      ? [
          {
            label: '이미지',
            Icon: ImagePlus,
            isDisabled: imageUpload.isUploading,
            run: openFilePicker,
          },
        ]
      : []),
    {
      label: '구분선',
      Icon: Minus,
      run: () => {
        editor.tf.insertNodes([
          { type: 'hr', children: [{ text: '' }] },
          { type: 'p', children: [{ text: '' }] },
        ]);
      },
    },
    { label: '실행 취소', Icon: Undo2, run: () => editor.tf.undo() },
    { label: '다시 실행', Icon: Redo2, run: () => editor.tf.redo() },
  ];
  return (
    <>
      <div role='group' aria-label='본문 서식' className='flex flex-wrap gap-1 border-b border-kd-border p-2'>
        {buttons.map(({ label, Icon, active, run, isDisabled }) => (
          <Fragment key={label}>
            <Button
              type='button'
              variant={active ? 'default' : 'ghost'}
              size='icon'
              className='size-9'
              aria-label={label}
              title={label}
              aria-pressed={active}
              disabled={readOnly || isDisabled}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => act(run)}
            >
              <Icon className='size-4' />
            </Button>
            {label === '작은 제목' && (
              <select
                aria-label='글자 크기'
                title='글자 크기'
                className='h-9 rounded-kd-3 border border-kd-border bg-kd-background px-2 text-kd-sub'
                disabled={readOnly}
                value={String(fontSize ?? '')}
                onChange={(event) =>
                  act(() =>
                    event.target.value
                      ? editor.tf.addMark('fontSize', Number(event.target.value))
                      : editor.tf.removeMark('fontSize')
                  )
                }
              >
                <option value=''>기본 크기</option>
                {FONT_SIZES.map((size) => (
                  <option key={size} value={size}>
                    {size}px
                  </option>
                ))}
              </select>
            )}
          </Fragment>
        ))}
        {imageUpload && (
          <input
            id={fileInputId}
            type='file'
            hidden
            multiple
            accept={imageUpload.accept}
            aria-label='이미지 파일 선택'
            onChange={(event) => void handleImageFiles(event)}
          />
        )}
        {block.includes('table') && (
          <div className='flex flex-wrap gap-1'>
            <Button
              size='sm'
              variant='ghost'
              disabled={readOnly}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => act(() => insertTableRow(editor))}
            >
              행 추가
            </Button>
            <Button
              size='sm'
              variant='ghost'
              disabled={readOnly}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => act(() => insertTableColumn(editor))}
            >
              열 추가
            </Button>
            <Button
              size='sm'
              variant='ghost'
              disabled={readOnly}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => act(() => deleteTable(editor))}
            >
              표 삭제
            </Button>
          </div>
        )}
      </div>
      <Dialog open={linkOpen} onOpenChange={setLinkOpen}>
        <DialogContent
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            editor.tf.focus();
          }}
        >
          <DialogHeader>
            <DialogTitle>링크 설정</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              if (!isHttpUrl(url)) {
                setLinkError(true);
                return;
              }
              act(() => {
                upsertLink(editor, { url, target: '_blank' });
              });
              setLinkOpen(false);
            }}
            className='space-y-4'
          >
            <Label htmlFor='rich-content-link'>링크 주소</Label>
            <Input
              id='rich-content-link'
              value={url}
              onChange={(event) => setUrl(event.target.value)}
              placeholder='https://'
              aria-invalid={linkError}
              aria-describedby={linkError ? 'rich-content-link-error' : undefined}
            />
            {linkError && (
              <p id='rich-content-link-error' role='alert' className='text-kd-error-foreground'>
                http 또는 https 주소를 입력해 주세요.
              </p>
            )}
            <DialogFooter>
              <Button type='button' variant='outline' onClick={() => setLinkOpen(false)}>
                취소
              </Button>
              <Button type='submit' disabled={readOnly}>
                적용
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
