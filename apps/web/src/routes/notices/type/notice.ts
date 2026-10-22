export const NOTICE_STATUSES = ['draft', 'published', 'unpublished'] as const;
export type NoticeStatus = (typeof NOTICE_STATUSES)[number];
export const NOTICE_STATUS_LABELS: Record<NoticeStatus, string> = {
  draft: '초안',
  published: '게시',
  unpublished: '게시 해제',
};

/** 서식 블록 정의 확정 전에는 문단만 다룬다(OQ-P4). HTML은 텍스트로 보존한다. */
export type NoticeBody = {
  schemaVersion: 1;
  blocks: { type: 'paragraph'; children: { text: string }[] }[];
};
export type Notice = {
  id: number;
  status: NoticeStatus;
  title: string;
  body: NoticeBody;
  createdAt: string;
  publishedAt: string | null;
  updatedAt: string;
  revision: number;
};
export type NoticeInput = Pick<Notice, 'title' | 'body'>;
export type NoticeAction = 'save' | 'publish' | 'unpublish' | 'republish' | 'undo';
export type NoticeListParams = { keyword: string; status: NoticeStatus | 'all' };
