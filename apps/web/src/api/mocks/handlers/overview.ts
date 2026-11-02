import { http } from 'msw';
import { mockUrl, okResponse } from '../util/response';
import { authenticateMockRequest } from '../util/session';
import type { Overview, SignupTrendItem } from '@/type/overview';
import { fillSignupTrend } from '@/util/signup-trend';

/**
 * fixtures.md `홈-기본` 가입 추이 30일(하루 1~5명, 합계 42 = 최근 30일 신규 회원).
 * 날짜는 오늘(KST)을 마지막 날로 붙인다. TC 기준 시각(10. 07.)에서는 09. 08.~10. 07.이다.
 */
const SIGNUP_COUNTS = [1, 2, 1, 1, 3, 1, 1, 2, 1, 1, 1, 2, 1, 1, 4, 1, 1, 1, 2, 1, 1, 1, 3, 1, 1, 1, 2, 1, 1, 1];

/** 오늘 기준 최근 30일 가입 추이를 만든다. */
const createSignupTrend = (): SignupTrendItem[] =>
  fillSignupTrend([], new Date()).map((item, index) => ({ ...item, count: SIGNUP_COUNTS[index] }));

/** fixtures.md `홈-기본`. 최근 원장 인증은 `인증-기본` 5건(제출일 최신순). */
const createDefaultOverview = (): Overview => ({
  stats: {
    totalUsers: 1284,
    newUsers30d: 42,
    guardians: 1137,
    activeOwners: 147,
    newOwners7d: 5,
    revokedOwners: 1,
    managedSchools: 132,
    totalSchools: 140,
    activeSchools: 124,
    verificationCounts: {
      KINDERGARTEN_INFO_COMPLETED: 3,
      BUSINESS_REGISTRATION_PENDING: 9,
      SUBMITTED: 150,
      REVOKED: 4,
    },
  },
  signupTrend: createSignupTrend(),
  recentVerifications: [
    {
      id: 205,
      nickname: '김신청',
      userId: 'U205',
      kindergartenName: '멍멍스쿨',
      status: 'BUSINESS_REGISTRATION_PENDING',
      submittedAt: '2026-10-06T01:00:00Z',
    },
    {
      id: 204,
      nickname: '이원장',
      userId: 'U002',
      kindergartenName: '햇살유치원',
      status: 'SUBMITTED',
      submittedAt: '2026-10-01T01:00:00Z',
    },
    {
      id: 203,
      nickname: '박원장',
      userId: 'U003',
      kindergartenName: '달빛유치원',
      status: 'SUBMITTED',
      submittedAt: '2026-09-15T01:00:00Z',
    },
    {
      id: 202,
      nickname: '최해지',
      userId: 'U004',
      kindergartenName: '도담유치원',
      status: 'REVOKED',
      submittedAt: '2026-09-01T01:00:00Z',
    },
    {
      id: 201,
      nickname: '정입력',
      userId: 'U201',
      kindergartenName: '포레스트독',
      status: 'KINDERGARTEN_INFO_COMPLETED',
      submittedAt: null,
    },
  ],
});

/** 홈 데이터 가짜 API. 모든 역할이 볼 수 있고, 세션이 없거나 만료·비활성이면 요청을 거부한다. */
export const OVERVIEW_HANDLERS = [
  http.get(mockUrl('/overview'), () => authenticateMockRequest().denied ?? okResponse(createDefaultOverview())),
];
