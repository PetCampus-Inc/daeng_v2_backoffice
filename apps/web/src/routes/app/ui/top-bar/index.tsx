import { BellIcon, MenuIcon } from 'lucide-react';
import type { Ref } from 'react';

import { Button } from '@/ui/atoms/button';
import { Field, FieldDescription, FieldLabel } from '@/ui/atoms/field';
import { Logo } from '@/ui/atoms/logo';
import { Popover, PopoverContent, PopoverHeader, PopoverTitle, PopoverTrigger } from '@/ui/atoms/popover';
import { RadioGroup, RadioGroupItem } from '@/ui/atoms/radio-group';
import { ROLE_LABELS, ROLES, type Role } from '@/type/role';
import { useAuthStore, type SessionUser } from '@/store/auth';

type TopBarProps = {
  user: SessionUser;
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
        <NotificationButton />
        <ProfileButton user={user} />
      </div>
    </header>
  );
}

/** 알림 아이콘 버튼. 알림 센터(7.14)를 만들기 전까지 팝오버에 '준비 중'만 보여 준다. */
function NotificationButton() {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant='ghost' size='icon' aria-label='알림'>
          <BellIcon aria-hidden strokeWidth={1.8} />
        </Button>
      </PopoverTrigger>
      <PopoverContent>
        <PopoverHeader>
          <PopoverTitle>알림</PopoverTitle>
        </PopoverHeader>
        <p className='px-6 py-5 text-kd-body text-kd-foreground-muted'>준비 중입니다.</p>
      </PopoverContent>
    </Popover>
  );
}

/**
 * 프로필 버튼(`표시명 · 직무`, 1199px 이하는 직무 숨김)과 팝오버.
 * 프로필 패널(7.15)을 만들기 전까지 개발용 역할 전환과 로그아웃만 둔다.
 */
function ProfileButton({ user }: { user: SessionUser }) {
  const devLogin = useAuthStore((state) => state.devLogin);
  const logout = useAuthStore((state) => state.logout);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant='ghost' className='gap-1.5 px-3'>
          <span>{user.displayName}</span>
          <span className='font-normal text-kd-foreground-muted max-[1199px]:hidden'>{user.jobRole}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent>
        <PopoverHeader>
          <PopoverTitle>내 계정</PopoverTitle>
        </PopoverHeader>
        <div className='px-6 py-5'>
          <Field>
            <FieldLabel>역할 전환(개발용)</FieldLabel>
            <RadioGroup value={user.role} onValueChange={(value) => devLogin(value as Role)}>
              {ROLES.map((role) => (
                <RadioGroupItem key={role} value={role}>
                  {ROLE_LABELS[role]}
                </RadioGroupItem>
              ))}
            </RadioGroup>
            <FieldDescription>구글 로그인을 붙이기 전까지 쓰는 임시 기능이에요.</FieldDescription>
          </Field>
        </div>
        <div className='flex border-t border-kd-border px-6 py-4'>
          <Button variant='destructive-ghost' size='sm' onClick={logout}>
            로그아웃
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
