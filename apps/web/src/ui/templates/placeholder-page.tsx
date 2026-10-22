import type { PageInfo } from '@/util/page';

import { Page } from './page';

/** 아직 만들지 않은 화면. 제목과 '준비 중입니다.'만 보여 준다. */
export function PlaceholderPage({ page }: { page: PageInfo }) {
  return (
    <Page title={page.title}>
      <p className='text-kd-body text-kd-foreground-muted'>준비 중입니다.</p>
    </Page>
  );
}
