import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router';
import { Forbidden } from '@/routes/app/ui/forbidden';
import { useAuthStore } from '@/store/auth';
import { Button } from '@/ui/atoms/button';
import { Card, CardContent } from '@/ui/atoms/card';
import { ListState } from '@/ui/molecules/list-state';
import { formatDate } from '@/util/date-format';
import { formatDocumentTitle, PAGES } from '@/util/page-config';
import { noticeQueryOptions } from '../api/notices/index';
import { getNoticeText } from '../util/notice-policy';
import { useNoticeListSearchParams } from '../util/list-search-params';
import { NoticeActions } from '../ui/notice-actions';
import { NoticeBreadcrumb } from '../ui/notice-breadcrumb';
import { NoticeEditor, NoticePublished } from '../ui/notice-editor';
import { NoticeStatusBadge } from '../ui/notice-status-badge';

function NoticeMissing() {
  return (
    <>
      <title>{formatDocumentTitle('페이지를 찾을 수 없음')}</title>
      <Card>
        <ListState kind='missing' listPath={PAGES.notices.path} />
      </Card>
    </>
  );
}

export default function NoticeDetailRoute({ edit = false }: { edit?: boolean }) {
  const { noticeId = '' } = useParams();
  if (!/^\d+$/.test(noticeId) || !Number.isSafeInteger(Number(noticeId))) return <NoticeMissing />;
  return <NoticeDetailContent key={`${noticeId}:${edit}`} id={Number(noticeId)} edit={edit} />;
}

export function NoticeEditRoute() {
  return <NoticeDetailRoute edit />;
}

function NoticeDetailContent({ id, edit }: { id: number; edit: boolean }) {
  const user = useAuthStore((state) => state.user);
  const query = useQuery(noticeQueryOptions(user?.email ?? '', id));
  const { listSearch } = useNoticeListSearchParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [isPublished, setIsPublished] = useState(() => Boolean(location.state?.published));
  useEffect(() => {
    if (location.state?.published) {
      void navigate({ pathname: location.pathname, search: location.search }, { replace: true, state: null });
    }
  }, [location, navigate]);
  const canWrite = user && user.role !== 'viewer';
  if (edit && !canWrite) return <Forbidden title={PAGES.notices.title} />;
  if (query.isPending) {
    return (
      <Card>
        <ListState kind='loading' />
      </Card>
    );
  }
  if (query.isError) {
    return axios.isAxiosError(query.error) && query.error.response?.status === 404 ? (
      <NoticeMissing />
    ) : (
      <Card>
        <ListState kind='error' onAction={() => void query.refetch()} />
      </Card>
    );
  }
  const notice = query.data;
  const detailPath = { pathname: `${PAGES.notices.path}/${id}`, search: listSearch };
  // 완료 화면은 현재 탐색 동안만 보여 준다. 새로고침은 읽기 화면으로 시작한다.
  if (isPublished) return <NoticePublished notice={notice} onView={() => setIsPublished(false)} />;
  if (canWrite && (notice.status === 'draft' || edit)) {
    return (
      <NoticeEditor
        notice={notice}
        onPublished={() => {
          setIsPublished(true);
          void navigate(detailPath, { replace: true, state: null });
        }}
      />
    );
  }
  const title = notice.title || '제목 없음';
  return (
    <>
      <title>{formatDocumentTitle(title)}</title>
      <NoticeBreadcrumb title={`공지 #${id}`} listSearch={listSearch} />
      <div className='flex flex-wrap items-center justify-between gap-3'>
        <h1 className='min-w-0 text-kd-title-1 [overflow-wrap:anywhere]'>{title}</h1>
        {canWrite && (
          <div className='flex gap-2'>
            {notice.status === 'published' && <NoticeActions notice={notice} />}
            <Button variant={notice.status === 'unpublished' ? 'outline' : 'default'} asChild>
              <Link to={{ pathname: `${PAGES.notices.path}/${id}/edit`, search: listSearch }}>수정</Link>
            </Button>
            {notice.status === 'unpublished' && <NoticeActions notice={notice} showRepublish />}
          </div>
        )}
      </div>
      <div className='mt-4'>
        <NoticeStatusBadge status={notice.status} />
      </div>
      <div className='mt-6 grid grid-cols-[minmax(0,1fr)_320px] items-start gap-6 max-[1200px]:grid-cols-1'>
        <Card>
          <CardContent className='py-6'>
            <p className='whitespace-pre-wrap text-kd-body [overflow-wrap:anywhere]'>{getNoticeText(notice.body)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent variant='info'>
            <dl className='flex flex-col gap-4'>
              {[
                ['공지 번호', `#${id}`],
                ['게시일', formatDate(notice.publishedAt)],
                ['마지막 수정', formatDate(notice.updatedAt, true)],
              ].map(([label, value]) => (
                <div key={label} className='space-y-1'>
                  <dt className='text-kd-sub text-kd-foreground-muted'>{label}</dt>
                  <dd className='text-kd-body tabular-nums'>{value}</dd>
                </div>
              ))}
            </dl>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
