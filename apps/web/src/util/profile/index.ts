import { z } from 'zod';

import type { JobRole } from '@/type/job-role';
import { JOB_ROLE_LABELS, JOB_ROLES } from '@/type/job-role-ui';

export const DISPLAY_NAME_ERROR = '표시명은 1~10자이며 이미 사용 중인 이름은 사용할 수 없습니다.';
export const JOB_ROLE_ERROR = '직무를 선택해 주세요.';

/**
 * 글자 수를 서버와 같은 내부 길이(UTF-16, `string.length`)로 센다. 서버가 같은 기준으로 길이를 검사하므로
 * 화면에서 보이는 글자 수와 다를 수 있다(예: 이모지 `😀`는 2, 가족 이모지 `👨‍👩‍👧‍👦`는 11).
 */
export function countCharacters(value: string) {
  return value.length;
}

/** 표시명은 공백만인 값을 제외하고 서버와 같은 내부 길이 기준 1~10자다. */
export function isValidDisplayName(value: string) {
  const length = countCharacters(value);
  return value.trim().length > 0 && length >= 1 && length <= 10;
}

/** 팀원 이름 `표시명 · 직무`. 문의 담당자·변경 이력 행위자 등 여러 화면이 같이 쓴다. */
export function formatProfileName(profile: { displayName: string; jobRole: JobRole }) {
  return `${profile.displayName} · ${JOB_ROLE_LABELS[profile.jobRole]}`;
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
