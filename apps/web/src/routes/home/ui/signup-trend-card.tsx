import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/ui/atoms/card';
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/ui/atoms/chart';
import { ListState } from '@/ui/molecules/list-state';
import type { LoadState } from '../type/load-state';
import type { SignupTrendItem } from '../type/overview';
import { formatDate } from '@/util/date-format';
import { Skeleton } from './skeleton';

// 선 하나(전체 가입 수)라 범례는 두지 않는다(2026-10-22 결정). 색은 주황 선 + 연한 주황 채움
const chartConfig = {
  count: { label: '가입', color: 'var(--kd-primary)' },
} satisfies ChartConfig;

/** 그래프 높이. 불러오는 중·빈 상태도 같은 높이를 써서 카드 크기가 바뀌지 않게 한다. */
const CHART_HEIGHT_CLASS = 'h-[200px]';

/** `YYYY-MM-DD`를 가로축 글자 `MM-DD`로 줄인다. */
const formatAxisDate = (value: string) => value.slice(5);

/**
 * 신규 가입 추이 카드. 오늘 포함 30일 일별 가입 수 선 그래프, 가로축 글자는 첫날·가운데·마지막 3개.
 * `trend`는 조회 때 30일로 채운 값(api/overview.ts)이다.
 */
export function SignupTrendCard({ trend = [], state }: { trend: SignupTrendItem[] | undefined; state: LoadState }) {
  const hasSignup = trend.some((item) => item.count > 0);
  const axisTicks =
    trend.length > 0 ? [trend[0], trend[Math.floor(trend.length / 2)], trend.at(-1)!].map((item) => item.date) : [];

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>신규 가입 추이</CardTitle>
          <p className='mt-1 text-kd-caption text-kd-foreground-muted'>일별 가입 완료 기준</p>
        </div>
      </CardHeader>
      <CardContent variant='info'>
        {state === 'loading' ? (
          <div role='status'>
            <span className='sr-only'>불러오는 중입니다</span>
            <Skeleton className={CHART_HEIGHT_CLASS} />
          </div>
        ) : state === 'error' ? (
          // 조회 실패면 그래프 자리를 비워 둔다. 오류 문구는 최근 원장 인증 카드에만 둔다(S-홈-012)
          <div className={CHART_HEIGHT_CLASS} />
        ) : !hasSignup ? (
          <ListState kind='empty' className={`${CHART_HEIGHT_CLASS} justify-center py-0`} />
        ) : (
          <ChartContainer config={chartConfig} className={`${CHART_HEIGHT_CLASS} aspect-auto w-full`}>
            <AreaChart data={trend} margin={{ top: 8, right: 20, bottom: 0, left: 20 }}>
              <CartesianGrid vertical={false} />
              <XAxis
                dataKey='date'
                ticks={axisTicks}
                interval={0}
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                tickFormatter={formatAxisDate}
              />
              <YAxis hide allowDecimals={false} domain={[0, (dataMax: number) => Math.max(1, dataMax)]} />
              <ChartTooltip
                cursor={false}
                content={<ChartTooltipContent indicator='line' labelFormatter={(value) => formatDate(String(value))} />}
              />
              <Area
                dataKey='count'
                type='linear'
                stroke='var(--color-count)'
                strokeWidth={2}
                fill='var(--color-count)'
                fillOpacity={0.1}
                isAnimationActive={false}
              />
            </AreaChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
}
