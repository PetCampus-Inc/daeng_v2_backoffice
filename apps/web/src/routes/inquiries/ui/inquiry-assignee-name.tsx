import type { InquiryAssignee } from '../type/inquiry';
import { formatAssigneeName } from '../util/inquiry-format';

/** 담당자 `표시명 · 직무`. 비활성이면 뒤에 회색 `(비활성)`, 없으면 회색 `미배정`(PRD 7.3). */
export function InquiryAssigneeName({ assignee }: { assignee: InquiryAssignee | null }) {
  if (!assignee) return <span className='text-kd-foreground-muted'>미배정</span>;
  return (
    <span>
      {formatAssigneeName(assignee)}
      {!assignee.isActive && <span className='text-kd-foreground-muted'> (비활성)</span>}
    </span>
  );
}
