// These absolute URLs are imported inside page.evaluate in the Vite-served browser.
declare module '*__virtual:msw' {
  export const network: import('msw/browser').SetupWorker;
}
declare module '*/.vite/deps/msw.js' {
  export const http: typeof import('msw').http;
}
