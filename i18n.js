(function () {
  const LANG_STORAGE_KEY = "learnsphere_lang";
  const DEFAULT_LANG = "en";

  const cache = new Map(); // lang -> json

  function getStoredLang() {
    try {
      return localStorage.getItem(LANG_STORAGE_KEY) || DEFAULT_LANG;
    } catch {
      return DEFAULT_LANG;
    }
  }

  function setStoredLang(lang) {
    try {
      localStorage.setItem(LANG_STORAGE_KEY, lang);
    } catch {}
  }

  function deepGet(obj, path) {

    if (!obj) return undefined;
    const parts = path.split(".");
    let cur = obj;
    for (const p of parts) {
      if (!cur || typeof cur !== "object" || !(p in cur)) return undefined;
      cur = cur[p];
    }
    return cur;
  }

  function interpolate(template, params) {
    if (typeof template !== "string") return template;
    if (!params) return template;
    return template.replace(/\{\s*([a-zA-Z0-9_]+)\s*\}/g, (m, k) => {
      const val = params[k];
      return val === undefined || val === null ? m : String(val);
    });
  }

  async function loadLang(lang) {
    if (cache.has(lang)) return cache.get(lang);

    const res = await fetch(`./locales/${lang}.json`, { cache: "no-store" });
    if (!res.ok) throw new Error(`Failed to load locales/${lang}.json`);
    const json = await res.json();

    cache.set(lang, json);
    return json;
  }

  let currentLang = getStoredLang();
  let currentDict = null;

  async function initI18n() {
    // Load current language; fall back to en.
    try {
      currentDict = await loadLang(currentLang);
    } catch {
      currentLang = DEFAULT_LANG;
      setStoredLang(currentLang);
      currentDict = await loadLang(currentLang);
    }
  }

  function t(key, params) {

    if (!currentDict) return key;
    const val = deepGet(currentDict, key);
    if (val === undefined) {
      // Fail soft: return key so missing translations are obvious.
      return key;
    }

    return interpolate(val, params);
  }

  async function setLanguage(lang) {
    const normalized = (lang || DEFAULT_LANG).toString();
    currentLang = normalized;
    setStoredLang(currentLang);
    await initI18n();

    document.dispatchEvent(new CustomEvent("i18n:languageChanged", { detail: { lang: currentLang } }));
  }

  // Expose globally
  window.i18n = {
    getLanguage: () => currentLang,
    setLanguage,
    t,
    init: initI18n
  };

  // Auto-init
  // Consumers can await window.i18n.init if needed.
  window.i18n.init();
})();

