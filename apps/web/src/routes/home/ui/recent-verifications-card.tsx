import { Link } from 'react-router';
import { Badge } from '@/ui/atoms/badge';
import { Button } from '@/ui/atoms/button';
import { Card, CardHeader, CardTitle } from '@/ui/atoms/card';
import { ListState } from '@/ui/molecules/list-state';
import { PAGES } from '@/util/page-config';
import type { LoadState } from '../type/load-state';
import { VERIFICATION_STATUS_LABELS, type RecentVerification } from '../type/overview';
import { formatDate } from '@/util/date-format';

/** 홈에 보여 주는 최근 원장 인증 최대 줄 수. */
const MAX_ROWS = 6;

/** 최근 원장 인증 카드. 줄을 눌러도 아무 일이 없고, [전체 보기]로 원장 인증 현황에 간다(S-홈-007·008). */
export function RecentVerificationsCard({
  items,
  state,
  onRetry,
}: {
  items: RecentVerification[] | undefined;
  state: LoadState;
  onRetry: () => void;
}) {
  const rows = (Array.isArray(items) ? items : []).filter(Boolean).slice(0, MAX_ROWS);

  return (
    <Card>
      <CardHeader>
        <div className='min-w-0'>
          <CardTitle>최근 원장 인증</CardTitle>
          <p className='mt-1 text-kd-caption text-kd-foreground-muted'>최근 제출·진행·해지 이력입니다.</p>
        </div>
        <Button asChild variant='outline' size='sm'>
          <Link to={PAGES.ownerVerifications.path}>전체 보기</Link>
        </Button>
      </CardHeader>
      {state === 'loading' ? (
        <ListState kind='loading' />
      ) : state === 'error' ? (
        <ListState kind='error' onAction={onRetry} />
      ) : rows.length === 0 ? (
        <ListState kind='empty' />
      ) : (
        <ul className='px-6 py-2'>
          {rows.map((item, index) => {
            const name = item.nickname || item.userId || '—';
            return (
              <li
                key={item.id ?? index}
                className='flex items-center gap-3 border-t border-kd-border py-3 first:border-t-0'
              >
                <span
                  aria-hidden
                  className='grid size-8 shrink-0 place-items-center rounded-kd-full bg-kd-surface-accent text-kd-caption font-bold text-kd-warning-foreground'
                >
                  {name.slice(0, 1)}
                </span>
                <div className='min-w-0 flex-1'>
                  <p className='truncate text-kd-sub font-semibold'>
                    {name} · {item.kindergartenName || '—'}
                  </p>
                  <p className='truncate text-kd-caption text-kd-foreground-muted'>
                    {VERIFICATION_STATUS_LABELS[item.status] ?? item.status ?? '—'}
                  </p>
                </div>
                <Badge variant='warning' className='tabular-nums'>
                  {formatDate(item.submittedAt)}
                </Badge>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
