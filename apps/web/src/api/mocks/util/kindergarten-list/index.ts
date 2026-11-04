import type { SchoolStatus, ServiceSchool } from '@/routes/kindergartens/type';

/** 원장 이름 원문은 모의 서버 내부 검색에만 사용한다. 보호자 이름이 비면 닉네임을 쓴다. */
export type MockKindergarten = {
  id: number;
  name: string;
  address: string;
  status: SchoolStatus;
  guardianName: string | null;
  nickname: string | null;
  ownerUserId: string | null;
  activeMembers: number;
  pendingMembers: number;
  businessVerified: boolean;
  createdAt: string;
};

/** 모의 서버의 유치원 목록 조건. */
export type MockKindergartenListParams = { status?: SchoolStatus; keyword: string };

/** 원장이 없을 때 서버가 이름 대신 내려 주는 글자. */
const OWNER_NOT_CONNECTED = '원장 미연결';

/** 원장 이름을 서버와 같은 규칙으로 만든다: 보호자 이름, 닉네임, '원장 미연결' 순(서버 `COALESCE`). */
export function getOwnerName(item: Pick<MockKindergarten, 'guardianName' | 'nickname'>): string {
  return item.guardianName || item.nickname || OWNER_NOT_CONNECTED;
}

/** 조건에 맞는 유치원을 등록일 최신순으로 골라 서버 응답 모양으로 만든다. 이름·주소·원장 이름(미연결 포함)을 부분 일치로 찾는다. */
export function getKindergartenList(items: MockKindergarten[], params: MockKindergartenListParams): ServiceSchool[] {
  const keyword = params.keyword.trim().toLowerCase();
  return items
    .map((item) => ({ item, ownerName: getOwnerName(item) }))
    .filter(
      ({ item, ownerName }) =>
        (!params.status || item.status === params.status) &&
        [item.name, item.address, ownerName].some((value) => value.toLowerCase().includes(keyword))
    )
    .sort(
      (left, right) =>
        Date.parse(right.item.createdAt) - Date.parse(left.item.createdAt) || right.item.id - left.item.id
    )
    .map(({ item, ownerName }) => ({
      id: item.id,
      name: item.name,
      address: item.address,
      addressDetail: null,
      phone: null,
      status: item.status,
      createdAt: item.createdAt,
      kindergartenPlaceId: null,
      ownerName,
      ownerUserId: item.ownerUserId,
      ownerGrantedAt: item.ownerUserId ? item.createdAt : null,
      activeMembers: item.activeMembers,
      pendingMembers: item.pendingMembers,
      businessVerified: item.businessVerified,
    }));
}
