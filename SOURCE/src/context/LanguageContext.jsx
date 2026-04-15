import { createContext, useContext, useState, useEffect } from 'react';
import { translations } from '../data/translations';

const LanguageContext = createContext();

export function LanguageProvider({ children }) {
  const [language, setLanguage] = useState(() => {
    return localStorage.getItem('goldrush-language') || 'az';
  });

  useEffect(() => {
    localStorage.setItem('goldrush-language', language);
    document.documentElement.lang = language;
  }, [language]);

  const toggleLanguage = () => {
    setLanguage(prev => prev === 'az' ? 'en' : 'az');
  };

  const t = (path) => {
    const keys = path.split('.');
    let value = translations[language];
    for (const key of keys) {
      value = value[key];
    }
    return value;
  };

  return (
    <LanguageContext.Provider value={{ language, toggleLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  return useContext(LanguageContext);
}
