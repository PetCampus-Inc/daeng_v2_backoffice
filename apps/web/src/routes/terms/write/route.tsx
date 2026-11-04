import { useState } from 'react';
import { useParams } from 'react-router';
import { Forbidden } from '@/routes/app/ui/forbidden';
import { useAuthStore } from '@/store/auth';
import type { RichContent } from '@/type/rich-content';
import { Card } from '@/ui/atoms/card';
import { ListState } from '@/ui/molecules/list-state';
import { termDetailQueryOptions, termListQueryOptions, toServerTermKind } from '../api/term-query';
import { useGetTermsVersion, useListTermsVersions } from '../api/use-terms';
import { findLatestPublishedTerm, getInitialTermBody } from '../util/term-policy';
import { readTermKind } from '../util/term-navigation';
import { TermEditor } from '../ui/term-editor';
import { TermMissing } from '../detail/route';
export default function TermWriteRoute() {
  const { kind: rawKind } = useParams();
  const kind = readTermKind(rawKind);
  const user = useAuthStore((state) => state.user);
  const email = user?.email ?? '';
  const canWrite = !!kind && user?.role === 'SUPER_ADMIN';
  const query = useListTermsVersions(toServerTermKind(kind ?? 'service'), {
    query: { ...termListQueryOptions(email, kind ?? 'service'), enabled: canWrite },
  });
  // 목록에는 본문이 없어서, 새 버전의 처음 본문은 시행일이 가장 늦은 공개 버전의 상세에서 가져온다(draft-template API는 연결하지 않음).
  const latest = query.data ? findLatestPublishedTerm(query.data) : undefined;
  const latestQuery = useGetTermsVersion(latest?.version ?? 0, {
    query: { ...termDetailQueryOptions(email, latest?.version ?? 0), enabled: canWrite && !!latest },
  });
  // 처음 본문은 한 번만 정한다. 쓰는 도중 다시 읽어 와도(다른 팀원이 공개 등) 편집기가 사라져 입력을 잃지 않게 한다.
  const [startBody, setStartBody] = useState<RichContent>();
  if (!startBody && query.data && (!latest || latestQuery.data)) {
    setStartBody(getInitialTermBody(latestQuery.data ? [latestQuery.data] : []));
  }
  if (user?.role !== 'SUPER_ADMIN') return <Forbidden title='이용약관' />;
  if (!kind) return <TermMissing />;
  if (!startBody && (query.isError || latestQuery.isError)) {
    return (
      <Card>
        <ListState
          kind='error'
          onAction={() => {
            void query.refetch();
            if (latest) void latestQuery.refetch();
          }}
        />
      </Card>
    );
  }
  if (!startBody) {
    return (
      <Card>
        <ListState kind='loading' />
      </Card>
    );
  }
  return <TermEditor key={kind} kind={kind} versions={query.data ?? []} startBody={startBody} />;
}
