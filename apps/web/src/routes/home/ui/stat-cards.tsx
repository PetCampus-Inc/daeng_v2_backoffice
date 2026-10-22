import type { ReactNode } from 'react';
import { Card } from '@/ui/atoms/card';
import type { LoadState } from '../type/load-state';
import type { Overview } from '../type/overview';
import { formatCount } from '../util/format';
import { getVerificationSummary } from '../util/verification-summary';
import { Skeleton } from './skeleton';

type StatCard = { label: string; value: string; foot: ReactNode };

/** 응답으로 지표 카드 6개의 숫자와 아래 글자를 만든다. 실패하면 서버 값 자리를 '—'로 둔다. */
const getStatCards = (overview: Overview | undefined): StatCard[] => {
  const stats = overview?.stats;
  const summary = getVerificationSummary(stats?.verificationCounts, stats?.revokedOwners);
  /** 서버 값이 있을 때만 숫자를 보여 준다. */
  const show = (text: string) => (stats ? text : '—');
  return [
    {
      label: '전체 회원',
      value: show(formatCount(stats?.totalUsers)),
      foot: (
        <>
          <span className='font-bold text-kd-success-foreground'>{show(`+${formatCount(stats?.newUsers30d)}명`)}</span>{' '}
          최근 30일
        </>
      ),
    },
    { label: '견주 회원', value: show(formatCount(stats?.guardians)), foot: '반려견 보유 활성 회원' },
    {
      label: '활성 원장',
      value: show(formatCount(stats?.activeOwners)),
      foot: (
        <>
          <span className='font-bold text-kd-success-foreground'>{show(`+${formatCount(stats?.newOwners7d)}명`)}</span>{' '}
          최근 7일
        </>
      ),
    },
    {
      label: '원장 연결 유치원',
      value: show(formatCount(stats?.managedSchools)),
      foot: show(`전체 ${formatCount(stats?.totalSchools)}곳 · 운영 중 ${formatCount(stats?.activeSchools)}곳`),
    },
    { label: '인증 진행 중', value: show(formatCount(summary.inProgress)), foot: '사업자 인증 완료 전' },
    {
      label: '해지된 원장',
      value: show(formatCount(summary.revoked)),
      foot: <span className='font-bold text-kd-error-foreground'>이력 확인</span>,
    },
  ];
};

/** 홈 지표 카드 6개. 1181px 이상 한 줄 6개, 그 아래 3개, 560px 이하 2개(service-admin.html 기준). */
export function StatCards({ overview, state }: { overview: Overview | undefined; state: LoadState }) {
  return (
    <section aria-label='주요 지표' className='grid grid-cols-2 gap-4 min-[561px]:grid-cols-3 min-[1181px]:grid-cols-6'>
      {getStatCards(state === 'success' ? overview : undefined).map((card) => (
        <Card key={card.label} className='min-w-0 px-5 py-4'>
          <h2 className='text-kd-caption font-semibold text-kd-foreground-muted'>{card.label}</h2>
          {state === 'loading' ? (
            <>
              <Skeleton className='mt-3 h-8 w-20' />
              <Skeleton className='mt-2 h-4 w-28 max-w-full' />
            </>
          ) : (
            <>
              <p className='mt-3 text-kd-title-1 tabular-nums'>{card.value}</p>
              <p className='mt-1 text-kd-caption text-kd-foreground-muted tabular-nums'>{card.foot}</p>
            </>
          )}
        </Card>
      ))}
    </section>
  );
}
