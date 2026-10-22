import { useNavigate } from 'react-router';

import { Card } from '@/ui/atoms/card';
import { ListState } from '@/ui/molecules/list-state';
import { documentTitle, PAGES } from '@/util/page';

/** 없는 주소. 본문 자리에 '페이지를 찾을 수 없습니다.' + [홈으로 이동](PRD 4.5 '상세 대상 없음'과 같은 모양). */
export default function NotFoundRoute() {
  const navigate = useNavigate();

  return (
    <>
      <title>{documentTitle('페이지를 찾을 수 없음')}</title>
      <Card>
        <ListState kind='not-found' onAction={() => navigate(PAGES.home.path)} />
      </Card>
    </>
  );
}
