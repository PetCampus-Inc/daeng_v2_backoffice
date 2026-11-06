import { describe, expect, it } from 'vitest';
import type { RichContent } from '@/type/rich-content';
import { getRichText } from '@/util/rich-content';
import { TermsKind, TermsPublishStatus } from '@/routes/terms/type';
import { createDefaultTerms } from '../../handlers/terms';
import {
  canWithdrawTerm,
  checkPublishDate,
  fillPublishedTermDates,
  getTermList,
  isTermDate,
  parseTermId,
  parseTermKind,
  toTermSummaryResponse,
  type MockTerm,
} from './index';

const NOW = new Date('2026-10-07T10:00:00+09:00');
const DEFAULT_TERMS = createDefaultTerms();
const idsOf = (kind: TermsKind, items = DEFAULT_TERMS) => getTermList(items, kind).map((item) => item.id);

/** 정렬·상태 규칙만 보려고 시행일과 상태만 채운 버전을 만든다. */
const makeTerm = (
  id: number,
  effectiveDate: string | null,
  publishStatus: TermsPublishStatus = TermsPublishStatus.PUBLISHED
): MockTerm => ({
  id,
  kind: TermsKind.SERVICE_TERMS,
  effectiveDate,
  publishStatus,
  publishedAt: publishStatus === TermsPublishStatus.DRAFT ? null : '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  content: { schemaVersion: 1, blocks: [] },
  announcedDate: null,
  version: 1,
});

describe('약관 목록 TC R-약관정렬: 서버 순서', () => {
  it('약관-기본은 서비스 #4(초안이 맨 위), #3, #2, #1, 개인정보 #6, #5 순서다', () => {
    expect(idsOf(TermsKind.SERVICE_TERMS)).toEqual([4, 3, 2, 1]);
    expect(idsOf(TermsKind.PRIVACY_POLICY)).toEqual([6, 5]);
    expect(idsOf(TermsKind.LOCATION_TERMS)).toEqual([]);
  });

  it('초안끼리는 시행일과 관계없이 최근 생성순(번호가 큰 것 먼저)이다', () => {
    const items = [
      makeTerm(1, '2026-09-01'),
      makeTerm(2, null, TermsPublishStatus.DRAFT),
      makeTerm(3, '2026-12-01', TermsPublishStatus.DRAFT),
      makeTerm(4, null, TermsPublishStatus.DRAFT),
    ];
    expect(idsOf(TermsKind.SERVICE_TERMS, items)).toEqual([4, 3, 2, 1]);
  });

  it('초안은 시행일이 가장 늦은 공개 버전보다도 위에 둔다', () => {
    const items = [
      makeTerm(1, '2026-09-01'),
      makeTerm(2, '2026-10-20'),
      makeTerm(3, '2026-08-10', TermsPublishStatus.DRAFT),
    ];
    expect(idsOf(TermsKind.SERVICE_TERMS, items)).toEqual([3, 2, 1]);
  });

  it('시행일이 같으면 번호가 큰 것이 먼저다', () => {
    const items = [makeTerm(1, '2026-10-20'), makeTerm(2, '2026-10-20')];
    expect(idsOf(TermsKind.SERVICE_TERMS, items)).toEqual([2, 1]);
  });
});

describe('약관 시행 상태(서버 effectiveStatus)', () => {
  it('공개된 버전만 현행·예정·과거를 갖고 초안·철회는 null이다', () => {
    const list = getTermList(DEFAULT_TERMS, TermsKind.SERVICE_TERMS);
    expect(list.map((item) => toTermSummaryResponse(item, list, NOW).effectiveStatus)).toEqual([
      null,
      'SCHEDULED',
      'CURRENT',
      'PAST',
    ]);
    const privacy = getTermList(DEFAULT_TERMS, TermsKind.PRIVACY_POLICY);
    expect(privacy.map((item) => toTermSummaryResponse(item, privacy, NOW).effectiveStatus)).toEqual([null, 'CURRENT']);
  });
});

describe('약관 공개 시행일 검증 TC R-약관시행일', () => {
  const service = DEFAULT_TERMS.filter((item) => item.kind === TermsKind.SERVICE_TERMS);
  const privacy = DEFAULT_TERMS.filter((item) => item.kind === TermsKind.PRIVACY_POLICY);
  it.each([
    ['2026-10-14', privacy, undefined],
    ['2026-10-13', privacy, 'TERMS_EFFECTIVE_DATE_TOO_SOON'],
    ['2026-10-07', privacy, 'TERMS_EFFECTIVE_DATE_TOO_SOON'],
    ['2026-10-06', privacy, 'TERMS_EFFECTIVE_DATE_IN_PAST'],
    ['2026-02-30', privacy, 'TERMS_EFFECTIVE_DATE_INVALID_FORMAT'],
    [null, privacy, 'TERMS_EFFECTIVE_DATE_REQUIRED'],
    ['abc', privacy, 'TERMS_EFFECTIVE_DATE_INVALID_FORMAT'],
    ['2026-11-01', privacy, undefined],
    ['2026-10-20', service, 'TERMS_EFFECTIVE_DATE_DUPLICATED'],
    ['2026-10-15', service, 'TERMS_EFFECTIVE_DATE_NOT_AFTER_LATEST'],
    ['2026-10-21', service, undefined],
  ])('시행일 %s 는 %s', (effectiveDate, versions, code) => {
    expect(checkPublishDate(effectiveDate, versions, NOW)?.code).toBe(code);
  });

  it('철회한 버전(11월 1일)은 가장 늦은 시행일 비교에도 중복 비교에도 넣지 않는다', () => {
    expect(checkPublishDate('2026-10-14', privacy, NOW)).toBeUndefined();
    expect(checkPublishDate('2026-11-01', privacy, NOW)).toBeUndefined();
    expect(checkPublishDate('2026-11-02', privacy, NOW)).toBeUndefined();
  });

  it('초안끼리 시행일이 같아도 중복이 아니다', () => {
    const items = [makeTerm(1, '2026-10-20'), makeTerm(2, '2026-11-20', TermsPublishStatus.DRAFT)];
    expect(checkPublishDate('2026-11-20', items, NOW)).toBeUndefined();
  });

  it('공개 버전과 시행일이 같으면 가장 늦은 시행일 검사보다 먼저 중복으로 막는다', () => {
    const items = [makeTerm(1, '2026-12-01'), makeTerm(2, '2026-11-20')];
    expect(checkPublishDate('2026-11-20', items, NOW)?.code).toBe('TERMS_EFFECTIVE_DATE_DUPLICATED');
    expect(checkPublishDate('2026-11-25', items, NOW)?.code).toBe('TERMS_EFFECTIVE_DATE_NOT_AFTER_LATEST');
  });

  it('KST 자정을 넘기면 최소 시행일이 하루 늦어진다', () => {
    expect(checkPublishDate('2026-10-14', privacy, new Date('2026-10-08T00:10:00+09:00'))?.code).toBe(
      'TERMS_EFFECTIVE_DATE_TOO_SOON'
    );
  });
});

describe('약관 철회 가능 여부', () => {
  const byId = (id: number) => DEFAULT_TERMS.find((item) => item.id === id)!;
  it('시행 전(예정)인 공개 버전만 철회할 수 있다', () => {
    expect(canWithdrawTerm(byId(3), NOW)).toBe(true);
    expect(canWithdrawTerm(byId(2), NOW)).toBe(false);
    expect(canWithdrawTerm(byId(4), NOW)).toBe(false);
    expect(canWithdrawTerm(byId(6), NOW)).toBe(false);
    expect(canWithdrawTerm(byId(3), new Date('2026-10-20T00:00:00+09:00'))).toBe(false);
  });
});

describe('약관 번호·종류·날짜 규칙', () => {
  it.each<[string, number | undefined]>([
    ['1', 1],
    ['14', 14],
    ['0', undefined],
    ['-1', undefined],
    ['1e3', undefined],
    ['0x10', undefined],
    [' 2', undefined],
    ['9007199254740993', undefined],
  ])('번호 %j 는 %j 이다', (rawId, expected) => {
    expect(parseTermId(rawId)).toBe(expected);
  });

  it('서버 종류 세 가지만 받는다', () => {
    expect(parseTermKind('SERVICE_TERMS')).toBe('SERVICE_TERMS');
    expect(parseTermKind('service')).toBeUndefined();
  });

  it.each([
    ['2026-11-10', true],
    ['2026-02-30', false],
    ['2026-1-1', false],
    ['2026. 11. 10.', false],
    ['', false],
    [20261110, false],
  ])('날짜 %j 는 %s', (value, expected) => {
    expect(isTermDate(value)).toBe(expected);
  });
});

describe('공개 모의 처리: 서버처럼 text 조각 하나씩 날짜를 채운다', () => {
  it('한 조각에 든 표시는 채우고 서식으로 쪼개진 표시는 그대로 둔다', () => {
    const body = {
      schemaVersion: 1,
      blocks: [
        { type: 'paragraph', children: [{ text: '공고 {{공고일}}', bold: true }] },
        { type: 'paragraph', children: [{ text: '{{시행' }, { text: '일}}', bold: true }] },
      ],
    } as RichContent;
    const result = fillPublishedTermDates(body, '2026-11-20', new Date('2026-11-06T10:00:00+09:00'));
    expect(getRichText(result)).toBe('공고 2026년 11월 6일\n{{시행일}}');
    expect(result.blocks[0].children[0]).toMatchObject({ bold: true });
  });
});
