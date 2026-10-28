import { JobRole } from '@/type/job-role';

/** 직무 5종(FR-BO-032). 프로필 입력의 선택지 순서다. */
export const JOB_ROLES = [JobRole.PM, JobRole.UX_UI, JobRole.FE, JobRole.BE, JobRole.FULL_STACK] as const;

/** 화면에 보이는 직무 이름. */
export const JOB_ROLE_LABELS: Record<JobRole, string> = {
  PM: 'PM',
  UX_UI: 'UX/UI',
  FE: 'FE',
  BE: 'BE',
  FULL_STACK: '풀스택',
};
