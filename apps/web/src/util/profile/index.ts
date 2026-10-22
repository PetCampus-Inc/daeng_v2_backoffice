import { JOB_ROLES, type JobRole } from '@daeng/shared';
import { z } from 'zod';

export const DISPLAY_NAME_ERROR = '표시명은 1~10자이며 이미 사용 중인 이름은 사용할 수 없습니다.';
export const JOB_ROLE_ERROR = '직무를 선택해 주세요.';

const CHARACTER_SEGMENTER = new Intl.Segmenter('ko', { granularity: 'grapheme' });

/** 한글 조합 글자와 이모지를 화면에서 보이는 글자 단위로 센다. */
export function countCharacters(value: string) {
  return [...CHARACTER_SEGMENTER.segment(value)].length;
}

/** 표시명은 공백만인 값을 제외하고 화면에 보이는 글자 기준 1~10자다. */
export function isValidDisplayName(value: string) {
  const length = countCharacters(value);
  return value.trim().length > 0 && length >= 1 && length <= 10;
}

/** 팀원 이름 `표시명 · 직무`. 문의 담당자·변경 이력 행위자 등 여러 화면이 같이 쓴다. */
export function formatProfileName(profile: { displayName: string; jobRole: JobRole }) {
  return `${profile.displayName} · ${profile.jobRole}`;
}

/** 첫 로그인 화면과 프로필 패널이 함께 쓰는 입력 규칙. */
export const profileFormSchema = z.object({
  displayName: z.string().refine(isValidDisplayName, DISPLAY_NAME_ERROR),
  jobRole: z
    .union([z.enum(JOB_ROLES), z.literal('')])
    .refine((value): value is JobRole => value !== '', { error: JOB_ROLE_ERROR }),
});

export type ProfileFormInput = z.input<typeof profileFormSchema>;
export type ProfileFormValues = z.output<typeof profileFormSchema>;
