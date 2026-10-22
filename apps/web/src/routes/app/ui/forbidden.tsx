import { useNavigate } from 'react-router';

import { Card } from '@/ui/atoms/card';
import { ListState } from '@/ui/molecules/list-state';
import { Page } from '@/ui/templates/page';
import { PAGES } from '@/util/page';

/**
 * 권한 없음 화면(PRD 4.5). 화면 제목만 두고 본문 자리에 '접근 권한이 없습니다.' + [홈으로 이동].
 * 서버의 접속 기록('권한 없는 접근 시도')은 API를 붙인 뒤 서버가 남긴다.
 */
export function Forbidden({ title }: { title: string }) {
  const navigate = useNavigate();

  return (
    <Page title={title}>
      <Card>
        <ListState kind='forbidden' onAction={() => navigate(PAGES.home.path)} />
      </Card>
    </Page>
  );
}
