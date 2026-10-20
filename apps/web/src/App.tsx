import { JOB_ROLES } from '@daeng/shared';

/** 백오피스 루트 화면. 모노레포 연결 확인용 최소 화면이다. */
function App() {
  return (
    <main>
      <h1>댕v2 백오피스</h1>
      <p>직무: {JOB_ROLES.join(' · ')}</p>
    </main>
  );
}

export default App;
