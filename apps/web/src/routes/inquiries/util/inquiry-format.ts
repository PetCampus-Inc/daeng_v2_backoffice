import type { InquiryAssignee, InquiryUser } from '../type/inquiry';
import { INQUIRY_USER_TYPE_LABELS } from '../type/inquiry';

/** 담당자 `표시명 · 직무`. 비활성 표시는 화면이 따로 붙인다. */
export function formatAssigneeName(assignee: Pick<InquiryAssignee, 'displayName' | 'jobRole'>) {
  return `${assignee.displayName} · ${assignee.jobRole}`;
}

/** 사용자 칸 `유형 · 이름`. */
export function formatInquiryUser(user: InquiryUser) {
  return `${INQUIRY_USER_TYPE_LABELS[user.type]} · ${user.name}`;
}
