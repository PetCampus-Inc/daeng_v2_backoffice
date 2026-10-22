import { http } from 'msw';
import type { Notice, NoticeAction, NoticeInput } from '@/routes/notices/type/notice';
import { compareNotices, createNoticeBody, validateNotice } from '@/routes/notices/util/notice-policy';
import { errorResponse, mockUrl, okResponse, pageResponse } from '../util/response';
import { getMockTeamMembers } from './team-members';

const STORAGE_KEY = 'daeng-bo-mock-notices';
const DEFAULT_NOTICES: Notice[] = [
  {
    id: 14,
    status: 'draft',
    title: '11월 이벤트 안내',
    body: createNoticeBody('이벤트 준비 중'),
    createdAt: '2026-10-06T15:00:00+09:00',
    publishedAt: null,
    updatedAt: '2026-10-06T15:00:00+09:00',
    revision: 1,
  },
  {
    id: 13,
    status: 'draft',
    title: '',
    body: createNoticeBody(''),
    createdAt: '2026-10-06T15:00:00+09:00',
    publishedAt: null,
    updatedAt: '2026-10-06T15:00:00+09:00',
    revision: 1,
  },
  {
    id: 12,
    status: 'published',
    title: '10월 서비스 점검 안내',
    body: createNoticeBody(
      '더 나은 서비스를 위해 시스템 점검을 진행합니다.\n점검 중에는 서비스 이용이 일시적으로 제한될 수 있습니다. 이용에 참고해 주세요.'
    ),
    createdAt: '2026-09-30T09:00:00+09:00',
    publishedAt: '2026-10-01T10:00:00+09:00',
    updatedAt: '2026-10-03T15:00:00+09:00',
    revision: 1,
  },
  {
    id: 11,
    status: 'unpublished',
    title: '추석 연휴 고객센터 안내',
    body: createNoticeBody(
      '추석 연휴 동안 고객센터가 쉬어갑니다.\n남겨 주신 문의는 연휴가 끝난 뒤 순서대로 답변드리겠습니다.'
    ),
    createdAt: '2026-09-30T08:00:00+09:00',
    publishedAt: '2026-10-01T10:00:00+09:00',
    updatedAt: '2026-10-02T09:00:00+09:00',
    revision: 1,
  },
  {
    id: 10,
    status: 'published',
    title: '[TEST] 공지사항 테스트',
    body: createNoticeBody('공지사항 테스트입니다.'),
    createdAt: '2026-09-01T09:00:00+09:00',
    publishedAt: '2026-09-01T10:00:00+09:00',
    updatedAt: '2026-09-01T10:00:00+09:00',
    revision: 1,
  },
];

function getMockNotices(): Notice[] {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null');
    if (Array.isArray(stored)) return stored;
  } catch {
    /* 잘못된 개발 데이터는 기본값으로 복구한다. */
  }
  return DEFAULT_NOTICES;
}

function deny(status: number, code: string, message: string) {
  return errorResponse(status, { code, message, errorMessage: message });
}

function authorize(request: Request, write = false) {
  const member = getMockTeamMembers().find((item) => item.email === request.headers.get('X-Dev-Email'));
  if (!member || member.status !== 'active') return deny(401, 'UNAUTHORIZED', '로그인이 필요합니다.');
  if (write && member.role === 'viewer') return deny(403, 'FORBIDDEN', '접근 권한이 없습니다.');
  return null;
}

function isNoticeInput(value: unknown): value is NoticeInput {
  if (!value || typeof value !== 'object') return false;
  const input = value as NoticeInput;
  return (
    typeof input.title === 'string' &&
    input.body?.schemaVersion === 1 &&
    Array.isArray(input.body.blocks) &&
    input.body.blocks.every(
      (block) =>
        block.type === 'paragraph' &&
        Array.isArray(block.children) &&
        block.children.every((child) => typeof child.text === 'string')
    )
  );
}

/** 화면 검증용 API. 실제 관리자 공지 API·서식 블록 계약은 서버 확정 후 교체한다. */
export const NOTICE_HANDLERS = [
  http.get(mockUrl('/notices'), ({ request }) => {
    const denied = authorize(request);
    if (denied) return denied;
    const params = new URL(request.url).searchParams;
    const keyword = (params.get('keyword') ?? '').toLowerCase();
    const status = params.get('status');
    const items = getMockNotices()
      .filter((item) => (!status || item.status === status) && item.title.toLowerCase().includes(keyword))
      .sort(compareNotices);
    const rawPage = Number(params.get('page') ?? 0);
    const page = Number.isSafeInteger(rawPage) && rawPage >= 0 ? rawPage : 0;
    return pageResponse(items, page, 20);
  }),
  http.get(mockUrl('/notices/:id'), ({ request, params }) => {
    const denied = authorize(request);
    if (denied) return denied;
    const item = getMockNotices().find((notice) => notice.id === Number(params.id));
    return item ? okResponse(item) : deny(404, 'NOTICE_NOT_FOUND', '페이지를 찾을 수 없습니다.');
  }),
  http.post(mockUrl('/notices'), async ({ request }) => {
    const denied = authorize(request, true);
    if (denied) return denied;
    const input = (await request.json()) as NoticeInput & { action: NoticeAction };
    if (
      !isNoticeInput(input) ||
      !['save', 'publish'].includes(input.action) ||
      !validateNotice(input).canSave ||
      (input.action === 'publish' && !validateNotice(input).canPublish)
    ) {
      return deny(400, 'INVALID_NOTICE', '제목과 본문을 확인해 주세요.');
    }
    const items = getMockNotices();
    const now = new Date().toISOString();
    const nextId =
      Math.max(Number(localStorage.getItem(`${STORAGE_KEY}-sequence`) ?? 14), 14, ...items.map((item) => item.id)) + 1;
    const item: Notice = {
      id: nextId,
      title: input.title,
      body: input.body,
      status: input.action === 'publish' ? 'published' : 'draft',
      createdAt: now,
      updatedAt: now,
      publishedAt: input.action === 'publish' ? now : null,
      revision: 1,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...items, item]));
    localStorage.setItem(`${STORAGE_KEY}-sequence`, String(nextId));
    return okResponse(item, 201);
  }),
  http.patch(mockUrl('/notices/:id'), async ({ request, params }) => {
    const denied = authorize(request, true);
    if (denied) return denied;
    const input = (await request.json()) as Partial<NoticeInput> & { action: NoticeAction; revision: number };
    const items = getMockNotices();
    const item = items.find((notice) => notice.id === Number(params.id));
    if (!item) return deny(404, 'NOTICE_NOT_FOUND', '다른 팀원이 삭제한 초안입니다.');
    if (item.revision !== input.revision) {
      return deny(409, 'NOTICE_CONFLICT', '다른 팀원이 먼저 저장한 내용이 있습니다.');
    }
    const action = input.action;
    const canTransition =
      action === 'save' ||
      (action === 'publish' && item.status === 'draft') ||
      (action === 'unpublish' && item.status === 'published') ||
      (['republish', 'undo'].includes(action) && item.status === 'unpublished');
    if (!canTransition) return deny(409, 'NOTICE_CONFLICT', '공지 상태가 변경되었습니다.');
    if (action === 'save' || action === 'publish') {
      if (
        !isNoticeInput(input) ||
        !validateNotice(input).canSave ||
        ((action === 'publish' || item.status !== 'draft') && !validateNotice(input).canPublish)
      ) {
        return deny(400, 'INVALID_NOTICE', '제목과 본문을 확인해 주세요.');
      }
    }
    const now = new Date().toISOString();
    const updated: Notice = {
      ...item,
      ...(action === 'save' || action === 'publish' ? { title: input.title!, body: input.body! } : {}),
      status:
        action === 'unpublish'
          ? 'unpublished'
          : ['publish', 'republish', 'undo'].includes(action)
            ? 'published'
            : item.status,
      publishedAt: item.publishedAt ?? (action === 'publish' ? now : null),
      updatedAt: now,
      revision: item.revision + 1,
    };
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(items.map((notice) => (notice.id === updated.id ? updated : notice)))
    );
    return okResponse(updated);
  }),
  http.delete(mockUrl('/notices/:id'), async ({ request, params }) => {
    const denied = authorize(request, true);
    if (denied) return denied;
    const input = (await request.json()) as { revision: number };
    const items = getMockNotices();
    const item = items.find((notice) => notice.id === Number(params.id));
    if (!item) return deny(404, 'NOTICE_NOT_FOUND', '페이지를 찾을 수 없습니다.');
    if (item.revision !== input.revision || item.status !== 'draft') {
      return deny(409, 'NOTICE_CONFLICT', '공지 상태가 변경되었습니다.');
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items.filter((notice) => notice.id !== item.id)));
    return okResponse(null);
  }),
];
