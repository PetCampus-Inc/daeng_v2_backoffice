import type { Role } from '@/type/role';
import { canAccess, PAGES, type PageInfo } from '@/util/page';

/** 기존 팀 체크인 화면(PRD 7.16). BO 밖에서 새 탭으로 연다. */
export const CHECK_IN_URL = 'https://admin.knockdog.net/';

/** 사이드바 메뉴 하나. BO 화면이거나, 새 탭으로 여는 바깥 링크다. */
export type MenuItem = { kind: 'page'; page: PageInfo } | { kind: 'external'; label: string; href: string };

/** 메뉴 묶음. 이름이 없는 묶음(홈, 변경 이력)은 들여쓰지 않는다(design.md 2장). */
export type MenuSection = { group?: string; items: MenuItem[] };

/** 메뉴트리(PRD 4.2). 순서·묶음 이름이 사이드바에 그대로 나온다. */
const MENU: MenuSection[] = [
  { items: [{ kind: 'page', page: PAGES.home }] },
  {
    group: '고객 관리',
    items: [
      { kind: 'page', page: PAGES.members },
      { kind: 'page', page: PAGES.kindergartens },
      { kind: 'page', page: PAGES.ownerVerifications },
    ],
  },
  {
    group: '서비스 운영',
    items: [
      { kind: 'page', page: PAGES.inquiries },
      { kind: 'page', page: PAGES.ideas },
      { kind: 'page', page: PAGES.notices },
      { kind: 'page', page: PAGES.terms },
    ],
  },
  // 팀 체크인은 모든 역할이 본다(PRD 4.1)
  { group: '팀 운영', items: [{ kind: 'external', label: '팀 체크인', href: CHECK_IN_URL }] },
  { items: [{ kind: 'page', page: PAGES.history }] },
  { group: '설정', items: [{ kind: 'page', page: PAGES.teamMembers }] },
];

/** 역할에 허용된 메뉴만 남긴다. 항목이 모두 숨으면 묶음째 숨긴다(예: 운영자의 '설정'). */
export function visibleMenu(role: Role): MenuSection[] {
  return MENU.map((section) => ({
    ...section,
    items: section.items.filter((item) => item.kind === 'external' || canAccess(role, item.page)),
  })).filter((section) => section.items.length > 0);
}
