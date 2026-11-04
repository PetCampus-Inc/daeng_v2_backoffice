import { getDisplayUserName } from '@/util/display-user-name';
import { INQUIRY_USER_TYPE_LABELS, type InquiryUser } from '../type/inquiry-ui';

/** 사용자 칸 `유형 · 이름`. 서버가 이름을 비워 주면 이름 자리는 '—'로 보인다. */
export function formatInquiryUser(user: InquiryUser) {
  return `${INQUIRY_USER_TYPE_LABELS[user.type]} · ${getDisplayUserName(user.name)}`;
}
