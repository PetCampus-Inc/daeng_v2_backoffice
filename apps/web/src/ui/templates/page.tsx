import type { ReactNode } from 'react';

import { documentTitle } from '@/util/page';

/**
 * 본문 화면 한 장. 탭 제목과 화면 제목(h1, 제목 1)을 두고, 제목 아래 24 띄워 본문을 둔다(design.md 1.3).
 */
export function Page({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <>
      <title>{documentTitle(title)}</title>
      <h1 className='text-kd-title-1'>{title}</h1>
      <div className='mt-6'>{children}</div>
    </>
  );
}
