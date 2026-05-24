'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';

type Lang = 'en' | 'hi';

// Minimal translations covering nav + main verbs. Anything not in `hi` falls
// back to English — pragmatic for an early i18n pass.
const STRINGS: Record<Lang, Record<string, string>> = {
  en: {
    'nav.dashboard': 'Dashboard',
    'nav.checkIn': 'Check-In',
    'nav.visitors': 'Visitors',
    'nav.contractors': 'Contractors',
    'nav.workers': 'Workers',
    'nav.shifts': 'Shifts',
    'nav.parking': 'Parking',
    'nav.vehicles': 'Vehicles',
    'nav.materials': 'Materials',
    'nav.approvals': 'Approvals',
    'nav.reports': 'Reports',
    'nav.audit': 'Audit',
    'nav.help': 'Help',
    'nav.settings': 'Settings',
    'nav.logout': 'Logout',
    'lang.label': 'Language',
  },
  hi: {
    'nav.dashboard': 'डैशबोर्ड',
    'nav.checkIn': 'चेक-इन',
    'nav.visitors': 'आगंतुक',
    'nav.contractors': 'ठेकेदार',
    'nav.workers': 'कर्मचारी',
    'nav.shifts': 'पाली',
    'nav.parking': 'पार्किंग',
    'nav.vehicles': 'वाहन',
    'nav.materials': 'सामग्री',
    'nav.approvals': 'अनुमोदन',
    'nav.reports': 'रिपोर्ट',
    'nav.audit': 'ऑडिट',
    'nav.help': 'सहायता',
    'nav.settings': 'सेटिंग्स',
    'nav.logout': 'लॉग आउट',
    'lang.label': 'भाषा',
  },
};

interface Ctx {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: string) => string;
}

const I18nCtx = createContext<Ctx | undefined>(undefined);
const STORAGE_KEY = 'vms_lang';

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>('en');

  useEffect(() => {
    const saved = typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null;
    if (saved === 'en' || saved === 'hi') setLangState(saved);
  }, []);

  function setLang(l: Lang) {
    setLangState(l);
    if (typeof window !== 'undefined') localStorage.setItem(STORAGE_KEY, l);
  }

  function t(key: string): string {
    return STRINGS[lang][key] ?? STRINGS.en[key] ?? key;
  }

  return (
    <I18nCtx.Provider value={{ lang, setLang, t }}>{children}</I18nCtx.Provider>
  );
}

export function useI18n(): Ctx {
  const ctx = useContext(I18nCtx);
  if (!ctx) throw new Error('useI18n must be used within I18nProvider');
  return ctx;
}
