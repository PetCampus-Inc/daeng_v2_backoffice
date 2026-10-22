import { useNavigate } from 'react-router';
import { useAuthStore } from '@/store/auth';
import { Forbidden } from '@/routes/app/ui/forbidden';
import { PAGES } from '@/util/page-config';
import { useNoticeListSearchParams } from '../util/list-search-params';
import { NoticeEditor } from '../ui/notice-editor';

export default function NoticeWriteRoute() {
  const user = useAuthStore((state) => state.user);
  const navigate = useNavigate();
  const { listSearch } = useNoticeListSearchParams();
  if (!user || user.role === 'viewer') return <Forbidden title={PAGES.notices.title} />;
  return (
    <NoticeEditor
      onPublished={(notice) =>
        void navigate(
          { pathname: `${PAGES.notices.path}/${notice.id}`, search: listSearch },
          { replace: true, state: { published: true } }
        )
      }
    />
  );
}
