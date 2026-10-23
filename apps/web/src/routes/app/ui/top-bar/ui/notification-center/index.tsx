import { useQuery, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { BellIcon } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { apiClient } from '@/api/client';
import { useAuthStore, type CompletedSessionUser } from '@/store/auth';
import { useLeaveGuardStore } from '@/store/leave-guard';
import { Button } from '@/ui/atoms/button';
import { Popover, PopoverContent, PopoverHeader, PopoverTitle, PopoverTrigger } from '@/ui/atoms/popover';
import { showErrorToast } from '@/ui/atoms/sonner';
import { cn } from '@/util/cn';
import { formatDate } from '@/util/date-format';
import { notificationsQueryOptions, patchNotificationsRead } from './api/notifications';
import type { Notification } from './type/notification';

/** 개인별 읽음 상태와 작성 중 이탈 확인을 연결하는 상단바 알림 센터. */
export function NotificationCenter({ user }: { user: CompletedSessionUser }) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const options = notificationsQueryOptions(user.email);
  const [isOpen, setIsOpen] = useState(false);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const query = useQuery({ ...options, enabled: pendingId === null });
  const [error, setError] = useState<string | null>(null);
  const busyRef = useRef(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const allReadButtonRef = useRef<HTMLButtonElement>(null);
  const listScrollTopRef = useRef(0);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const shouldRestoreWorkRef = useRef(false);
  const wasLeavePendingRef = useRef(false);
  const requestLeave = useLeaveGuardStore((state) => state.requestLeave);
  const isLeavePending = useLeaveGuardStore((state) => state.pendingAction !== null);
  const unreadCount = query.data?.filter((item) => !item.isRead).length;

  useEffect(() => {
    const rememberWorkFocus = (event: FocusEvent) => {
      if (
        event.target instanceof HTMLElement &&
        event.target.closest('main') &&
        event.target.matches('input, textarea, [contenteditable="true"]')
      ) {
        previousFocusRef.current = event.target;
      }
    };
    document.addEventListener('focusin', rememberWorkFocus);
    return () => document.removeEventListener('focusin', rememberWorkFocus);
  }, []);

  // 이탈 확인에서 취소하면 알림을 읽지 않고 원래 입력 위치로 돌아간다.
  useEffect(() => {
    if (wasLeavePendingRef.current && !isLeavePending && !busyRef.current) {
      shouldRestoreWorkRef.current = true;
      setIsOpen(false);
    }
    wasLeavePendingRef.current = isLeavePending;
  }, [isLeavePending]);

  const isCurrentAccount = () => useAuthStore.getState().user?.email === user.email;

  async function handleRead(item?: Notification) {
    if (busyRef.current || !isCurrentAccount()) return;
    busyRef.current = true;
    setPendingId(item?.id ?? 'all');
    setError(null);
    try {
      // 이미 진행 중인 조회가 뒤늦게 읽음 결과를 덮어쓰지 않게 한다.
      await queryClient.cancelQueries({ queryKey: options.queryKey });
      let canNavigate = true;
      if (item) {
        try {
          await apiClient.get(`/${item.targetType === 'inquiry' ? 'inquiries' : 'ideas'}/${item.targetId}`);
        } catch (cause) {
          if (axios.isAxiosError(cause) && [403, 404, 410].includes(cause.response?.status ?? 0)) canNavigate = false;
          else throw cause;
        }
      }
      if (!isCurrentAccount()) return;
      const items = item?.isRead ? query.data! : await patchNotificationsRead(item?.id);
      if (!isCurrentAccount()) return;
      queryClient.setQueryData(options.queryKey, items);
      if (!item) {
        listRef.current?.focus({ preventScroll: true });
      } else if (canNavigate) {
        setIsOpen(false);
        navigate(`/${item.targetType === 'inquiry' ? 'inquiries' : 'ideas'}/${item.targetId}`);
      } else {
        showErrorToast('처리가 완료되었거나 볼 수 없는 항목입니다.');
      }
    } catch {
      if (isCurrentAccount()) setError('알림을 처리하지 못했습니다. 같은 항목을 다시 눌러 주세요.');
    } finally {
      busyRef.current = false;
      setPendingId(null);
    }
  }

  function handleSelect(item: Notification) {
    if (busyRef.current || isLeavePending) return;
    requestLeave(() => {
      void handleRead(item);
    });
  }

  return (
    <Popover
      open={isOpen}
      onOpenChange={(open) => {
        if (isLeavePending) return;
        if (open) {
          shouldRestoreWorkRef.current = false;
          setError(null);
          // staleTime 내 재개방은 캐시를 바로 보여 주고, 오래된 알림만 갱신한다.
          if (!busyRef.current) void queryClient.fetchQuery(options).catch(() => {});
        }
        setIsOpen(open);
      }}
    >
      <PopoverTrigger asChild>
        <Button
          ref={triggerRef}
          variant='ghost'
          size='icon'
          className='relative'
          aria-label={
            unreadCount === undefined ? '알림 상태 확인 중' : unreadCount > 0 ? `알림 ${unreadCount}건 안 읽음` : '알림'
          }
          onPointerDown={() => {
            previousFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
          }}
        >
          <BellIcon aria-hidden strokeWidth={1.8} />
          {unreadCount !== undefined && unreadCount > 0 && (
            <span
              aria-hidden
              className='absolute -top-0.5 -right-0.5 min-w-4 rounded-full bg-kd-primary px-1 text-[11px] leading-[18px] font-bold text-kd-primary-foreground'
            >
              {unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        aria-label='알림 센터'
        collisionPadding={16}
        onOpenAutoFocus={(event) => {
          if (listRef.current) listRef.current.scrollTop = listScrollTopRef.current;
          const target = allReadButtonRef.current ?? listRef.current;
          if (target) {
            event.preventDefault();
            target.focus({ preventScroll: true });
          }
        }}
        onInteractOutside={(event) => {
          if (isLeavePending) event.preventDefault();
        }}
        onEscapeKeyDown={(event) => {
          if (isLeavePending) event.preventDefault();
        }}
        onCloseAutoFocus={(event) => {
          if (shouldRestoreWorkRef.current && previousFocusRef.current?.isConnected) {
            event.preventDefault();
            previousFocusRef.current.focus({ preventScroll: true });
          }
        }}
      >
        <PopoverHeader>
          <PopoverTitle>알림</PopoverTitle>
          {unreadCount !== undefined && unreadCount > 0 && (
            <Button
              ref={allReadButtonRef}
              variant='link'
              size='sm'
              disabled={pendingId !== null || isLeavePending}
              onClick={() => void handleRead()}
            >
              {pendingId === 'all' ? '처리 중…' : '모두 읽음'}
            </Button>
          )}
        </PopoverHeader>
        <div role='status' aria-live='polite' className='sr-only'>
          {pendingId ? '알림 처리 중' : unreadCount === undefined ? '알림 확인 중' : `안 읽은 알림 ${unreadCount}건`}
        </div>
        {query.isPending && (
          <p role='status' className='px-6 py-5 text-kd-body text-kd-foreground-muted'>
            알림을 불러오는 중…
          </p>
        )}
        {query.isError && (
          <div role='alert' className='px-6 py-4 text-kd-body'>
            <p>알림을 불러오지 못했습니다.</p>
            <Button variant='link' size='sm' disabled={query.isFetching} onClick={() => void query.refetch()}>
              다시 시도
            </Button>
          </div>
        )}
        {error && (
          <p role='alert' className='px-6 py-3 text-kd-sub text-kd-error-foreground'>
            {error}
          </p>
        )}
        {query.data && (
          <ul
            ref={listRef}
            onScroll={(event) => {
              listScrollTopRef.current = event.currentTarget.scrollTop;
            }}
            tabIndex={-1}
            aria-label='알림 목록'
            aria-busy={pendingId !== null}
            className='max-h-[min(480px,calc(100dvh-180px))] overflow-y-auto overscroll-contain outline-none focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-kd-primary'
          >
            {query.data.length === 0 && (
              <li className='px-6 py-8 text-center text-kd-body text-kd-foreground-muted'>새로운 알림이 없습니다.</li>
            )}
            {query.data.map((item) => (
              <li key={item.id} className='border-b border-kd-border last:border-0'>
                <button
                  type='button'
                  disabled={pendingId !== null || isLeavePending}
                  onClick={() => handleSelect(item)}
                  aria-label={`${item.isRead ? '읽음' : '안 읽음'}: ${item.message}`}
                  className={cn(
                    'flex w-full gap-3 px-6 py-4 text-left outline-none hover:bg-kd-surface focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-kd-primary disabled:cursor-wait',
                    item.isRead && 'text-kd-foreground-muted'
                  )}
                >
                  <span
                    aria-hidden
                    className={cn('mt-1.5 size-2 shrink-0 rounded-full', !item.isRead && 'bg-kd-primary')}
                  />
                  <span className='min-w-0 flex-1'>
                    <span className='block text-kd-body wrap-anywhere'>{item.message}</span>
                    <time dateTime={item.createdAt} className='mt-1 block text-kd-caption text-kd-foreground-muted'>
                      {pendingId === item.id ? '처리 중…' : formatDate(item.createdAt, true)}
                    </time>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </PopoverContent>
    </Popover>
  );
}
