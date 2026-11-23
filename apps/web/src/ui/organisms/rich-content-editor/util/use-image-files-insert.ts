import { useRef, useState, type ClipboardEvent, type DragEvent } from 'react';
import type { TRange, Value } from 'platejs';
import type { PlateEditor } from 'platejs/react';
import { countRichContentImages } from '@/util/rich-content';
import type { RichContentImageUpload } from '../type/rich-content-image-upload';
import { pickUploadableImages } from './pick-uploadable-images';

/**
 * 본문 편집기의 이미지 파일 넣기. 검사·올리는 중 상태와 업로드 버튼·끌어다 놓기·붙여넣기가 함께 쓰는 `insertImageFiles`,
 * 본문에 거는 드래그 오버·드롭·붙여넣기 핸들러를 돌려준다. `imageUpload`가 없으면 이미지 파일을 받지 않는다.
 */
export function useImageFilesInsert({
  editor,
  imageUpload,
  readOnly,
}: {
  editor: PlateEditor;
  imageUpload?: RichContentImageUpload;
  readOnly: boolean;
}) {
  const [isProcessing, setIsProcessing] = useState(false);
  const isProcessingRef = useRef(false);
  const canUploadImage = !readOnly && !!imageUpload && !imageUpload.isUploading && !isProcessing;
  /**
   * 이미지 파일을 검사해 올려도 되는 것만 올리고 성공한 이미지를 이미지 블록으로 넣는다. 업로드 버튼·끌어다 놓기·붙여넣기가 함께 쓴다.
   * 판정과 올리지 않은 파일의 안내는 편집기가 하고(`pickUploadableImages`), 규칙 값과 실제 올리기는 `imageUpload`가 준다.
   * 검사·올리는 중에는 새 파일을 받지 않는다. 넣을 위치는 `target`(없으면 현재 선택, 그것도 없으면 맨 끝)이다.
   */
  const insertImageFiles = async (files: File[], target: TRange | null) => {
    if (!imageUpload || files.length === 0 || isProcessingRef.current) return;
    isProcessingRef.current = true;
    setIsProcessing(true);
    let uploaded: Awaited<ReturnType<RichContentImageUpload['upload']>> = [];
    try {
      const uploadable = await pickUploadableImages(files, imageUpload, () =>
        countRichContentImages(editor.children as Value)
      );
      if (uploadable.length > 0) uploaded = await imageUpload.upload(uploadable);
    } finally {
      isProcessingRef.current = false;
      setIsProcessing(false);
    }
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
  /** 파일을 끌어 오는 중이면 놓을 수 있게 한다. 읽기 전용·업로드 불가일 때도 브라우저가 파일을 열며 화면을 옮기지 않게 막는다. */
  const handleDragOverFiles = (event: DragEvent<HTMLDivElement>) => {
    if (!event.dataTransfer.types.includes('Files')) return;
    if (!canUploadImage) event.preventDefault();
  };
  /** 본문에 파일을 놓으면 놓은 자리에 이미지를 넣는다. 파일이 아닌 드롭(글자·블록 옮기기)은 기존 동작에 맡긴다. */
  const handleDropFiles = (event: DragEvent<HTMLDivElement>) => {
    const files = Array.from(event.dataTransfer.files);
    if (files.length === 0) return;
    // 파일을 놓으면 브라우저가 그 파일을 열어 화면이 옮겨 가므로 항상 막는다.
    event.preventDefault();
    if (!canUploadImage) return;
    let target: TRange | null = null;
    try {
      target = editor.api.findEventRange(event) ?? null;
      if (target) editor.tf.select(target);
    } catch {
      // 놓은 자리를 못 찾으면 현재 선택, 그것도 없으면 맨 끝에 넣는다.
    }
    void insertImageFiles(files, target);
  };
  /**
   * 클립보드에 이미지 파일만 있고 글자(text/plain)가 없으면 이미지 파일 붙여넣기로 처리해 현재 선택 위치(없으면 맨 끝)에 넣는다.
   * 엑셀 셀 복사처럼 글자와 이미지 파일이 함께 오면 글자가 본래 내용이라 이미지로 가로채지 않고 기존 붙여넣기에 맡긴다.
   * 글자만 있거나 주소가 든 HTML만 있는 붙여넣기도 기존 동작(주소 이미지는 막힘)을 그대로 둔다. 이미지 업로드를 안 켠 편집기는 건드리지 않는다.
   * 웹페이지에서 복사한 이미지는 이미지 파일과 주소가 든 HTML이 함께 오고 text/plain이 없으면 이미지 파일 붙여넣기로 처리해 같은 검사를 거쳐 올린다(주소는 본문에 넣지 않는다).
   */
  const handlePasteFiles = (event: ClipboardEvent<HTMLDivElement>) => {
    if (!imageUpload) return;
    const { clipboardData } = event;
    const files = Array.from(clipboardData.files).filter((file) => file.type.startsWith('image/'));
    if (files.length === 0 || clipboardData.getData('text/plain') !== '') return;
    event.preventDefault();
    if (!canUploadImage) return;
    void insertImageFiles(files, null);
  };
  return {
    isProcessing,
    insertImageFiles,
    handleDragOverFiles,
    handleDropFiles,
    handlePasteFiles,
  };
}
