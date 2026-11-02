import { Link } from 'react-router';
import { Badge } from '@/ui/atoms/badge';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/ui/atoms/breadcrumb';
import type { TermKind, TermDisplayStatus } from '../type/term';
import { termListPath } from '../util/term-navigation';

export function TermStatusBadge({ status }: { status: TermDisplayStatus }) {
  return <Badge variant={status === '예정' ? 'info' : status === '현행' ? 'success' : 'default'}>{status}</Badge>;
}
export function TermBreadcrumb({ title, kind }: { title: string; kind: TermKind }) {
  return (
    <Breadcrumb>
      <BreadcrumbList>
        <BreadcrumbItem>서비스 운영</BreadcrumbItem>
        <BreadcrumbSeparator />
        <BreadcrumbItem>
          <BreadcrumbLink asChild>
            <Link to={termListPath(kind)}>이용약관</Link>
          </BreadcrumbLink>
        </BreadcrumbItem>
        <BreadcrumbSeparator />
        <BreadcrumbItem>
          <BreadcrumbPage>{title}</BreadcrumbPage>
        </BreadcrumbItem>
      </BreadcrumbList>
    </Breadcrumb>
  );
}
