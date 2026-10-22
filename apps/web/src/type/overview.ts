/**
 * 홈(서비스 대시보드) 응답 `GET /overview`의 `data`.
 * 백엔드 스펙 전 가정이다. 기존 서버(`daeng-admin/service-admin.js`의 `/overview`) 응답 모양
 * `{ stats, signupTrend, recentVerifications }`를 새 BO 응답 틀(`ApiResponse`)에 넣었다.
 * 스펙이 나오면 이름·모양만 맞추고 화면 규칙은 그대로 둔다.
 */

/** 원장 인증 단계. 기존 `tb_owner_verification.status` 값. */
export type VerificationStatus =
  | 'KINDERGARTEN_INFO_COMPLETED'
  | 'BUSINESS_REGISTRATION_PENDING'
  | 'SUBMITTED'
  | 'REVOKED';

/** 지표 숫자. 뜻은 fixtures.md `홈-기본` 표를 따른다. */
export type OverviewStats = {
  /** 탈퇴 포함 모든 회원 */
  totalUsers: number;
  /** 최근 30일 신규 회원 */
  newUsers30d: number;
  /** 지우지 않은 반려견이 1마리 이상인 활성 회원 */
  guardians: number;
  /** 해지되지 않은 원장 역할이 있는 활성 회원 */
  activeOwners: number;
  /** 최근 7일 안에 생긴, 해지되지 않은 원장 역할 */
  newOwners7d: number;
  /** 원장 역할이 해지된 회원 수. 해지됨 인증이 0건일 때 '해지된 원장' 카드에 대신 쓴다 */
  revokedOwners: number;
  /** 해지되지 않은 원장 역할이 연결된 유치원 */
  managedSchools: number;
  totalSchools: number;
  /** 운영 상태 ACTIVE 유치원 */
  activeSchools: number;
  /** 인증 단계별 건수. 건이 없는 단계는 키가 빠질 수 있다 */
  verificationCounts: Partial<Record<VerificationStatus, number>>;
};

/** 가입 추이 하루. 가입이 없는 날은 서버가 빼고 줄 수 있다(화면에서 0으로 채운다). */
export type SignupTrendItem = {
  /** KST 날짜 `YYYY-MM-DD` */
  date: string;
  count: number;
};

/** 최근 원장 인증 한 건. 서버가 제출일 최신순으로 최대 6건 준다. */
export type RecentVerification = {
  id: number;
  /** 회원 닉네임. 없으면 `userId`를 대신 보여 준다 */
  nickname: string | null;
  userId: string;
  kindergartenName: string;
  status: VerificationStatus;
  /** ISO 날짜·시간. 유치원 정보 입력 단계는 아직 제출 전이라 없다 */
  submittedAt: string | null;
};

export type Overview = {
  stats: OverviewStats;
  signupTrend: SignupTrendItem[];
  recentVerifications: RecentVerification[];
};

/** 인증 단계 화면 이름(service-admin.html `verificationLabels`). */
export const VERIFICATION_STATUS_LABELS: Record<VerificationStatus, string> = {
  KINDERGARTEN_INFO_COMPLETED: '유치원 정보 입력',
  BUSINESS_REGISTRATION_PENDING: '사업자번호 대기',
  SUBMITTED: '인증 완료',
  REVOKED: '해지됨',
};
