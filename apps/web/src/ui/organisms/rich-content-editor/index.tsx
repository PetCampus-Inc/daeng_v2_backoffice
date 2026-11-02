import { Fragment, useEffect, useMemo, useRef, useState, type ComponentProps, type ReactNode, type Ref } from 'react';
import {
  BasicBlocksPlugin,
  BoldPlugin,
  ItalicPlugin,
  UnderlinePlugin,
  StrikethroughPlugin,
} from '@platejs/basic-nodes/react';
import { BaseBasicBlocksPlugin, BaseBasicMarksPlugin } from '@platejs/basic-nodes';
import { ListPlugin } from '@platejs/list-classic/react';
import { BaseListPlugin } from '@platejs/list-classic';
import { LinkPlugin } from '@platejs/link/react';
import { BaseLinkPlugin, upsertLink, unwrapLink } from '@platejs/link';
import { TablePlugin } from '@platejs/table/react';
import { BaseTablePlugin, insertTable, insertTableRow, insertTableColumn, deleteTable } from '@platejs/table';
import {
  Plate,
  PlateContent,
  usePlateEditor,
  useEditorRef,
  useEditorSelector,
  createPlatePlugin,
  type PlateElementProps,
} from 'platejs/react';
import { createSlatePlugin } from 'platejs';
import { PlateStatic, createStaticEditor, type SlateElementProps } from 'platejs/static';
import { createElement } from 'react';
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
  Minus,
  Undo2,
  Redo2,
} from 'lucide-react';
import type { RichContent } from '@/type/rich-content';
import { fromEditorValue, isHttpUrl, toEditorValue } from '@/util/rich-content';
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

function ContentElement({ attributes, children, element }: PlateElementProps | SlateElementProps) {
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
const COMPONENTS = Object.fromEntries(
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
);
const FONT_SIZES = [12, 14, 16, 18, 20, 24, 28];
/** 선택 목록(FONT_SIZES)에 있는 px 값인지 확인한다. */
function isFontSize(value: unknown): value is number {
  return typeof value === 'number' && FONT_SIZES.includes(value);
}
/** 글자 크기 표시를 위한 mark. 목록에 있는 px 숫자만 그린다. */
function FontSizeLeaf({
  attributes,
  children,
  leaf,
}: {
  attributes: object;
  children: ReactNode;
  leaf: { fontSize?: unknown };
}) {
  const size = isFontSize(leaf.fontSize) ? leaf.fontSize : undefined;
  return (
    <span {...attributes} style={size ? { fontSize: `${size}px` } : undefined}>
      {children}
    </span>
  );
}
const EDITOR_COMPONENTS = { ...COMPONENTS, fontSize: FontSizeLeaf };
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
];
const CONTENT_CLASS =
  'min-w-0 whitespace-pre-wrap text-kd-body [overflow-wrap:anywhere] [&_p]:min-h-6 [&_h1]:text-kd-title-1 [&_h2]:text-kd-title-2 [&_h3]:text-kd-title-3 [&_h4]:font-bold [&_h5]:font-bold [&_h6]:font-bold [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:list-decimal [&_ol]:pl-6 [&_a]:text-kd-primary [&_a]:underline [&_blockquote]:border-l-4 [&_blockquote]:border-kd-border [&_blockquote]:pl-4 [&_hr]:my-4 [&_hr]:border-kd-border [&_table]:w-full [&_table]:min-w-80 [&_table]:border-collapse [&_td]:min-w-24 [&_td]:border [&_td]:border-kd-border [&_td]:p-2 [&_th]:min-w-24 [&_th]:border [&_th]:border-kd-border [&_th]:bg-kd-surface [&_th]:p-2';

type EditorProps = {
  value: RichContent;
  onChange: (value: RichContent) => void;
  readOnly?: boolean;
  ref?: Ref<HTMLDivElement>;
} & Pick<ComponentProps<typeof PlateContent>, 'id' | 'placeholder' | 'aria-invalid' | 'aria-describedby'>;

export function RichContentEditor({ value, onChange, readOnly = false, ref, ...props }: EditorProps) {
  const editor = usePlateEditor({ plugins: PLUGINS, components: EDITOR_COMPONENTS, value: toEditorValue(value) });
  return (
    <div className='min-w-0 rounded-kd-3 border border-kd-border focus-within:ring-2 focus-within:ring-kd-primary'>
      <Plate editor={editor} readOnly={readOnly} onValueChange={({ value }) => onChange(fromEditorValue(value))}>
        <EditorToolbar readOnly={readOnly} />
        <PlateContent
          {...props}
          ref={ref}
          role='textbox'
          aria-label='본문 *'
          aria-multiline='true'
          aria-readonly={readOnly}
          className={cn(
            CONTENT_CLASS,
            'h-96 min-h-96 overflow-y-auto p-4 outline-none [&_[data-slate-placeholder]]:top-4! [&_[data-slate-placeholder]]:w-[calc(100%-2rem)]!'
          )}
        />
      </Plate>
    </div>
  );
}

function EditorToolbar({ readOnly }: { readOnly: boolean }) {
  const editor = useEditorRef();
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
        {buttons.map(({ label, Icon, active, run }) => (
          <Fragment key={label}>
            <Button
              type='button'
              variant={active ? 'default' : 'ghost'}
              size='icon'
              className='size-9'
              aria-label={label}
              title={label}
              aria-pressed={active}
              disabled={readOnly}
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

export function RichContentView({ value, className }: { value: RichContent; className?: string }) {
  const editor = useMemo(
    () =>
      createStaticEditor({
        plugins: [
          BaseBasicBlocksPlugin,
          BaseBasicMarksPlugin,
          BaseListPlugin,
          BaseLinkPlugin,
          BaseTablePlugin,
          createSlatePlugin({ key: 'fontSize', node: { isLeaf: true } }),
        ],
        components: EDITOR_COMPONENTS,
      }),
    []
  );
  return <PlateStatic editor={editor} value={toEditorValue(value)} className={cn(CONTENT_CLASS, className)} />;
}
