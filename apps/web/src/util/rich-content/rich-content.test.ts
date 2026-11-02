import { describe, expect, it } from 'vitest';
import { fillTermDates, getInitialTermBody } from '@/routes/terms/util/term-policy';
import {
  createRichContent,
  fromEditorValue,
  getRichText,
  isHttpUrl,
  isRichContent,
  normalizeRichContent,
  replaceRichText,
  sameRichContent,
  toEditorValue,
} from './index';
import type { RichContent } from '@/type/rich-content';

const BODY: RichContent = {
  schemaVersion: 1,
  blocks: [
    { type: 'h2', children: [{ text: '개정 약관', bold: true }] },
    {
      type: 'paragraph',
      children: [
        { text: '{{공고', bold: true },
        { text: '일}} · {{시행일}}' },
        { type: 'a', url: 'https://example.com/{{시행일}}', children: [{ text: '약관' }] },
      ],
    },
    { type: 'ul', children: [{ type: 'li', children: [{ type: 'lic', children: [{ text: '목록' }] }] }] },
    {
      type: 'table',
      children: [
        {
          type: 'tr',
          children: [
            { type: 'td', children: [{ type: 'paragraph', children: [{ text: '{{시행일}}', italic: true }] }] },
          ],
        },
      ],
    },
  ],
};

describe('블록 본문 변환과 검증', () => {
  it('문단·목록·표의 글자를 모두 세고 인라인 서식은 이어 읽는다', () => {
    expect(getRichText(BODY)).toBe('개정 약관\n{{공고일}} · {{시행일}}약관\n목록\n{{시행일}}');
    expect(getRichText(createRichContent('<script>글자</script>\n🐶'))).toBe('<script>글자</script>\n🐶');
  });
  it('Plate 왕복에서 서식·중첩·URL을 보존하고 내부 id는 변경으로 판단하지 않는다', () => {
    const value = toEditorValue(BODY);
    expect(fromEditorValue(value)).toEqual(BODY);
    expect(sameRichContent(BODY, { ...BODY, blocks: BODY.blocks.map((node) => ({ ...node, id: 'editor-id' })) })).toBe(
      true
    );
    expect(
      sameRichContent(createRichContent('같은 글자'), {
        schemaVersion: 1,
        blocks: [{ type: 'paragraph', children: [{ text: '같은 글자', bold: true }] }],
      })
    ).toBe(false);
  });
  it.each([
    null,
    {},
    { schemaVersion: 1, blocks: [] },
    { schemaVersion: 1, blocks: [{ text: '잘못된 루트', children: [{ text: '내용' }] }] },
    { schemaVersion: 1, blocks: [{ type: 'paragraph', children: [{ text: 1 }] }] },
  ])('잘못된 본문을 거부한다: %j', (value) => expect(isRichContent(value)).toBe(false));
  it('이전 문자열 본문을 문단으로 이행하고 같은 본문을 다시 붙여넣으면 변경으로 보지 않는다', () => {
    const body = normalizeRichContent('처음\n둘째\n\n끝');
    expect(getRichText(body)).toBe('처음\n둘째\n\n끝');
    expect(
      sameRichContent(body, {
        schemaVersion: 1,
        blocks: [{ type: 'paragraph', children: [{ text: '처음\n둘째\n\n끝' }] }],
      })
    ).toBe(true);
    expect(
      sameRichContent(body, { schemaVersion: 1, blocks: [{ type: 'h2', children: [{ text: getRichText(body) }] }] })
    ).toBe(false);
  });
  it('지원 문서와 중첩 서식을 허용한다', () => expect(isRichContent(BODY)).toBe(true));
  it.each(['javascript:alert(1)', 'data:text/html,hi', '//example.com', '/terms', 'invalid'])(
    '안전하지 않은 링크를 거부한다: %s',
    (url) => expect(isHttpUrl(url)).toBe(false)
  );
  it.each(['https://example.com/a?q=1', 'http://example.com'])('http 링크를 허용한다: %s', (url) =>
    expect(isHttpUrl(url)).toBe(true)
  );
});
describe('서식을 보존하는 약관 날짜', () => {
  it('분리된 자리표시자·목록·표 안에서도 치환하고 URL과 원본은 유지한다', () => {
    const filled = fillTermDates(BODY, '2026-11-10', new Date('2026-10-07T10:00:00+09:00'));
    expect(getRichText(filled)).not.toContain('{{');
    expect(getRichText(filled)).toContain('2026년 10월 7일 · 2026년 11월 10일');
    expect(filled.blocks[1].children[0]).toEqual({ text: '2026년 10월 7일', bold: true });
    expect(JSON.stringify(filled)).toContain('https://example.com/{{시행일}}');
    expect(getRichText(BODY)).toContain('{{공고일}}');
    const cloned = getInitialTermBody([
      {
        kind: 'service',
        version: 1,
        status: 'published',
        body: filled,
        publishedAt: '2026-10-07T10:00:00+09:00',
        effectiveDate: '2026-11-10',
        updatedAt: '',
        revision: 1,
      },
    ]);
    expect(getRichText(cloned)).toBe(getRichText(BODY));
    expect(cloned.blocks[0]).toEqual(BODY.blocks[0]);
  });
  it('같은 문단의 반복·기호 포함 문자열을 모두 치환한다', () => {
    expect(getRichText(replaceRichText(createRichContent('a.b a.b'), [['a.b', 'new']]))).toBe('new new');
  });
});
