import { useRef, useState } from 'react';
import { Navigate, Outlet, useLocation, useMatches } from 'react-router';

import { Sheet, SheetContent, SheetTitle } from '@/ui/atoms/sheet';
import { cn } from '@/util/cn';
import { Forbidden } from '@/routes/app/ui/forbidden';
import { SidebarNav } from '@/routes/app/ui/sidebar';
import { TopBar } from '@/routes/app/ui/top-bar';
import { useMediaQuery, WIDE_QUERY } from '@/routes/app/util/use-media-query';
import { useAuthStore } from '@/store/auth';
import { canAccess, type PageInfo } from '@/util/page';

const SIDEBAR_ID = 'app-sidebar';

/** 라우트 handle. 메뉴 화면은 page를 달아 역할 검사에 쓴다. */
export type AppRouteHandle = { page?: PageInfo };

/**
 * 로그인한 뒤의 화면 틀(PRD 4.2, design.md 1.6·2장): 상단바 + 사이드바 + 본문.
 * - 로그인하지 않았으면 로그인 화면으로 보낸다.
 * - 역할에 허용되지 않은 화면을 주소로 열면 권한 없음 화면을 보여 준다(PRD 4.1).
 * - 1200px 이상은 사이드바를 펼친 채 시작하고 본문 옆에 붙인다. 미만은 접힌 채 시작하고 펼치면 본문 위에 겹쳐 연다.
 *   폭이 기준을 넘나들면 그 폭의 시작 상태로 돌아가고, 접힘 상태는 기억하지 않는다.
 */
export default function AppLayout() {
  const user = useAuthStore((state) => state.user);
  const location = useLocation();
  const matches = useMatches();
  const isWide = useMediaQuery(WIDE_QUERY);
  const [sidebarOpen, setSidebarOpen] = useState(isWide);
  const [prevIsWide, setPrevIsWide] = useState(isWide);
  const menuButtonRef = useRef<HTMLButtonElement>(null);

  if (prevIsWide !== isWide) {
    setPrevIsWide(isWide);
    setSidebarOpen(isWide);
  }

  if (!user) {
    return <Navigate to='/login' replace state={{ from: `${location.pathname}${location.search}` }} />;
  }

  const page = matches.map((match) => (match.handle as AppRouteHandle | undefined)?.page).findLast(Boolean);
  const forbiddenPage = page && !canAccess(user.role, page) ? page : undefined;
  const nav = <SidebarNav role={user.role} onNavigate={isWide ? undefined : () => setSidebarOpen(false)} />;

  return (
    <div className='min-h-svh bg-kd-surface'>
      <TopBar
        user={user}
        sidebarOpen={sidebarOpen}
        sidebarId={SIDEBAR_ID}
        onToggleSidebar={() => setSidebarOpen((open) => !open)}
        menuButtonRef={menuButtonRef}
      />
      {isWide ? (
        sidebarOpen && (
          <aside
            id={SIDEBAR_ID}
            className='fixed top-kd-topbar bottom-0 left-0 z-30 w-kd-sidebar overflow-y-auto border-r border-kd-border bg-kd-background'
          >
            {nav}
          </aside>
        )
      ) : (
        <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
          <SheetContent
            id={SIDEBAR_ID}
            // 사이드바는 미끄러짐·흐려짐 없이 바로 열고 닫는다. 막(overlay)은 atom이 className을 받지 않아
            // 바로 뒤에 이 패널이 붙은 막을 골라 끈다.
            className='animate-none! [[data-slot=sheet-overlay]:has(+&)]:animate-none!'
            onCloseAutoFocus={(event) => {
              // 메뉴를 고르거나 Esc·막을 눌러 접히면 초점은 ☰로 돌아간다(design.md 1.6)
              event.preventDefault();
              menuButtonRef.current?.focus();
            }}
          >
            <SheetTitle className='sr-only'>메뉴</SheetTitle>
            {nav}
          </SheetContent>
        </Sheet>
      )}
      <main className={cn('pt-kd-topbar', isWide && sidebarOpen && 'pl-kd-sidebar')}>
        {/* 페이지 바깥 여백 32, 1199px 이하 위아래 24·좌우 32, 767px 이하 좌우 16(design.md 1.3) */}
        <div className='p-8 max-[1199px]:py-6 max-[767px]:px-4'>
          {forbiddenPage ? <Forbidden title={forbiddenPage.title} /> : <Outlet />}
        </div>
      </main>
    </div>
  );
}
