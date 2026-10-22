import type { InquiryUser } from '../type/inquiry';
import { INQUIRY_USER_TYPE_LABELS } from '../type/inquiry';

/** 사용자 칸 `유형 · 이름`. */
export function formatInquiryUser(user: InquiryUser) {
  return `${INQUIRY_USER_TYPE_LABELS[user.type]} · ${user.name}`;
}
