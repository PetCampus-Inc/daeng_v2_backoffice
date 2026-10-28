/** 알림은 받은 사람별로 읽음 상태를 가진다. 실제 API 계약은 서버 연동 때 확정한다. */
export type Notification = {
  id: string;
  message: string;
  targetType: 'inquiry' | 'idea';
  targetId: number;
  createdAt: string;
  isRead: boolean;
};
