import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC = 'auth:isPublic';
export const ALLOW_INCOMPLETE_PROFILE = 'auth:allowIncompleteProfile';

/** 로그인하지 않아도 부를 수 있는 API. 나머지는 기본이 로그인 필수다. */
export const Public = () => SetMetadata(IS_PUBLIC, true);

/** 첫 로그인 프로필을 완료하기 전에도 부를 수 있는 API(`/me`, 프로필 저장, 로그아웃). */
export const AllowIncompleteProfile = () => SetMetadata(ALLOW_INCOMPLETE_PROFILE, true);
