/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_UI_LAB?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
