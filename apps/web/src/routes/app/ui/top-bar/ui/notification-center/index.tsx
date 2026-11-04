import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { BellIcon } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { getIdea } from '@/routes/ideas/api/use-ideas';
import { getInquiry } from '@/routes/inquiries/api/use-inquiries';
import { useAuthStore, type CompletedSessionUser } from '@/store/auth';
import { useLeaveGuardStore } from '@/store/leave-guard';
import { Button } from '@/ui/atoms/button';
import { Popover, PopoverContent, PopoverHeader, PopoverTitle, PopoverTrigger } from '@/ui/atoms/popover';
import { showErrorToast } from '@/ui/atoms/sonner';
import { cn } from '@/util/cn';
import { formatDate } from '@/util/date-format';
import {
  notificationListQueryKey,
  notificationListQueryOptions,
  unreadCountQueryKey,
  unreadCountQueryOptions,
} from './api/notification-query';
import { useGetUnreadNotificationCount, useReadAllNotifications, useReadNotification } from './api/use-notifications';
import { NotificationTargetType, type Notification } from './type';
import { getNotificationPath, getNotificationText, isNotificationRead } from './util/notification-text';
import { useLoadMoreOnReach } from './util/use-load-more-on-reach';

/** 개인별 읽음 상태와 작성 중 이탈 확인을 연결하는 상단바 알림 센터. */
export function NotificationCenter({ user }: { user: CompletedSessionUser }) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const listKey = notificationListQueryKey(user.email);
  const countKey = unreadCountQueryKey(user.email);
  const [isOpen, setIsOpen] = useState(false);
  const [pendingId, setPendingId] = useState<number | 'all' | null>(null);
  // 목록은 팝오버가 열려 있을 때만 받는다. 배지 숫자는 따로 받는 안 읽은 수를 쓴다.
  const query = useInfiniteQuery({ ...notificationListQueryOptions(user.email), enabled: isOpen });
  const countQuery = useGetUnreadNotificationCount({ query: unreadCountQueryOptions(user.email) });
  const readNotification = useReadNotification();
  const readAllNotifications = useReadAllNotifications();
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
  const unreadCount = countQuery.data?.count;
  // 이어 붙이는 사이에 새 알림이 생기면 페이지 경계에서 같은 알림이 겹칠 수 있어 번호로 거른다.
  const items = query.data?.pages
    .flatMap((page) => page.items)
    .filter((item, index, all) => all.findIndex((other) => other.id === item.id) === index);
  const sentinelRef = useLoadMoreOnReach(listRef, () => void query.fetchNextPage());

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
      await Promise.all([
        queryClient.cancelQueries({ queryKey: listKey }),
        queryClient.cancelQueries({ queryKey: countKey }),
      ]);
      let canNavigate = true;
      if (item) {
        try {
          if (item.targetType === NotificationTargetType.INQUIRY) await getInquiry(item.targetId);
          else await getIdea(item.targetId);
        } catch (cause) {
          if (axios.isAxiosError(cause) && [403, 404, 410].includes(cause.response?.status ?? 0)) canNavigate = false;
          else throw cause;
        }
      }
      if (!isCurrentAccount()) return;
      if (!item) await readAllNotifications.mutateAsync();
      else if (!isNotificationRead(item)) await readNotification.mutateAsync({ id: item.id });
      if (!isCurrentAccount()) return;
      // 낙관적 갱신 없이, 읽음이 성공한 뒤 서버 값으로 목록과 안 읽은 수를 다시 받는다.
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: listKey }),
        queryClient.invalidateQueries({ queryKey: countKey }),
      ]);
      if (!item) {
        listRef.current?.focus({ preventScroll: true });
      } else if (canNavigate) {
        setIsOpen(false);
        navigate(getNotificationPath(item));
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
          // staleTime 내 재개방은 캐시를 바로 보여 주고, 오래된 알림만 갱신한다(목록 조회가 열릴 때 켜진다).
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
        {query.isError && !query.isFetchNextPageError && (
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
        {items && (
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
            {items.length === 0 && (
              <li className='px-6 py-8 text-center text-kd-body text-kd-foreground-muted'>새로운 알림이 없습니다.</li>
            )}
            {items.map((item) => (
              <li key={item.id} className='border-b border-kd-border last:border-0'>
                <button
                  type='button'
                  disabled={pendingId !== null || isLeavePending}
                  onClick={() => handleSelect(item)}
                  aria-label={`${isNotificationRead(item) ? '읽음' : '안 읽음'}: ${getNotificationText(item)}`}
                  className={cn(
                    'flex w-full gap-3 px-6 py-4 text-left outline-none hover:bg-kd-surface focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-kd-primary disabled:cursor-wait',
                    isNotificationRead(item) && 'text-kd-foreground-muted'
                  )}
                >
                  <span
                    aria-hidden
                    className={cn('mt-1.5 size-2 shrink-0 rounded-full', !isNotificationRead(item) && 'bg-kd-primary')}
                  />
                  <span className='min-w-0 flex-1'>
                    <span className='block text-kd-body wrap-anywhere'>{getNotificationText(item)}</span>
                    <time dateTime={item.createdAt} className='mt-1 block text-kd-caption text-kd-foreground-muted'>
                      {pendingId === item.id ? '처리 중…' : formatDate(item.createdAt, true)}
                    </time>
                  </span>
                </button>
              </li>
            ))}
            {query.isFetchingNextPage && (
              <li className='px-6 py-4 text-center text-kd-sub text-kd-foreground-muted'>
                <span role='status'>알림을 더 불러오는 중…</span>
              </li>
            )}
            {query.isFetchNextPageError && (
              <li className='px-6 py-3 text-kd-sub'>
                <div role='alert'>
                  <p>알림을 더 불러오지 못했습니다.</p>
                  <Button variant='link' size='sm' onClick={() => void query.fetchNextPage()}>
                    다시 시도
                  </Button>
                </div>
              </li>
            )}
            {query.hasNextPage && !query.isFetchingNextPage && !query.isFetchNextPageError && (
              <li ref={sentinelRef} aria-hidden className='h-px' />
            )}
          </ul>
        )}
      </PopoverContent>
    </Popover>
  );
}
