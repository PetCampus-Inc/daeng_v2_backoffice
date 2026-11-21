import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router';

import { recordAccessDenial } from '@/api/use-my-account';
import { Card } from '@/ui/atoms/card';
import { ListState } from '@/ui/molecules/list-state';
import { Page } from '@/ui/templates/page';
import { PAGES } from '@/util/page-config';

/**
 * 권한 없음 화면(PRD 4.5). 화면 제목만 두고 본문 자리에 '접근 권한이 없습니다.' + [홈으로 이동].
 * 화면 차단은 서버 요청 없이 끝나므로, 처음 보일 때 서버에 접속 기록('권한 없는 접근 시도')을 남긴다(FR-BO-001).
 * 기록하지 않을 때는 `skipAccessLog`를 넘긴다: API가 403을 돌려줘서 띄울 때(서버가 이미 기록함),
 * 역할 때문이 아니라 항목 상태 때문에 막을 때(예: 공개된 약관 버전 편집 주소).
 */
export function Forbidden({ title, skipAccessLog = false }: { title: string; skipAccessLog?: boolean }) {
  const navigate = useNavigate();
  // 개발 모드(StrictMode)에서 효과가 두 번 실행돼도 한 번만 기록한다.
  const reportedRef = useRef(skipAccessLog);

  useEffect(() => {
    if (reportedRef.current) return;
    reportedRef.current = true;
    // 기록은 화면 표시와 무관하므로 실패해도 사용자에게 알리지 않는다.
    recordAccessDenial().catch(() => undefined);
  }, []);

  return (
    <Page title={title}>
      <Card>
        <ListState kind='forbidden' onAction={() => navigate(PAGES.home.path)} />
      </Card>
    </Page>
  );
}
