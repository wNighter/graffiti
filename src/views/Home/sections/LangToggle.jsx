import { useI18n } from '../../../i18n'
import './LangToggle.css'

const LangToggle = () => {
  const { lang, toggle } = useI18n()
  return (
    <button className="lang-toggle" onClick={toggle} aria-label="Switch language">
      <span className={lang === 'en' ? 'active' : ''}>EN</span>
      <span className="divider" />
      <span className={lang === 'zh' ? 'active' : ''}>中</span>
    </button>
  )
}

export default LangToggle
