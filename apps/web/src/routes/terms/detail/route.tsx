import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { useParams } from 'react-router';
import { Forbidden } from '@/routes/app/ui/forbidden';
import { useAuthStore } from '@/store/auth';
import { Card, CardContent } from '@/ui/atoms/card';
import { ListState } from '@/ui/molecules/list-state';
import { formatDate } from '@/util/date-format';
import { formatDocumentTitle } from '@/util/page-config';
import { termQueryOptions, termsQueryOptions } from '../api/terms';
import { TERM_KIND_LABELS, type TermKind } from '../type/term';
import { displayTermDate, getTermStatus } from '../util/term-policy';
import { readTermKind, termListPath } from '../util/term-navigation';
import { useTermClock } from '../util/use-term-clock';
import { TermBreadcrumb, TermStatusBadge } from '../ui/term-common';
import { TermConfirm } from '../ui/term-confirm';
import { TermEditor } from '../ui/term-editor';

export function TermMissing({ kind = 'service' }: { kind?: TermKind }) {
  return (
    <Card>
      <ListState kind='missing' listPath={termListPath(kind)} />
    </Card>
  );
}
export default function TermDetailRoute({ edit = false }: { edit?: boolean }) {
  const params = useParams();
  const kind = readTermKind(params.kind);
  const version = Number(params.version);
  if (!kind || !/^\d+$/.test(params.version ?? '') || !Number.isSafeInteger(version) || version <= 0) {
    return <TermMissing kind={kind ?? 'service'} />;
  }
  return <TermDetail key={`${kind}:${version}:${edit}`} kind={kind} version={version} edit={edit} />;
}
export function TermEditRoute() {
  return <TermDetailRoute edit />;
}
function TermDetail({ kind, version, edit }: { kind: TermKind; version: number; edit: boolean }) {
  const user = useAuthStore((state) => state.user);
  const query = useQuery(termQueryOptions(user?.email ?? '', kind, version));
  const versions = useQuery(termsQueryOptions(user?.email ?? '', kind));
  const now = useTermClock(query.dataUpdatedAt + versions.dataUpdatedAt);
  if (edit && user?.role !== 'superAdmin') return <Forbidden title='이용약관' />;
  if (query.isPending || versions.isPending) {
    return (
      <Card>
        <ListState kind='loading' />
      </Card>
    );
  }
  if (query.isError || versions.isError) {
    const error = query.error || versions.error;
    return axios.isAxiosError(error) && error.response?.status === 404 ? (
      <TermMissing kind={kind} />
    ) : (
      <Card>
        <ListState
          kind='error'
          onAction={() => {
            void query.refetch();
            void versions.refetch();
          }}
        />
      </Card>
    );
  }
  const term = query.data;
  const title = `${TERM_KIND_LABELS[kind]} 버전 #${version}`;
  if (term.status === 'draft' && user?.role === 'superAdmin') {
    return <TermEditor key={`${kind}:${version}`} kind={kind} term={term} versions={versions.data} />;
  }
  if (edit) return <Forbidden title='이용약관' />;
  const status = getTermStatus(term, versions.data, now);
  return (
    <>
      <title>{formatDocumentTitle(title)}</title>
      <TermBreadcrumb title={title} kind={kind} />
      <div className='flex flex-wrap items-center justify-between gap-3'>
        <h1 tabIndex={-1} className='min-w-0 text-kd-title-1 [overflow-wrap:anywhere]'>
          {title}
        </h1>
        {user?.role === 'superAdmin' && status === '예정' && <TermConfirm term={term} action='withdraw' />}
      </div>
      <div className='mt-4 flex flex-wrap items-center gap-3'>
        <TermStatusBadge status={status} />
        {status === '철회' && (
          <span className='text-kd-sub text-kd-foreground-muted'>앱에 보이지 않는 버전입니다.</span>
        )}
      </div>
      <div className='mt-6 grid min-w-0 grid-cols-[minmax(0,1fr)_320px] gap-6 max-[1199px]:grid-cols-1'>
        <Card className='min-w-0'>
          <CardContent className='py-6'>
            <p className='whitespace-pre-wrap text-kd-body [overflow-wrap:anywhere]'>{term.body}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent variant='info'>
            <dl className='space-y-4'>
              {[
                ['버전 번호', `#${version}`],
                ['시행일', displayTermDate(term.effectiveDate)],
                ['공개일', term.publishedAt ? formatDate(term.publishedAt) : ''],
              ].map(([label, value]) => (
                <div key={label}>
                  <dt className='text-kd-sub text-kd-foreground-muted'>{label}</dt>
                  <dd className='text-kd-body'>{value || '—'}</dd>
                </div>
              ))}
            </dl>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
