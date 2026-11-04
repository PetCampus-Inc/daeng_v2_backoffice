import { formatDocumentTitle } from '@/util/page-config';
import { fillSignupTrend } from '@/util/signup-trend';
import { useGetServiceOverview } from './api/use-home';
import type { ServiceOverview } from './type';
import type { LoadState } from './type/load-state';
import { ReadOnlyDbBadge } from '@/ui/molecules/read-only-db-badge';
import { RecentVerificationsCard } from './ui/recent-verifications-card';
import { SignupTrendCard } from './ui/signup-trend-card';
import { StatCards } from './ui/stat-cards';
import { VerificationFlowCard } from './ui/verification-flow-card';

const PAGE_TITLE = '서비스 대시보드';

/**
 * 받은 응답의 가입 추이를 받은 시각(KST) 기준 30일로 채운다(S-홈-006).
 * 모듈 함수로 두어 응답이 바뀔 때만 다시 계산된다.
 */
const selectHomeOverview = (overview: ServiceOverview): ServiceOverview => ({
  ...overview,
  signupTrend: fillSignupTrend(overview?.signupTrend, new Date()),
});

/**
 * 홈(서비스 대시보드). 기존 service-admin.html 대시보드를 옮겼다(10-홈.md).
 * 홈은 이 요청 하나만 보내고, 실패하면 홈 전체가 실패로 보인다(S-홈-012·013).
 * 사이드바 '원장 인증 현황' 배지도 같은 요청(같은 조회 키)을 함께 쓴다(S-인증-012).
 */
export default function HomeRoute() {
  const overviewQuery = useGetServiceOverview(undefined, { query: { select: selectHomeOverview } });
  const overview = overviewQuery.data;
  const state: LoadState = overviewQuery.isPending ? 'loading' : overviewQuery.isError ? 'error' : 'success';

  return (
    <>
      <title>{formatDocumentTitle(PAGE_TITLE)}</title>
      <div className='flex flex-wrap items-center gap-x-3 gap-y-2'>
        <h1 className='text-kd-title-1'>{PAGE_TITLE}</h1>
        <ReadOnlyDbBadge />
      </div>
      <p className='mt-1 text-kd-body text-kd-foreground-muted'>회원 가입과 유치원 운영 현황을 한눈에 확인하세요.</p>
      <div className='mt-6 flex flex-col gap-4'>
        <StatCards overview={overview} state={state} />
        <div className='grid gap-4 min-[821px]:grid-cols-[minmax(0,1.55fr)_minmax(300px,0.85fr)]'>
          <SignupTrendCard trend={overview?.signupTrend} state={state} />
          <RecentVerificationsCard
            items={overview?.recentVerifications}
            state={state}
            onRetry={() => void overviewQuery.refetch()}
          />
          <VerificationFlowCard overview={overview} state={state} />
        </div>
      </div>
    </>
  );
}
