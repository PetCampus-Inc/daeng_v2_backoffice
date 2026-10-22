import { createBrowserRouter, redirect } from 'react-router';

import RootLayout from './root-layout.tsx';
import AppLayout, { type AppRouteHandle } from './routes/app/route.tsx';
import HistoryRoute from './routes/history/route.tsx';
import HomeRoute from './routes/home/route.tsx';
import IdeasRoute from './routes/ideas/route.tsx';
import IdeaDetailRoute from './routes/ideas/detail/route.tsx';
import InquiryDetailRoute from './routes/inquiries/detail/route.tsx';
import InquiriesRoute from './routes/inquiries/route.tsx';
import KindergartensRoute from './routes/kindergartens/route.tsx';
import LoginRoute from './routes/login/route.tsx';
import MembersRoute from './routes/members/route.tsx';
import NotFoundRoute from './routes/not-found/route.tsx';
import NoticesRoute from './routes/notices/route.tsx';
import NoticeDetailRoute, { NoticeEditRoute } from './routes/notices/detail/route.tsx';
import NoticeWriteRoute from './routes/notices/write/route.tsx';
import OwnerVerificationsRoute from './routes/owner-verifications/route.tsx';
import ProfileSetupRoute from './routes/profile-setup/route.tsx';
import TeamMembersRoute from './routes/settings/members/route.tsx';
import TermsRoute from './routes/terms/route.tsx';
import { PAGES, type PageInfo } from './util/page-config.ts';

/** 메뉴 화면의 handle. AppLayout이 이 page로 역할을 검사한다. */
function createPageHandle(page: PageInfo): AppRouteHandle {
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
          { path: '/profile-setup', Component: ProfileSetupRoute },
          { path: PAGES.home.path, Component: HomeRoute, handle: createPageHandle(PAGES.home) },
          { path: PAGES.members.path, Component: MembersRoute, handle: createPageHandle(PAGES.members) },
          {
            path: PAGES.kindergartens.path,
            Component: KindergartensRoute,
            handle: createPageHandle(PAGES.kindergartens),
          },
          {
            path: PAGES.ownerVerifications.path,
            Component: OwnerVerificationsRoute,
            handle: createPageHandle(PAGES.ownerVerifications),
          },
          { path: PAGES.inquiries.path, Component: InquiriesRoute, handle: createPageHandle(PAGES.inquiries) },
          {
            path: `${PAGES.inquiries.path}/:inquiryId`,
            Component: InquiryDetailRoute,
            handle: createPageHandle(PAGES.inquiries),
          },
          { path: PAGES.ideas.path, Component: IdeasRoute, handle: createPageHandle(PAGES.ideas) },
          { path: `${PAGES.ideas.path}/:ideaId`, Component: IdeaDetailRoute, handle: createPageHandle(PAGES.ideas) },
          { path: PAGES.notices.path, Component: NoticesRoute, handle: createPageHandle(PAGES.notices) },
          { path: `${PAGES.notices.path}/new`, Component: NoticeWriteRoute, handle: createPageHandle(PAGES.notices) },
          {
            path: `${PAGES.notices.path}/:noticeId`,
            Component: NoticeDetailRoute,
            handle: createPageHandle(PAGES.notices),
          },
          {
            path: `${PAGES.notices.path}/:noticeId/edit`,
            Component: NoticeEditRoute,
            handle: createPageHandle(PAGES.notices),
          },
          { path: PAGES.terms.path, Component: TermsRoute, handle: createPageHandle(PAGES.terms) },
          { path: PAGES.history.path, Component: HistoryRoute, handle: createPageHandle(PAGES.history) },
          { path: PAGES.teamMembers.path, Component: TeamMembersRoute, handle: createPageHandle(PAGES.teamMembers) },
          { path: '*', Component: NotFoundRoute },
        ],
      },
    ],
  },
]);
