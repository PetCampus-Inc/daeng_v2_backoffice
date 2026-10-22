import { createBrowserRouter, redirect } from 'react-router';

import RootLayout from './RootLayout.tsx';
import AppLayout, { type AppRouteHandle } from './routes/app/route.tsx';
import HistoryRoute from './routes/history/route.tsx';
import HomeRoute from './routes/home/route.tsx';
import IdeasRoute from './routes/ideas/route.tsx';
import InquiriesRoute from './routes/inquiries/route.tsx';
import KindergartensRoute from './routes/kindergartens/route.tsx';
import LoginRoute from './routes/login/route.tsx';
import MembersRoute from './routes/members/route.tsx';
import NotFoundRoute from './routes/not-found/route.tsx';
import NoticesRoute from './routes/notices/route.tsx';
import OwnerVerificationsRoute from './routes/owner-verifications/route.tsx';
import TeamMembersRoute from './routes/settings/members/route.tsx';
import TermsRoute from './routes/terms/route.tsx';
import { PAGES, type PageInfo } from './util/page.ts';

/** 메뉴 화면의 handle. AppLayout이 이 page로 역할을 검사한다. */
function pageHandle(page: PageInfo): AppRouteHandle {
  return { page };
}

export const router = createBrowserRouter([
  {
    Component: RootLayout,
    children: [
      { path: '/login', Component: LoginRoute },
      {
        Component: AppLayout,
        children: [
          { index: true, loader: () => redirect(PAGES.home.path) },
          { path: PAGES.home.path, Component: HomeRoute, handle: pageHandle(PAGES.home) },
          { path: PAGES.members.path, Component: MembersRoute, handle: pageHandle(PAGES.members) },
          { path: PAGES.kindergartens.path, Component: KindergartensRoute, handle: pageHandle(PAGES.kindergartens) },
          {
            path: PAGES.ownerVerifications.path,
            Component: OwnerVerificationsRoute,
            handle: pageHandle(PAGES.ownerVerifications),
          },
          { path: PAGES.inquiries.path, Component: InquiriesRoute, handle: pageHandle(PAGES.inquiries) },
          { path: PAGES.ideas.path, Component: IdeasRoute, handle: pageHandle(PAGES.ideas) },
          { path: PAGES.notices.path, Component: NoticesRoute, handle: pageHandle(PAGES.notices) },
          { path: PAGES.terms.path, Component: TermsRoute, handle: pageHandle(PAGES.terms) },
          { path: PAGES.history.path, Component: HistoryRoute, handle: pageHandle(PAGES.history) },
          { path: PAGES.teamMembers.path, Component: TeamMembersRoute, handle: pageHandle(PAGES.teamMembers) },
          { path: '*', Component: NotFoundRoute },
        ],
      },
    ],
  },
]);
