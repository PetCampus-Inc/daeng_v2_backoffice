import type { ImageUploadRule } from '@/util/image-upload-rule';

/**
 * 이미지 업로드를 켜는 값. 화면은 규칙 값(`ImageUploadRule`: 허용 형식·형식 이름·최대 용량·최대 개수)과 올리기만 주고,
 * 편집기가 파일을 형식 → 빈 파일 → 용량 → 손상 → 개수 순으로 판정해 올려도 되는 파일만 `upload`에 넘긴다.
 * 올리지 않은 파일은 이유별 개수를 토스트 하나로 안내한다.
 */
export type RichContentImageUpload = ImageUploadRule & {
  /** 업로드 중이면 이미지 버튼·끌어다 놓기·붙여넣기를 잠근다. */
  isUploading: boolean;
  /** 올려도 되는 파일만 받아 올리고 성공한 이미지를 돌려준다. 올리기 자체의 실패 안내는 화면이 한다. */
  upload: (files: File[]) => Promise<{ tempKey: string; originalFilename: string }[]>;
  /** 저장으로 확정된 이미지(`tempKey`→`imageId`). 본문의 같은 이미지 블록을 `imageId`로 바꾼다. */
  confirmed?: Record<string, number>;
};
