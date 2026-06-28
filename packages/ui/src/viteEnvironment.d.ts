/// <reference types="vite/client" />

interface ImportMetaEnvironment {
  readonly VITE_API_BASE_URL?: string;
  readonly VITE_API_PORT?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnvironment;
}
