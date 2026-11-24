import path from "node:path";
import i18next from "i18next";
import FsBackend from "i18next-fs-backend";
import { handle, LanguageDetector } from "i18next-http-middleware";

const localesDir = path.resolve(import.meta.dirname, "../../locales");

await i18next
  .use(FsBackend)
  .use(LanguageDetector)
  .init({
    fallbackLng: "en",
    supportedLngs: ["ar", "en"],
    preload: ["ar", "en"],
    ns: ["translation"],
    defaultNS: "translation",
    backend: { loadPath: path.join(localesDir, "{{lng}}/{{ns}}.json") },
    detection: { order: ["header"], caches: false },
  });

export const i18nMiddleware = handle(i18next);
