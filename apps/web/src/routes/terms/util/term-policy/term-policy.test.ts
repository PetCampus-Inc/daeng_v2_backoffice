import type { RichContent } from '@/type/rich-content';
import { createRichContent, getRichText } from '@/util/rich-content';
import { describe, expect, it } from 'vitest';
import { createDefaultTerms } from '@/api/mocks/handlers/terms';
import { toTermResponse } from '@/api/mocks/util/term-list';
import { toTerm } from '../../api/term-query';
import type { Term } from '../../type/term-ui';
import {
  displayTermDate,
  fillTermDates,
  findSplitTermPlaceholders,
  getSplitPlaceholderMessage,
  getInitialTermBody,
  getTermStatus,
  parseTermDate,
  countTermBody,
  readTermDateInput,
  TERM_BODY_MAX_LENGTH,
  validateEffectiveDate,
} from './index';
const NOW = new Date('2026-10-07T10:00:00+09:00');
/** fixtures.md `약관-기본`을 화면이 받는 값으로 바꾼다. 서비스 이용약관은 #1~#4, 개인정보 처리방침은 #5~#6이다. */
const MOCK_TERMS = createDefaultTerms();
const DEFAULT_TERMS: Term[] = MOCK_TERMS.map((item) => toTerm(toTermResponse(item, MOCK_TERMS, NOW)));
const SERVICE = DEFAULT_TERMS.filter((item) => item.kind === 'service');
const PRIVACY = DEFAULT_TERMS.filter((item) => item.kind === 'privacy');

describe('R-약관시행일: 형식 → 과거 → 7일 → 최근 공개 시행일', () => {
  it.each([
    ['01', 'privacy', '2026. 10. 14.', null],
    [
      '02',
      'privacy',
      '2026. 10. 13.',
      '시행일은 공개일로부터 7일 이후 날짜만 지정할 수 있습니다. 2026. 10. 14. 이후로 골라 주세요.',
    ],
    [
      '03',
      'privacy',
      '2026. 10. 07.',
      '시행일은 공개일로부터 7일 이후 날짜만 지정할 수 있습니다. 2026. 10. 14. 이후로 골라 주세요.',
    ],
    ['04', 'privacy', '2026. 10. 06.', '과거 날짜는 시행일로 지정할 수 없습니다.'],
    ['05', 'privacy', '2026. 13. 01.', '날짜 형식을 확인해 주세요. 예: 2026. 10. 20.'],
    ['06', 'privacy', 'abc', '날짜 형식을 확인해 주세요. 예: 2026. 10. 20.'],
    ['07', 'privacy', '2026. 02. 30.', '날짜 형식을 확인해 주세요. 예: 2026. 10. 20.'],
    ['09', 'service', '2026. 10. 20.', '시행일은 같은 약관의 가장 최근 시행일보다 이후여야 합니다.'],
    ['10', 'service', '2026. 10. 15.', '시행일은 같은 약관의 가장 최근 시행일보다 이후여야 합니다.'],
    ['11', 'service', '2026. 10. 21.', null],
    ['12', 'service', '2026. 10. 01.', '과거 날짜는 시행일로 지정할 수 없습니다.'],
    [
      '13',
      'service',
      '2026. 10. 10.',
      '시행일은 공개일로부터 7일 이후 날짜만 지정할 수 있습니다. 2026. 10. 14. 이후로 골라 주세요.',
    ],
    ['14', 'location', '2026. 10. 14.', null],
  ])('R-약관시행일-%s', (_id, kind, value, expected) => {
    expect(
      validateEffectiveDate(
        value!,
        DEFAULT_TERMS.filter((item) => item.kind === kind),
        NOW
      )
    ).toBe(expected);
  });
  it.each([
    ['2026-10-07T23:30:00+09:00', '2026. 10. 14.', null],
    [
      '2026-10-08T00:10:00+09:00',
      '2026. 10. 14.',
      '시행일은 공개일로부터 7일 이후 날짜만 지정할 수 있습니다. 2026. 10. 15. 이후로 골라 주세요.',
    ],
    ['2026-10-08T00:10:00+09:00', '2026. 10. 07.', '과거 날짜는 시행일로 지정할 수 없습니다.'],
  ])('KST 날짜 경계 %s', (now, value, expected) =>
    expect(validateEffectiveDate(value!, PRIVACY, new Date(now!))).toBe(expected)
  );
  it('실제 달력 날짜와 윤년을 확인한다', () => {
    expect(parseTermDate('2028. 02. 29.')).toBe('2028-02-29');
    expect(parseTermDate('2026. 02. 29.')).toBeNull();
    expect(parseTermDate('2026-11-10')).toBe('2026-11-10');
    expect(displayTermDate('abc')).toBe('abc');
  });
});
describe('R-약관판정·정렬·처음본문·자리표시자·날짜채움', () => {
  it.each([
    ['2026-10-07T10:00:00+09:00', ['과거', '현행', '예정', '초안']],
    ['2026-10-19T23:59:00+09:00', ['과거', '현행', '예정', '초안']],
    ['2026-10-20T00:00:00+09:00', ['과거', '과거', '현행', '초안']],
  ])('KST %s 공개 상태', (now, expected) =>
    expect(SERVICE.map((item) => getTermStatus(item, SERVICE, new Date(now)))).toEqual(expected)
  );
  it('철회 배제를 적용한다', () => {
    expect(PRIVACY.map((item) => getTermStatus(item, PRIVACY, NOW))).toEqual(['현행', '철회']);
    expect(getRichText(getInitialTermBody(PRIVACY))).toContain('개인정보 처리방침 1판');
    expect(
      getRichText(
        getInitialTermBody(
          SERVICE.map((item) => (item.version === 3 ? { ...item, status: 'withdrawn' as const } : item))
        )
      )
    ).toContain('서비스 이용약관 2판');
    expect(getRichText(getInitialTermBody([]))).toContain('공고일자: {{공고일}}');
  });
  it('복제 시 네 곳의 공개·시행일을 되돌리고 공개 시 모두 채운다', () => {
    const body = getInitialTermBody(SERVICE);
    const text = getRichText(body);
    expect(text).toContain('공고일자: {{공고일}}');
    expect(text).toContain('시행일자: {{시행일}}');
    expect(text).toContain('이 약관은 {{시행일}}부터 시행합니다.');
    expect(text).toContain('{{공고일}} 공고');
    const filled = getRichText(fillTermDates(body, '2026-11-10', NOW));
    expect(filled).not.toContain('{{');
    expect(filled).toContain('공고일자: 2026년 10월 7일');
    expect(filled).toContain('시행일자: 2026년 11월 10일');
    expect(
      getRichText(fillTermDates(createRichContent('{{공고일}}'), '2026-11-10', new Date('2026-10-07T15:30:00Z')))
    ).toBe('2026년 10월 8일');
    expect(getRichText(fillTermDates(createRichContent('{{시행일}}부터 {{시행일}}까지'), '2027-03-05', NOW))).toBe(
      '2027년 3월 5일부터 2027년 3월 5일까지'
    );
  });
});

describe('R-약관시행일: 초안 저장은 비워도 되고 공개할 때만 필수', () => {
  it.each([
    ['', null],
    ['   ', null],
    ['2026. 10. 20.', '2026-10-20'],
    ['abc', undefined],
    ['2026. 02. 30.', undefined],
  ])('입력 %j 는 저장 요청 값 %j 로 바꾼다', (value, expected) => {
    expect(readTermDateInput(value)).toBe(expected);
  });

  it('비어 있는 시행일로 공개하려 하면 필수 안내를 준다', () => {
    expect(validateEffectiveDate('', PRIVACY, NOW)).toBe('공개하려면 시행일을 입력해 주세요.');
    expect(validateEffectiveDate('  ', PRIVACY, NOW)).toBe('공개하려면 시행일을 입력해 주세요.');
  });
});

describe('R-약관본문글자수: 100,000자까지', () => {
  it.each([
    [TERM_BODY_MAX_LENGTH, false],
    [TERM_BODY_MAX_LENGTH + 1, true],
  ])('글자 %i 개는 초과 %j', (length, isOverLimit) => {
    expect(countTermBody(createRichContent('가'.repeat(length)))).toEqual({ count: length, isOverLimit });
  });

  it('이모지는 보이는 글자 하나로 센다', () => {
    expect(countTermBody(createRichContent('😀😀')).count).toBe(2);
  });

  it('블록 사이 줄바꿈은 세지 않아 100,000자 본문에 문단을 나눠도 초과하지 않는다', () => {
    const half = '가'.repeat(TERM_BODY_MAX_LENGTH / 2);
    expect(countTermBody(createRichContent(`${half}\n${half}`))).toEqual({
      count: TERM_BODY_MAX_LENGTH,
      isOverLimit: false,
    });
  });
});

describe('R-약관공개전검사: 서식으로 쪼개진 {{공고일}}·{{시행일}}은 공개를 막는다', () => {
  const link = (...children: object[]) => ({ type: 'a', url: 'https://example.com', children });
  const content = (...blocks: object[]) => ({ schemaVersion: 1, blocks }) as RichContent;
  const paragraph = (...children: object[]) => ({ type: 'paragraph', children });

  it('서식 없이 한 조각에 든 표시는 정상이다', () => {
    expect(findSplitTermPlaceholders(createRichContent('공고일자: {{공고일}}\n시행일자: {{시행일}}'))).toEqual([]);
  });

  it('표시가 없는 본문은 정상이다', () => {
    expect(findSplitTermPlaceholders(createRichContent('제1조 목적'))).toEqual([]);
  });

  it('표시 전체에 굵게를 주면 한 조각이라 정상이다', () => {
    const body = content(paragraph({ text: '시행일 ' }, { text: '{{시행일}}', bold: true }, { text: '부터' }));
    expect(findSplitTermPlaceholders(body)).toEqual([]);
  });

  it('표시 일부에만 굵게를 주면 쪼개진 것이다', () => {
    const body = content(paragraph({ text: '문단' }), paragraph({ text: '{{시행', bold: true }, { text: '일}}' }));
    expect(findSplitTermPlaceholders(body)).toEqual([{ placeholder: '시행일', blockIndex: 1 }]);
  });

  it('표시 일부가 링크 안에 있으면 쪼개진 것이다', () => {
    const body = content(paragraph({ text: '{{공고' }, link({ text: '일}}' }), { text: '' }));
    expect(findSplitTermPlaceholders(body)).toEqual([{ placeholder: '공고일', blockIndex: 0 }]);
  });

  it('{{ 만 따로 떨어져도 쪼개진 것이다', () => {
    const body = content(paragraph({ text: '{{', bold: true }, { text: '시행일}}' }));
    expect(findSplitTermPlaceholders(body)).toEqual([{ placeholder: '시행일', blockIndex: 0 }]);
  });

  it('}} 만 따로 떨어져도 쪼개진 것이다', () => {
    const body = content(paragraph({ text: '{{공고일' }, { text: '}}', italic: true }));
    expect(findSplitTermPlaceholders(body)).toEqual([{ placeholder: '공고일', blockIndex: 0 }]);
  });

  it('두 표시가 모두 쪼개지면 둘 다 돌려준다', () => {
    const body = content(
      paragraph({ text: '{{공고', bold: true }, { text: '일}}' }),
      paragraph({ text: '{{시행' }, { text: '일}}', bold: true })
    );
    expect(findSplitTermPlaceholders(body)).toEqual([
      { placeholder: '공고일', blockIndex: 0 },
      { placeholder: '시행일', blockIndex: 1 },
    ]);
  });

  it('한 조각에 든 표시와 쪼개진 표시가 함께 있으면 쪼개진 것이 있다고 본다', () => {
    const body = content(paragraph({ text: '{{시행일}} 또는 {{시행' }, { text: '일}}', bold: true }));
    expect(findSplitTermPlaceholders(body)).toEqual([{ placeholder: '시행일', blockIndex: 0 }]);
  });

  it('서로 다른 블록의 {{ 와 }} 는 이어 붙이지 않는다', () => {
    const body = content(paragraph({ text: '{{시행일' }), paragraph({ text: '}}' }));
    expect(findSplitTermPlaceholders(body)).toEqual([]);
  });

  it('표 칸과 목록 항목 안에서 쪼개진 표시도 맨 위 블록 순서로 찾는다', () => {
    const table = {
      type: 'table',
      children: [
        {
          type: 'tr',
          children: [{ type: 'td', children: [paragraph({ text: '{{시행' }, { text: '일}}', bold: true })] }],
        },
      ],
    };
    const list = {
      type: 'ul',
      children: [{ type: 'li', children: [paragraph({ text: '{{공고' }, { text: '일}}', bold: true })] }],
    };
    expect(findSplitTermPlaceholders(content(paragraph({ text: '앞' }), table, list))).toEqual([
      { placeholder: '시행일', blockIndex: 1 },
      { placeholder: '공고일', blockIndex: 2 },
    ]);
  });

  it('안내 문구는 쪼개진 표시 이름을 넣는다', () => {
    expect(getSplitPlaceholderMessage([{ placeholder: '시행일', blockIndex: 0 }])).toBe(
      '본문의 {{시행일}}에 굵게·링크 같은 서식이 들어 있어 날짜가 채워지지 않아요. 서식을 풀고 다시 입력해 주세요.'
    );
    expect(
      getSplitPlaceholderMessage([
        { placeholder: '시행일', blockIndex: 1 },
        { placeholder: '공고일', blockIndex: 0 },
      ])
    ).toContain('{{공고일}}·{{시행일}}');
  });
});
