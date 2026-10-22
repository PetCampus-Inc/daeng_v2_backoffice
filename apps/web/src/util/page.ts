import { ROLES, type Role } from '@/type/role';

/** 메뉴 화면 하나의 주소·제목·볼 수 있는 역할. */
export type PageInfo = {
  path: string;
  title: string;
  roles: readonly Role[];
};

/** 최고 관리자·운영자만 보는 화면(1:1 문의). */
const STAFF_ROLES = ['superAdmin', 'operator'] as const satisfies readonly Role[];
/** 최고 관리자만 보는 화면(변경 이력, 팀원·권한). */
const SUPER_ADMIN_ROLES = ['superAdmin'] as const satisfies readonly Role[];

/** 메뉴 화면 목록. 역할은 PRD 4.1 권한표, 홈 주소 `/home`은 PRD 4.5를 따른다. */
export const PAGES = {
  home: { path: '/home', title: '홈', roles: ROLES },
  members: { path: '/members', title: '회원', roles: ROLES },
  kindergartens: { path: '/kindergartens', title: '유치원', roles: ROLES },
  ownerVerifications: { path: '/owner-verifications', title: '원장 인증 현황', roles: ROLES },
  inquiries: { path: '/inquiries', title: '1:1 문의', roles: STAFF_ROLES },
  ideas: { path: '/ideas', title: '아이디어 제안', roles: ROLES },
  notices: { path: '/notices', title: '앱 공지', roles: ROLES },
  terms: { path: '/terms', title: '이용약관', roles: ROLES },
  history: { path: '/history', title: '변경 이력', roles: SUPER_ADMIN_ROLES },
  teamMembers: { path: '/settings/members', title: '팀원·권한', roles: SUPER_ADMIN_ROLES },
} as const satisfies Record<string, PageInfo>;

/** 이 역할이 화면을 볼 수 있는지. */
export function canAccess(role: Role, page: PageInfo) {
  return page.roles.includes(role);
}

/** 브라우저 탭 제목 `{화면 제목} · 똑독 BO`(PRD 4.2). */
export function documentTitle(title: string) {
  return `${title} · 똑독 BO`;
}
