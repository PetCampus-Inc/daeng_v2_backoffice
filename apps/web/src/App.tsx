import { JOB_ROLES } from '@daeng/shared';

import { Button } from '@/components/ui/button';

/** 백오피스 루트 화면. 모노레포와 기술 스택 연결 확인용 최소 화면이다. */
function App() {
  return (
    <main className='flex flex-col items-start gap-4 p-8'>
      <h1 className='text-2xl font-semibold'>댕v2 백오피스</h1>
      <p className='text-muted-foreground'>직무: {JOB_ROLES.join(' · ')}</p>
      <Button>shadcn 버튼</Button>
    </main>
  );
}

export default App;
