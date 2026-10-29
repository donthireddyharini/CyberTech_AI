import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { translations, SupportedLanguage, SUPPORTED_LANGUAGES, LanguageOption } from './translations';

interface I18nContextType {
  language: SupportedLanguage;
  setLanguage: (lang: SupportedLanguage) => void;
  t: (key: string, defaultText?: string) => string;
  languages: LanguageOption[];
}

const I18nContext = createContext<I18nContextType>({
  language: 'en',
  setLanguage: () => {},
  t: (key, defaultText) => defaultText || key,
  languages: SUPPORTED_LANGUAGES,
});

export const I18nProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<SupportedLanguage>('en');

  const setLanguage = useCallback((lang: SupportedLanguage) => {
    if (translations[lang]) {
      setLanguageState(lang);
    }
  }, []);

  const t = useCallback(
    (key: string, defaultText?: string): string => {
      const currentLangDict = translations[language];
      if (currentLangDict && currentLangDict[key]) {
        return currentLangDict[key];
      }
      // Fallback to English
      const enDict = translations.en;
      if (enDict && enDict[key]) {
        return enDict[key];
      }
      return defaultText !== undefined ? defaultText : key;
    },
    [language]
  );

  useEffect(() => {
    try {
      localStorage.removeItem('sentinel_lang');
    } catch {}
    document.documentElement.lang = 'en';
  }, []);

  return (
    <I18nContext.Provider value={{ language, setLanguage, t, languages: SUPPORTED_LANGUAGES }}>
      {children}
    </I18nContext.Provider>
  );
};

export const useTranslation = () => useContext(I18nContext);
