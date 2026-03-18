// ── i18n context hook
'use client';
import React, { createContext, useContext, useEffect, useState } from 'react';
import ru from './ru';
import en from './en';
import type { Translations } from './ru';

type Lang = 'ru' | 'en';
const translations: Record<Lang, Translations> = { ru, en };

interface I18nContextType {
  lang: Lang;
  t: Translations;
  setLang: (l: Lang) => void;
}

const I18nContext = createContext<I18nContextType>({
  lang: 'ru', t: ru, setLang: () => {},
});

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>('ru');

  useEffect(() => {
    const saved = localStorage.getItem('ch_lang') as Lang;
    if (saved && (saved === 'ru' || saved === 'en')) setLangState(saved);
  }, []);

  function setLang(l: Lang) {
    setLangState(l);
    localStorage.setItem('ch_lang', l);
    fetch('/api/settings/language', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('ch_access')}` },
      body: JSON.stringify({ language: l }),
    }).catch(() => {});
  }

  return (
    <I18nContext.Provider value={{ lang, t: translations[lang], setLang }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() { return useContext(I18nContext); }
