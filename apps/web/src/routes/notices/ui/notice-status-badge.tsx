import { Badge } from '@/ui/atoms/badge';
import { NOTICE_STATUS_LABELS, type NoticeStatus } from '../type/notice';

export function NoticeStatusBadge({ status }: { status: NoticeStatus }) {
  return <Badge variant={status === 'published' ? 'success' : 'default'}>{NOTICE_STATUS_LABELS[status]}</Badge>;
}
