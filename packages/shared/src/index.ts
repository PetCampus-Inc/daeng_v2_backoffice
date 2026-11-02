/** 백오피스 구성원의 직무. 권한과 무관한 표시용이다 (FR-BO-032). */
export const JOB_ROLES = ['PM', 'UX/UI', 'FE', 'BE', '풀스택'] as const;

export type JobRole = (typeof JOB_ROLES)[number];
