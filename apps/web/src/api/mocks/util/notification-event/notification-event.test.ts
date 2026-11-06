import { describe, expect, test } from 'vitest';
import { DEFAULT_MEMBERS } from '../../handlers/team-members';
import { getNotificationMessage, getNotificationRecipients, type NotificationEvent } from './index';

const OPERATOR = 'ops@knockdog.test';
const OPERATORS = ['admin@knockdog.test', OPERATOR, 'ops2@knockdog.test'];

describe('R-알림대상: 서버가 정하는 수신자(활성 계정만)', () => {
  // 추가 문의(02~06)는 담당자가 활성이면 담당자와 최고 관리자만, 아니면 활성 최고 관리자·운영자 전원이 받는다(OQ-D30).
  test.each<[string, NotificationEvent, string[]]>([
    ['01', { type: 'newInquiry', targetId: 1042 }, OPERATORS],
    ['02~04', { type: 'followUp', targetId: 1041, assigneeEmail: OPERATOR }, ['admin@knockdog.test', OPERATOR]],
    ['05', { type: 'followUp', targetId: 1041, assigneeEmail: null }, OPERATORS],
    ['06', { type: 'followUp', targetId: 1041, assigneeEmail: 'inactive@knockdog.test' }, OPERATORS],
    [
      '07',
      { type: 'assigneeChanged', targetId: 1041, previousEmail: 'ops2@knockdog.test', actorName: '김운영 · PM' },
      ['ops2@knockdog.test'],
    ],
    [
      '08',
      { type: 'assigneeChanged', targetId: 1041, previousEmail: 'inactive@knockdog.test', actorName: '김운영 · PM' },
      [],
    ],
    ['09', { type: 'assigneeChanged', targetId: 1041, previousEmail: null, actorName: '김운영 · PM' }, []],
    ['10', { type: 'newIdea', targetId: 350 }, [...OPERATORS, 'viewer@knockdog.test']],
    ['11', { type: 'reviewReport', targetId: 1 }, []],
  ])('R-알림대상-%s', (_id, event, expected) => {
    expect(getNotificationRecipients(DEFAULT_MEMBERS, event)).toEqual(expected);
  });
});

test.each<[NotificationEvent, string]>([
  [{ type: 'newInquiry', targetId: 1042 }, '새 1:1 문의가 접수되었습니다.'],
  [{ type: 'followUp', targetId: 1041, assigneeEmail: null }, '문의에 사용자가 추가 문의를 남겼습니다.'],
  [
    { type: 'assigneeChanged', targetId: 1041, previousEmail: OPERATOR, actorName: '김운영 · PM' },
    '김운영 · PM님이 문의의 담당자를 변경했습니다.',
  ],
  [{ type: 'newIdea', targetId: 350 }, '새 아이디어 제안이 접수되었습니다.'],
])('서버 알림 문구(번호 없음) $type', (event, message) => {
  expect(getNotificationMessage(event)).toBe(message);
});
