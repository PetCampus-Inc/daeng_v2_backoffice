import { MenuIcon } from 'lucide-react';
import type { Ref } from 'react';

import { Button } from '@/ui/atoms/button';
import { Logo } from '@/ui/atoms/logo';
import type { CompletedSessionUser } from '@/store/auth';

import { ProfilePanel } from '@/routes/app/ui/top-bar/ui/profile-panel';
import { NotificationCenter } from '@/routes/app/ui/top-bar/ui/notification-center';

type TopBarProps = {
  user?: CompletedSessionUser;
  sidebarOpen: boolean;
  sidebarId: string;
  onToggleSidebar: () => void;
  menuButtonRef: Ref<HTMLButtonElement>;
};

/**
 * 상단바(design.md 2장). 화면 전체 폭, 높이 64.
 * 왼쪽 ☰(왼쪽 여백 12) → 8 → 로고 + 회색 'BO'. ☰·로고는 사이드바 상태·화면 폭과 무관하게 같은 자리다.
 * 오른쪽 끝에 알림 → 프로필.
 */
export function TopBar({ user, sidebarOpen, sidebarId, onToggleSidebar, menuButtonRef }: TopBarProps) {
  return (
    <header className='fixed inset-x-0 top-0 z-40 flex h-kd-topbar items-center gap-2 border-b border-kd-border bg-kd-background px-3'>
      <Button
        ref={menuButtonRef}
        variant='ghost'
        size='icon'
        aria-label={sidebarOpen ? '메뉴 닫기' : '메뉴 열기'}
        aria-expanded={sidebarOpen}
        aria-controls={sidebarId}
        onClick={onToggleSidebar}
      >
        <MenuIcon aria-hidden strokeWidth={1.8} />
      </Button>
      {/* 로고 높이 24 → 8 → 회색 'BO'(12, 767px 이하 숨김). 시안 그대로 */}
      <div role='img' aria-label='똑독 BO' className='flex items-center gap-2'>
        <Logo />
        <span className='text-kd-caption font-semibold tracking-normal text-kd-foreground-muted max-[767px]:hidden'>
          BO
        </span>
      </div>
      <div className='ml-auto flex items-center gap-1'>
        {user && (
          <>
            <NotificationCenter key={user.email} user={user} />
            <ProfilePanel user={user} />
          </>
        )}
      </div>
    </header>
  );
}
