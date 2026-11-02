import { describe, expect, test } from 'vitest';
import { DEFAULT_MEMBERS } from '../../handlers/team-members';
import { getNotificationMessage, getNotificationRecipients, type NotificationEvent } from './index';

const OPERATOR = 'ops@knockdog.test';
const OPERATORS = ['admin@knockdog.test', OPERATOR, 'ops2@knockdog.test'];

describe('R-알림대상: 발생 시점의 활성 계정만 수신', () => {
  test.each<[string, NotificationEvent, string[]]>([
    ['01', { type: 'newInquiry', targetId: 1042 }, OPERATORS],
    ['02 답변 대기', { type: 'followUp', targetId: 1041, assigneeEmail: OPERATOR }, [OPERATOR]],
    ['03 확인 중', { type: 'followUp', targetId: 1041, assigneeEmail: OPERATOR }, [OPERATOR]],
    ['04 답변 도착', { type: 'followUp', targetId: 1041, assigneeEmail: OPERATOR }, [OPERATOR]],
    ['05', { type: 'followUp', targetId: 1041, assigneeEmail: null }, []],
    ['06', { type: 'followUp', targetId: 1041, assigneeEmail: 'inactive@knockdog.test' }, []],
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
  [{ type: 'newInquiry', targetId: 1042 }, '새 1:1 문의가 등록되었습니다. 문의 #1042'],
  [{ type: 'followUp', targetId: 1041, assigneeEmail: OPERATOR }, '담당 중인 문의에 추가 문의가 왔습니다. 문의 #1041'],
  [
    { type: 'assigneeChanged', targetId: 1041, previousEmail: OPERATOR, actorName: '김운영 · PM' },
    '김운영 · PM님이 문의의 담당자를 변경했습니다.',
  ],
  [{ type: 'newIdea', targetId: 350 }, '새 아이디어 제안이 등록되었습니다. 제안 #350'],
])('R-알림문구 $type', (event, message) => {
  expect(getNotificationMessage(event)).toBe(message);
});
