import { Card, CardContent, CardHeader, CardTitle } from '@/ui/atoms/card';
import type { LoadState } from '../type/load-state';
import type { Overview } from '@/type/overview';
import { formatCount } from '@/util/count-format';
import { getVerificationSummary } from '@/util/verification-summary';
import { Skeleton } from './skeleton';

/** 원장 인증 구성 4칸의 이름과 숫자. 실패하면 숫자를 '—'로 둔다(S-홈-012). */
const getFlowSteps = (overview: Overview | undefined) => {
  const stats = overview?.stats;
  const counts = stats?.verificationCounts;
  /** 서버 값이 있을 때만 숫자를 보여 준다. */
  const show = (value: unknown) => (stats ? formatCount(value) : '—');
  return [
    { label: '전체 인증 기록', value: show(getVerificationSummary(counts, stats?.revokedOwners).total) },
    { label: '사업자번호 대기', value: show(counts?.BUSINESS_REGISTRATION_PENDING) },
    { label: '인증 제출 완료', value: show(counts?.SUBMITTED) },
    { label: '현재 활성 원장', value: show(stats?.activeOwners) },
  ];
};

/** 원장 인증 구성 카드. 821px 이상 4칸을 화살표로 잇고, 그 아래 2칸씩, 560px 이하 1칸씩(service-admin.html 기준). */
export function VerificationFlowCard({ overview, state }: { overview: Overview | undefined; state: LoadState }) {
  return (
    <Card className='min-[821px]:col-span-2'>
      <CardHeader>
        <div className='min-w-0'>
          <CardTitle>원장 인증 구성</CardTitle>
          <p className='mt-1 text-kd-caption text-kd-foreground-muted'>누적 인증 기록과 현재 활성 권한 기준</p>
        </div>
        <span className='shrink-0 text-kd-caption text-kd-foreground-muted'>읽기 전용 집계</span>
      </CardHeader>
      <CardContent variant='info'>
        <ol className='grid grid-cols-1 gap-3 min-[561px]:grid-cols-2 min-[821px]:grid-cols-4 min-[821px]:gap-8'>
          {getFlowSteps(state === 'success' ? overview : undefined).map((step) => (
            <li
              key={step.label}
              className="relative min-w-0 rounded-kd-3 border border-kd-border bg-kd-surface px-4 py-3 min-[821px]:not-last:after:absolute min-[821px]:not-last:after:top-1/2 min-[821px]:not-last:after:-right-6 min-[821px]:not-last:after:-translate-y-1/2 min-[821px]:not-last:after:text-kd-neutral-400 min-[821px]:not-last:after:content-['→']"
            >
              <span className='block text-kd-caption text-kd-foreground-muted'>{step.label}</span>
              {state === 'loading' ? (
                <Skeleton className='mt-1 h-6 w-16' />
              ) : (
                <strong className='mt-1 block text-kd-title-2 tabular-nums'>{step.value}</strong>
              )}
            </li>
          ))}
        </ol>
      </CardContent>
    </Card>
  );
}
