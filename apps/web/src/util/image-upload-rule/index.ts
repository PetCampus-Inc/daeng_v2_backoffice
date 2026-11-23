import { getSubjectParticle } from '@/util/subject-particle';

/**
 * 이미지 업로드 규칙 값. 화면이 값만 주고 판정은 공용 편집기가 이 파일의 함수로 한다.
 * `allowedTypes`는 서버가 이름과 형식이 다른 파일을 거절하므로 형식(MIME)마다 맞는 확장자를 함께 준다.
 */
export type ImageUploadRule = {
  /** 허용 형식(MIME) → 그 형식의 파일 확장자 목록. 예: `{ 'image/jpeg': ['.jpg', '.jpeg'] }` */
  allowedTypes: Record<string, string[]>;
  /** 안내 문구에 쓸 형식 이름. 예: `JPG·PNG`. 뒤에 붙는 조사(이/가)는 받침에 따라 문구를 만들 때 고른다. */
  typeLabel: string;
  /** 파일 하나의 최대 용량(바이트) */
  maxBytes: number;
  /** 본문 하나에 넣을 수 있는 최대 이미지 수. 한 번에 올리는 수도 이 값을 넘지 않는다. */
  maxCount: number;
};

/** 판정에 필요한 값만 담은 파일 모양(브라우저 `File`도 맞는다). */
export type ImageFileLike = { name: string; type: string; size: number };

/** 올리지 않은 파일 묶음. 안내 한 줄(`label` + 장수)이 된다. */
export type ImageRejection = { label: string; count: number };

const BYTES_PER_MB = 1024 * 1024;

/** 파일 선택창에 거는 `accept` 값을 허용 형식에서 만든다. */
export function getImageAccept(allowedTypes: ImageUploadRule['allowedTypes']): string {
  return Object.keys(allowedTypes).join(',');
}

/** 형식(MIME)이 허용 목록에 있고 확장자가 그 형식과 맞는지 본다. */
function isAllowedImageType(file: ImageFileLike, allowedTypes: ImageUploadRule['allowedTypes']): boolean {
  const extensions = allowedTypes[file.type];
  const name = file.name.toLowerCase();
  return !!extensions && extensions.some((extension) => name.endsWith(extension));
}

/**
 * 고른 파일을 파일마다 형식 → 빈 파일(0바이트) → 최대 용량 순으로 보고(먼저 걸리는 이유 하나만 센다), 통과한 파일을 고른 순서대로 돌려준다.
 * 값싼 검사라 파일을 열어 보기 전에 한다. 올리지 않은 이유는 개수가 있는 것만 안내 줄 순서(형식 → 빈 파일 → 용량)로 돌려준다.
 * 손상(열어 보기)과 개수 한도는 이 뒤에 본다.
 */
export function checkImageFiles<TFile extends ImageFileLike>(
  files: TFile[],
  rule: Pick<ImageUploadRule, 'allowedTypes' | 'typeLabel' | 'maxBytes'>
): { passed: TFile[]; rejections: ImageRejection[] } {
  const passed: TFile[] = [];
  const counts = { type: 0, empty: 0, size: 0 };
  for (const file of files) {
    if (!isAllowedImageType(file, rule.allowedTypes)) counts.type += 1;
    else if (file.size <= 0) counts.empty += 1;
    else if (file.size > rule.maxBytes) counts.size += 1;
    else passed.push(file);
  }
  const maxMegabytes = Number((rule.maxBytes / BYTES_PER_MB).toFixed(1));
  const rejections = [
    {
      label: `${rule.typeLabel}${getSubjectParticle(rule.typeLabel)} 아닌 파일`,
      count: counts.type,
    },
    { label: '비어 있는 파일', count: counts.empty },
    { label: `${maxMegabytes}MB를 넘는 파일`, count: counts.size },
  ].filter(({ count }) => count > 0);
  return { passed, rejections };
}

/**
 * 규칙·손상 검사를 통과한 파일을 고른 순서대로 남은 자리(`maxCount - 본문에 이미 든 이미지 수`, 0 미만이면 0)만큼 앞에서부터 올린다.
 * 자리를 넘는 파일은 개수 초과 안내로만 센다.
 */
export function limitImageCount<TFile>(
  files: TFile[],
  currentImageCount: number,
  rule: Pick<ImageUploadRule, 'maxCount'>
): { uploadable: TFile[]; rejections: ImageRejection[] } {
  const slots = Math.max(0, rule.maxCount - currentImageCount);
  const uploadable = files.slice(0, slots);
  const overCount = files.length - uploadable.length;
  return {
    uploadable,
    rejections: overCount > 0 ? [{ label: `${rule.maxCount}장 한도를 넘는 이미지`, count: overCount }] : [],
  };
}
