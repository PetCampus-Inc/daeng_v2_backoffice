import { createBrowserRouter } from 'react-router';

import App from './App.tsx';
import RootLayout from './RootLayout.tsx';

export const router = createBrowserRouter([
  {
    Component: RootLayout,
    children: [{ index: true, Component: App }],
  },
]);
