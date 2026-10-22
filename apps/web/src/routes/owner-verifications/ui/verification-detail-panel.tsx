import type { ReactNode } from 'react';
import { Card } from '@/ui/atoms/card';
import { VERIFICATION_STATUS_LABELS } from '@/type/overview';
import { cn } from '@/util/cn';
import { formatDate } from '@/util/date-format';
import type { OwnerVerification } from '../type/owner-verification';

/** 서버가 가린 값이 비었으면 '미등록'(service-admin.html 기준, S-인증-006). */
const orUnregistered = (value: string | null) => value || '미등록';

/**
 * 목록 오른쪽 상세 패널(S-인증-005~008). 조회 전용이라 처리 버튼은 두지 않는다(2.2).
 * 고른 건이 없으면 처음 안내를, 목록 조회가 실패했으면 실패 문구를 보여 준다(S-인증-014).
 * 좁은 화면(1180px 이하)에서는 표 아래로 내려가고 붙어 있지 않는다.
 */
export function VerificationDetailPanel({
  item,
  isLoadError = false,
  className,
}: {
  item: OwnerVerification | undefined;
  isLoadError?: boolean;
  className?: string;
}) {
  return (
    <Card
      role='region'
      aria-label='인증 상세'
      aria-live='polite'
      className={cn(
        'sticky top-[calc(var(--kd-bo-topbar-height)+1.5rem)] max-[1180px]:static max-[1180px]:top-auto',
        className
      )}
    >
      {item ? (
        <div className='p-5'>
          <h2 className='text-kd-title-2 break-words'>{item.userName || '—'}</h2>
          <p className='mt-1 text-kd-caption text-kd-foreground-muted break-words'>
            {item.kindergartenName || '—'} 원장 인증 현황 · 조회 전용
          </p>
          <DetailSection title='인증 상태'>
            <DetailRow label='현재 단계'>{VERIFICATION_STATUS_LABELS[item.status] ?? item.status ?? '—'}</DetailRow>
            <DetailRow label='제출일'>{formatDate(item.submittedAt)}</DetailRow>
            <DetailRow label='권한 부여일'>{formatDate(item.ownerGrantedAt)}</DetailRow>
          </DetailSection>
          <DetailSection title='유치원 정보'>
            <DetailRow label='유치원명'>{item.kindergartenName || '—'}</DetailRow>
            <DetailRow label='주소'>{item.kindergartenAddress || '—'}</DetailRow>
            <DetailRow label='사업자번호'>{orUnregistered(item.businessRegistrationNumber)}</DetailRow>
          </DetailSection>
          <DetailSection title='대표자 정보'>
            <DetailRow label='대표자'>{item.representativeName || '—'}</DetailRow>
            <DetailRow label='연락처'>{orUnregistered(item.representativePhone)}</DetailRow>
          </DetailSection>
          <div className='mt-4 flex items-center justify-between gap-3 rounded-kd-3 border border-kd-border bg-kd-surface px-3 py-2.5 text-kd-caption'>
            <span>읽기 전용 연결</span>
            <b className='text-kd-success-foreground'>DB 조회</b>
          </div>
        </div>
      ) : isLoadError ? (
        // 기존 화면처럼 아이콘 없이 회색 문구만 둔다(service-admin.html 기준).
        <p className='px-6 py-16 text-center text-kd-sub text-kd-foreground-muted'>
          인증 데이터를 불러오지 못했습니다.
        </p>
      ) : (
        <div className='px-6 py-16 text-center text-kd-foreground-muted'>
          <p aria-hidden className='text-3xl'>
            ☝
          </p>
          <p className='mt-2 text-kd-sub'>왼쪽에서 인증 건을 선택해주세요.</p>
        </div>
      )}
    </Card>
  );
}

/** 상세 패널의 묶음 하나(위쪽 구분선 + 작은 제목). */
function DetailSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className='mt-4 border-t border-kd-border pt-4 first-of-type:mt-5'>
      <h3 className='text-kd-caption font-semibold text-kd-foreground-muted'>{title}</h3>
      <dl className='mt-2'>{children}</dl>
    </section>
  );
}

/** 이름(왼쪽 회색)과 값(오른쪽 진한 글자) 한 줄. 긴 값은 줄을 바꿔 잘리지 않는다. */
function DetailRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className='flex justify-between gap-4 py-1.5 text-kd-sub'>
      <dt className='shrink-0 text-kd-foreground-muted'>{label}</dt>
      <dd className='min-w-0 text-right font-semibold break-words tabular-nums'>{children}</dd>
    </div>
  );
}
