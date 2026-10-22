import type { ReactNode } from 'react';
import { Card, CardContent } from '@/ui/atoms/card';
import { formatDate } from '@/util/date-format';
import { INQUIRY_USER_TYPE_LABELS, type InquiryDetail } from '../../../type/inquiry';

/** 정보 칸 하나. 이름은 보조 회색, 값은 본문. */
function InfoRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className='flex flex-col gap-1'>
      <dt className='text-kd-sub text-kd-foreground-muted'>{label}</dt>
      <dd className='text-kd-body [overflow-wrap:anywhere]'>{children}</dd>
    </div>
  );
}

/** 상세 오른쪽 정보 카드(PRD 7.4). 이메일은 모든 역할에 가리지 않고 보여 준다. */
export function InquiryInfo({ inquiry }: { inquiry: InquiryDetail }) {
  return (
    <Card>
      <CardContent variant='info'>
        <dl className='flex flex-col gap-4'>
          <InfoRow label='문의 번호'>
            <span className='tabular-nums'>#{inquiry.id}</span>
          </InfoRow>
          <InfoRow label='사용자'>
            <span className='font-semibold'>{inquiry.user.name}</span>
            <span className='block text-kd-caption text-kd-foreground-muted'>{inquiry.user.email}</span>
          </InfoRow>
          <InfoRow label='사용자 유형'>{INQUIRY_USER_TYPE_LABELS[inquiry.user.type]}</InfoRow>
          <InfoRow label='접수'>
            <span className='tabular-nums'>{formatDate(inquiry.createdAt, true)}</span>
          </InfoRow>
          <InfoRow label='최근 활동'>
            <span className='tabular-nums'>{formatDate(inquiry.lastActivityAt, true)}</span>
          </InfoRow>
        </dl>
      </CardContent>
    </Card>
  );
}
