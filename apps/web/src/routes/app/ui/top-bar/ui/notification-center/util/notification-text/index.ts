import type { Notification } from '../../type';
import { NOTIFICATION_TARGET_LABELS, NOTIFICATION_TARGET_PATHS } from '../../type/notification-ui';

/** 화면에 보이는 알림 문구. 서버 문구 뒤에 대상 번호를 붙인다(예: `… 문의 #1042`). */
export const getNotificationText = ({
  message,
  targetType,
  targetId,
}: Pick<Notification, 'message' | 'targetType' | 'targetId'>) =>
  `${message} ${NOTIFICATION_TARGET_LABELS[targetType]} #${targetId}`;

/** 알림이 가리키는 문의·제안의 상세 화면 주소. */
export const getNotificationPath = ({ targetType, targetId }: Pick<Notification, 'targetType' | 'targetId'>) =>
  `/${NOTIFICATION_TARGET_PATHS[targetType]}/${targetId}`;

/** 읽은 알림인지. 서버는 읽은 시각(`readAt`)을 주고 안 읽었으면 `null`이다. */
export const isNotificationRead = (item: Pick<Notification, 'readAt'>) => item.readAt !== null;
