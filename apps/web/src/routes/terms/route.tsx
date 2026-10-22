import { useQuery } from '@tanstack/react-query';
import { Tabs } from 'radix-ui';
import { useEffect, useRef } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { useAuthStore } from '@/store/auth';
import { Button } from '@/ui/atoms/button';
import { Card } from '@/ui/atoms/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/ui/atoms/table';
import { ListState } from '@/ui/molecules/list-state';
import { formatDate } from '@/util/date-format';
import { formatDocumentTitle } from '@/util/page-config';
import { termsQueryOptions } from './api/terms';
import { TERM_KINDS, TERM_KIND_LABELS } from './type/term';
import { displayTermDate, getTermStatus } from './util/term-policy';
import { readTermKind, termPath } from './util/term-navigation';
import { useTermClock } from './util/use-term-clock';
import { TermStatusBadge } from './ui/term-common';

export default function TermsRoute() {
  const user = useAuthStore((state) => state.user);
  const [params, setParams] = useSearchParams();
  const kind = readTermKind(params.get('kind')) ?? 'service';
  const query = useQuery(termsQueryOptions(user?.email ?? '', kind));
  const navigate = useNavigate();
  const selectedTabRef = useRef<HTMLButtonElement>(null);
  const now = useTermClock(query.dataUpdatedAt);
  useEffect(() => {
    if (!query.isSuccess) return;
    const saved = sessionStorage.getItem('terms-return');
    if (!saved) return;
    try {
      const point = JSON.parse(saved) as { kind: string; version: number; scroll: number };
      if (point.kind !== kind) return;
      const frame = requestAnimationFrame(() => {
        document.getElementById(`term-version-${point.version}`)?.focus({ preventScroll: true });
        window.scrollTo(0, point.scroll);
        sessionStorage.removeItem('terms-return');
      });
      return () => cancelAnimationFrame(frame);
    } catch {
      sessionStorage.removeItem('terms-return');
    }
  }, [kind, query.isSuccess]);
  const openVersion = (version: number) => {
    sessionStorage.setItem('terms-return', JSON.stringify({ kind, version, scroll: window.scrollY }));
    void navigate(termPath(kind, version));
  };
  return (
    <>
      <title>{formatDocumentTitle('이용약관')}</title>
      <div className='flex flex-wrap items-center justify-between gap-3'>
        <h1 className='text-kd-title-1'>이용약관</h1>
        {user?.role === 'superAdmin' && (
          <Button asChild>
            <Link to={termPath(kind, 'new')}>새 버전 작성</Link>
          </Button>
        )}
      </div>
      <Tabs.Root value={kind} onValueChange={(value) => setParams({ kind: value })} className='mt-6 min-w-0'>
        <Tabs.List aria-label='약관 종류' className='flex flex-wrap gap-2'>
          {TERM_KINDS.map((value) => (
            <Tabs.Trigger
              key={value}
              value={value}
              ref={value === kind ? selectedTabRef : undefined}
              className='rounded-kd-2 border border-kd-border px-3 py-2 text-kd-sub outline-none focus-visible:ring-2 focus-visible:ring-kd-primary data-[state=active]:bg-kd-primary data-[state=active]:text-white'
            >
              {TERM_KIND_LABELS[value]}
            </Tabs.Trigger>
          ))}
        </Tabs.List>
        <Tabs.Content value={kind} forceMount asChild>
          <Card className='mt-4 min-h-64' aria-busy={query.isFetching}>
            <div className='h-8 px-4 pt-2 text-kd-caption text-kd-foreground-muted' role='status'>
              {query.isFetching ? '버전을 불러오는 중…' : ''}
            </div>
            {query.isPending ? (
              <ListState kind='loading' />
            ) : query.isError ? (
              <ListState
                kind='error'
                onAction={() => {
                  selectedTabRef.current?.focus({ preventScroll: true });
                  void query.refetch();
                }}
              />
            ) : query.data.length === 0 ? (
              <ListState kind='empty' />
            ) : (
              <Table scrollLabel='약관 버전 목록 가로 스크롤'>
                <caption className='sr-only'>{TERM_KIND_LABELS[kind]} 버전 목록</caption>
                <TableHeader>
                  <TableRow>
                    {['버전 번호', '상태', '시행일', '공개일'].map((label) => (
                      <TableHead key={label}>{label}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {query.data.map((term) => (
                    <TableRow key={term.version} className='cursor-pointer' onClick={() => openVersion(term.version)}>
                      <TableCell>
                        <button
                          id={`term-version-${term.version}`}
                          className='rounded-kd-2 font-semibold focus-visible:outline-2 focus-visible:outline-kd-primary'
                          onClick={(event) => {
                            event.stopPropagation();
                            openVersion(term.version);
                          }}
                        >
                          #{term.version}
                        </button>
                      </TableCell>
                      <TableCell>
                        <TermStatusBadge status={getTermStatus(term, query.data, now)} />
                      </TableCell>
                      <TableCell className='whitespace-nowrap tabular-nums'>
                        {displayTermDate(term.effectiveDate)}
                      </TableCell>
                      <TableCell className='whitespace-nowrap tabular-nums'>
                        {term.publishedAt ? formatDate(term.publishedAt) : ''}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </Card>
        </Tabs.Content>
      </Tabs.Root>
    </>
  );
}
