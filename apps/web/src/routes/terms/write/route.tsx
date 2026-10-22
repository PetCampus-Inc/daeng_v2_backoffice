import { useQuery } from '@tanstack/react-query';
import { useParams } from 'react-router';
import { Forbidden } from '@/routes/app/ui/forbidden';
import { useAuthStore } from '@/store/auth';
import { Card } from '@/ui/atoms/card';
import { ListState } from '@/ui/molecules/list-state';
import { termsQueryOptions } from '../api/terms';
import { readTermKind } from '../util/term-navigation';
import { TermEditor } from '../ui/term-editor';
import { TermMissing } from '../detail/route';
export default function TermWriteRoute() {
  const { kind: rawKind } = useParams();
  const kind = readTermKind(rawKind);
  const user = useAuthStore((state) => state.user);
  const query = useQuery({
    ...termsQueryOptions(user?.email ?? '', kind ?? 'service'),
    enabled: !!kind && user?.role === 'superAdmin',
  });
  if (user?.role !== 'superAdmin') return <Forbidden title='이용약관' />;
  if (!kind) return <TermMissing />;
  if (query.isPending) {
    return (
      <Card>
        <ListState kind='loading' />
      </Card>
    );
  }
  if (query.isError) {
    return (
      <Card>
        <ListState kind='error' onAction={() => void query.refetch()} />
      </Card>
    );
  }
  return <TermEditor key={kind} kind={kind} versions={query.data} />;
}
