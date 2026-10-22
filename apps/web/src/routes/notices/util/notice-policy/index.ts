import type { Notice, NoticeBody, NoticeInput } from '../../type/notice';

export function createNoticeBody(text: string): NoticeBody {
  return {
    schemaVersion: 1,
    blocks: text.split('\n').map((line) => ({ type: 'paragraph', children: [{ text: line }] })),
  };
}

export function getNoticeText(body: NoticeBody) {
  return body.blocks.map((block) => block.children.map((child) => child.text).join('')).join('\n');
}

export function validateNotice(input: NoticeInput) {
  const titleCount = [...input.title].length;
  const bodyCount = [...getNoticeText(input.body)].length;
  return {
    titleCount,
    bodyCount,
    canSave: titleCount <= 50 && bodyCount <= 5000,
    canPublish:
      titleCount <= 50 &&
      bodyCount <= 5000 &&
      input.title.trim().length > 0 &&
      getNoticeText(input.body).trim().length > 0,
  };
}

/** 초안은 생성일 순으로 먼저, 나머지는 최초 게시일 순으로 정렬한다. */
export function compareNotices(left: Notice, right: Notice) {
  if ((left.status === 'draft') !== (right.status === 'draft')) return left.status === 'draft' ? -1 : 1;
  const date = (notice: Notice) => Date.parse(notice.status === 'draft' ? notice.createdAt : notice.publishedAt!);
  return date(right) - date(left) || right.id - left.id;
}
