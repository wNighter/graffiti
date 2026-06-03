import { createContext, useContext, useState } from 'react'
import en from './locales/en'
import zh from './locales/zh'

const LOCALES = { en, zh }

const I18nContext = createContext(null)

export const I18nProvider = ({ children }) => {
  const [lang, setLang] = useState(() => {
    return localStorage.getItem('sprayz_lang') || 'en'
  })

  const toggle = () => {
    const next = lang === 'en' ? 'zh' : 'en'
    localStorage.setItem('sprayz_lang', next)
    setLang(next)
  }

  return (
    <I18nContext.Provider value={{ lang, toggle, t: LOCALES[lang] }}>
      {children}
    </I18nContext.Provider>
  )
}

export const useI18n = () => useContext(I18nContext)
