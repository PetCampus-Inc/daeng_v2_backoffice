import { NotificationTargetType } from './notification-target-type';

/** 알림 목록 한 페이지 건수. 스크롤 끝에서 이만큼씩 이어 붙인다. */
export const NOTIFICATION_PAGE_SIZE = 20;

/** 알림 문구 뒤에 붙이는 대상 이름. 문구는 서버가 만들고 번호는 화면이 붙인다. */
export const NOTIFICATION_TARGET_LABELS: Record<NotificationTargetType, string> = {
  [NotificationTargetType.INQUIRY]: '문의',
  [NotificationTargetType.IDEA]: '제안',
};

/** 알림 대상 종류별 상세 화면 주소의 앞부분. */
export const NOTIFICATION_TARGET_PATHS: Record<NotificationTargetType, string> = {
  [NotificationTargetType.INQUIRY]: 'inquiries',
  [NotificationTargetType.IDEA]: 'ideas',
};
