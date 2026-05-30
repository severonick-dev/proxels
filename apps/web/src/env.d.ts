/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL?: string;
  readonly VITE_WEB_PORT?: string;
  readonly VITE_YANDEX_METRIKA_ID?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
