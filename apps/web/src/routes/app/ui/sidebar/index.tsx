import { useQuery } from '@tanstack/react-query';
import { NavLink } from 'react-router';

import { overviewQueryOptions } from '@/api/overview';
import { cn } from '@/util/cn';
import { formatCount } from '@/util/count-format';
import { PAGES } from '@/util/page-config';
import { getVerificationSummary } from '@/util/verification-summary';
import type { Role } from '@/type/role';

import { visibleMenu, type MenuItem } from '@/routes/app/util/menu';

/** 메뉴 항목 공통 모양. 본문 600 진한 글자, 모서리 8. */
const itemClassName =
  'flex h-kd-control items-center rounded-kd-2 px-3 text-kd-body font-semibold text-kd-foreground outline-none hover:bg-kd-surface focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-kd-primary focus-visible:outline-solid';

/**
 * 사이드바 메뉴(design.md 2장). 역할에 허용된 메뉴만 보인다(PRD 4.1).
 * 현재 메뉴는 `--kd-surface-accent` 배경 + 주황 700. 묶음 안 메뉴는 왼쪽 24로 들여쓴다.
 * onNavigate는 메뉴를 고를 때 부른다(좁은 화면에서 사이드바를 접는 데 쓴다).
 */
export function SidebarNav({
  role,
  disabled = false,
  onNavigate,
}: {
  role: Role;
  disabled?: boolean;
  onNavigate?: () => void;
}) {
  const sections = visibleMenu(role);

  return (
    <nav aria-label='메뉴' className='flex flex-col p-3'>
      {sections.map((section, index) => {
        const groupId = section.group ? `sidebar-group-${index}` : undefined;
        return (
          <div key={section.group ?? index} className={cn(index > 0 && 'mt-3 border-t border-kd-neutral-200 pt-3')}>
            {section.group && (
              <p id={groupId} className='px-3 pb-1 text-kd-caption font-semibold text-kd-foreground-muted'>
                {section.group}
              </p>
            )}
            <ul aria-labelledby={groupId} className={cn('flex flex-col gap-0.5', disabled && 'opacity-45')}>
              {section.items.map((item) => (
                <li key={menuItemKey(item)}>
                  <SidebarItem
                    item={item}
                    indented={Boolean(section.group)}
                    disabled={disabled}
                    onNavigate={onNavigate}
                  />
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </nav>
  );
}

/** 메뉴 항목의 key. 화면은 주소, 바깥 링크는 주소(href)로 구분한다. */
function menuItemKey(item: MenuItem) {
  return item.kind === 'page' ? item.page.path : item.href;
}

/** 메뉴 항목 하나. 바깥 링크(팀 체크인)는 새 탭으로 연다. */
function SidebarItem({
  item,
  indented,
  disabled,
  onNavigate,
}: {
  item: MenuItem;
  indented: boolean;
  disabled: boolean;
  onNavigate?: () => void;
}) {
  if (disabled) {
    return (
      <span aria-disabled className={cn(itemClassName, 'cursor-not-allowed', indented && 'pl-6')}>
        {item.kind === 'page' ? item.page.title : item.label}
      </span>
    );
  }

  if (item.kind === 'external') {
    return (
      <a
        href={item.href}
        target='_blank'
        rel='noopener noreferrer'
        className={cn(itemClassName, indented && 'pl-6')}
        onClick={onNavigate}
      >
        {item.label}
        <span className='sr-only'> (새 탭에서 열림)</span>
      </a>
    );
  }

  return (
    <NavLink
      to={item.page.path}
      className={({ isActive }) =>
        cn(itemClassName, indented && 'pl-6', isActive && 'bg-kd-surface-accent font-bold text-kd-primary')
      }
      onClick={onNavigate}
    >
      {item.page.title}
      {item.page.path === PAGES.ownerVerifications.path && <VerificationCountBadge />}
    </NavLink>
  );
}

/**
 * '원장 인증 현황' 메뉴의 주황 배지. 홈 '인증 진행 중'과 같은 값이며 홈과 같은 요청을 함께 쓴다(S-인증-012).
 * 0건이면 `0`, 불러오는 중·실패면 `—`(service-admin.html 기준).
 */
function VerificationCountBadge() {
  const overviewQuery = useQuery(overviewQueryOptions());
  const stats = overviewQuery.data?.stats;
  const count = stats
    ? formatCount(getVerificationSummary(stats.verificationCounts, stats.revokedOwners).inProgress)
    : null;
  return (
    <span className='ml-auto min-w-[22px] rounded-kd-full bg-kd-primary px-[7px] py-0.5 text-center text-kd-caption font-semibold text-kd-primary-foreground tabular-nums'>
      <span aria-hidden>{count ?? '—'}</span>
      <span className='sr-only'>{count === null ? ', 인증 진행 중 수 없음' : `, 인증 진행 중 ${count}건`}</span>
    </span>
  );
}
