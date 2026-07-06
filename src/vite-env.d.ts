/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_MARKET_API_KEY?: string;
  readonly VITE_GITHUB_REPO?: string;
  readonly VITE_GITHUB_DISPATCH_TOKEN?: string;
  readonly VITE_GITHUB_REF?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
