import { toast } from 'sonner';
import { splitDecodableImages } from '@/util/image-decode';
import { checkImageFiles, limitImageCount, type ImageRejection } from '@/util/image-upload-rule';
import type { RichContentImageUpload } from '../type/rich-content-image-upload';

/** 올리지 않은 파일이 있으면 이유별 개수를 줄바꿈으로 묶어 토스트 하나로 안내한다. 파일 이름은 넣지 않고 없으면 띄우지 않는다. */
function showImageRejectionNotice(rejections: ImageRejection[]) {
  const lines = rejections.filter(({ count }) => count > 0);
  const total = lines.reduce((sum, { count }) => sum + count, 0);
  if (total === 0) return;
  toast.error(`이미지 ${total}장을 올리지 못했어요.`, {
    description: lines.map(({ label, count }) => `${label} ${count}장`).join('\n'),
    classNames: {
      title: 'font-bold!',
      description: 'mt-1 whitespace-pre-line',
    },
  });
}

/**
 * 고른 파일 중 올려도 되는 파일만 가린다. 순서는 값싼 규칙(형식·빈 파일·용량) → 손상 검사(통과한 파일만 한 장씩) → 개수 자르기이고,
 * 올리지 않은 파일은 안내 줄 순서(형식 → 빈 파일 → 용량 → 손상 → 개수 초과)로 모아 토스트 하나로 보여 준다.
 */
export async function pickUploadableImages(
  files: File[],
  imageUpload: RichContentImageUpload,
  getImageCount: () => number
): Promise<File[]> {
  const checked = checkImageFiles(files, imageUpload);
  const { decodable, corrupt } = await splitDecodableImages(checked.passed);
  const limited = limitImageCount(decodable, getImageCount(), imageUpload);
  showImageRejectionNotice([
    ...checked.rejections,
    { label: '손상된 이미지', count: corrupt.length },
    ...limited.rejections,
  ]);
  return limited.uploadable;
}
