import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { useEffect, useRef } from 'react';
import { Link, useParams } from 'react-router';
import { useAuthStore } from '@/store/auth';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/ui/atoms/breadcrumb';
import { Card, CardContent, CardHeader, CardTitle } from '@/ui/atoms/card';
import { ListState } from '@/ui/molecules/list-state';
import { formatDate } from '@/util/date-format';
import { formatDocumentTitle, PAGES } from '@/util/page-config';
import { ideaQueryOptions } from '../api/ideas/index';
import { IDEA_USER_TYPE_LABELS } from '../type/idea';
import { useIdeaListSearchParams } from '../util/list-search-params';

function IdeaNotFound() {
  return (
    <>
      <title>{formatDocumentTitle('페이지를 찾을 수 없음')}</title>
      <Card>
        <ListState kind='missing' listPath={PAGES.ideas.path} />
      </Card>
    </>
  );
}

export default function IdeaDetailRoute() {
  const { ideaId = '' } = useParams();
  if (!/^\d+$/.test(ideaId) || !Number.isSafeInteger(Number(ideaId))) return <IdeaNotFound />;
  return <IdeaDetailContent id={Number(ideaId)} />;
}

function IdeaDetailContent({ id }: { id: number }) {
  const email = useAuthStore((state) => state.user?.email) ?? '';
  const { listSearch } = useIdeaListSearchParams();
  const query = useQuery(ideaQueryOptions(email, id));
  const headingRef = useRef<HTMLHeadingElement>(null);
  const shouldFocusAfterRetryRef = useRef(false);
  useEffect(() => {
    if (query.isSuccess && shouldFocusAfterRetryRef.current) {
      shouldFocusAfterRetryRef.current = false;
      headingRef.current?.focus({ preventScroll: true });
    }
  }, [query.isSuccess]);
  if (query.isPending) {
    return (
      <>
        <title>{formatDocumentTitle(`제안 #${id}`)}</title>
        <Card>
          <ListState kind='loading' />
        </Card>
      </>
    );
  }
  if (query.isError) {
    if (axios.isAxiosError(query.error) && query.error.response?.status === 404) return <IdeaNotFound />;
    return (
      <>
        <title>{formatDocumentTitle(`제안 #${id}`)}</title>
        <Card>
          <ListState
            kind='error'
            onAction={() => {
              shouldFocusAfterRetryRef.current = true;
              void query.refetch();
            }}
          />
        </Card>
      </>
    );
  }
  const idea = query.data;
  const title = `제안 #${idea.id}`;
  return (
    <>
      <title>{formatDocumentTitle(title)}</title>
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>서비스 운영</BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link to={{ pathname: PAGES.ideas.path, search: listSearch }}>{PAGES.ideas.title}</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>{title}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>
      <h1 ref={headingRef} tabIndex={-1} className='text-kd-title-1 outline-none'>
        {title}
      </h1>
      <div className='mt-6 grid grid-cols-[minmax(0,1fr)_320px] items-start gap-6 max-[1199px]:grid-cols-1'>
        <Card>
          <CardHeader>
            <CardTitle>내용</CardTitle>
          </CardHeader>
          <CardContent>
            <p className='whitespace-pre-wrap text-kd-body [overflow-wrap:anywhere]'>{idea.content}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent variant='info'>
            <dl className='flex flex-col gap-4'>
              <div className='flex flex-col gap-1'>
                <dt className='text-kd-sub text-kd-foreground-muted'>사용자</dt>
                <dd className='text-kd-body [overflow-wrap:anywhere]'>
                  <span className='font-semibold'>{idea.user.name}</span>
                  <span className='block text-kd-caption text-kd-foreground-muted'>{idea.user.email}</span>
                </dd>
              </div>
              <div className='flex flex-col gap-1'>
                <dt className='text-kd-sub text-kd-foreground-muted'>사용자 유형</dt>
                <dd className='text-kd-body'>{IDEA_USER_TYPE_LABELS[idea.user.type]}</dd>
              </div>
              <div className='flex flex-col gap-1'>
                <dt className='text-kd-sub text-kd-foreground-muted'>제출일시</dt>
                <dd className='text-kd-body tabular-nums'>{formatDate(idea.submittedAt, true)}</dd>
              </div>
            </dl>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
