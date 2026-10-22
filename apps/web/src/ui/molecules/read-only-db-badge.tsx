import { Badge } from '@/ui/atoms/badge';

/**
 * '운영 DB · 읽기 전용' 표시(FR-BO-111). 기존 조회 화면(홈·회원·유치원·원장 인증 현황)의 화면 제목 오른쪽에 둔다.
 * 연한 초록 바탕 둥근 글자(service-admin.html 기준)라 초록 배지 모양을 그대로 쓴다.
 */
export function ReadOnlyDbBadge() {
  return <Badge variant='success'>운영 DB · 읽기 전용</Badge>;
}
