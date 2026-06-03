import { useState, useEffect } from 'react'
import { useI18n } from '../../../i18n'
import LangToggle from './LangToggle'
import './Header.css'

const Header = () => {
  const { t } = useI18n()
  const [scrolled, setScrolled] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)

  const NAV_LINKS = [
    { label: t.nav.explore, href: '#features' },
    { label: t.nav.community, href: '#community' },
    { label: t.nav.gallery, href: '#gallery' },
    { label: t.nav.about, href: '#about' },
  ]

  useEffect(() => {
    const el = document.querySelector('.home')
    if (!el) return
    const onScroll = () => setScrolled(el.scrollTop > 40)
    el.addEventListener('scroll', onScroll)
    return () => el.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <header className={`header ${scrolled ? 'header--scrolled' : ''}`}>
      <div className="header-inner">
        <a href="#" className="logo">
          <span className="logo-icon">✦</span>
          <span className="logo-text">Sprayz</span>
        </a>

        <nav className="nav-desktop">
          {NAV_LINKS.map(({ label, href }) => (
            <a key={label} href={href} className="nav-link">{label}</a>
          ))}
        </nav>

        <div className="header-actions">
          <LangToggle />
          <a href="#" className="btn-ghost">{t.nav.signIn}</a>
          <a href="#" className="btn-primary">{t.nav.joinFree}</a>
        </div>

        <button
          className={`hamburger ${menuOpen ? 'open' : ''}`}
          onClick={() => setMenuOpen(v => !v)}
          aria-label="Toggle menu"
        >
          <span /><span /><span />
        </button>
      </div>

      {menuOpen && (
        <nav className="nav-mobile">
          {NAV_LINKS.map(({ label, href }) => (
            <a key={label} href={href} className="nav-mobile-link" onClick={() => setMenuOpen(false)}>
              {label}
            </a>
          ))}
          <div className="nav-mobile-actions">
            <LangToggle />
            <a href="#" className="btn-ghost w-full">{t.nav.signIn}</a>
            <a href="#" className="btn-primary w-full">{t.nav.joinFree}</a>
          </div>
        </nav>
      )}
    </header>
  )
}

export default Header
