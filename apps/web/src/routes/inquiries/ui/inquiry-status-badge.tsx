import { Badge } from '@/ui/atoms/badge';
import { INQUIRY_STATUS_LABELS, type InquiryStatus } from '../type/inquiry';

/** 상태별 배지 색(R-문의배지): 답변 대기 노랑, 확인 중 파랑, 답변 도착 초록, 해결 완료 회색. */
const STATUS_BADGE_VARIANTS = {
  waiting: 'warning',
  checking: 'info',
  answered: 'success',
  resolved: 'default',
} as const satisfies Record<InquiryStatus, string>;

/** 문의 상태 배지. 목록과 상세가 함께 쓴다. */
export function InquiryStatusBadge({ status }: { status: InquiryStatus }) {
  return <Badge variant={STATUS_BADGE_VARIANTS[status]}>{INQUIRY_STATUS_LABELS[status]}</Badge>;
}
