import { useRef } from 'react'
import useThreeScene from '../../../hooks/useThreeScene'
import { useI18n } from '../../../i18n'
import './Hero.css'

const Hero = ({ onEnterScene }) => {
  const { t } = useI18n()
  const { hero } = t
  const bgRef = useRef(null)
  useThreeScene(bgRef, true)

  return (
    <section className="hero" id="hero">
      <div ref={bgRef} className="hero-bg" />
      <div className="hero-overlay" />

      <div className="section-inner hero-content">
        <div className="hero-badge">
          <span className="badge-dot" />
          {hero.badge}
        </div>

        <h1 className="hero-title">
          {hero.titleLine1}<br />
          <span className="gradient-text">{hero.titleLine2}</span><br />
          {hero.titleLine3}
        </h1>

        <p className="hero-desc">{hero.desc}</p>

        <div className="hero-actions">
          <a href="#" className="btn-cta" onClick={(e) => { e.preventDefault(); onEnterScene?.() }}>{hero.cta}</a>
          <a href="#community" className="btn-watch">
            <span className="play-icon">▶</span>
            {hero.watch}
          </a>
        </div>

        <div className="hero-stats">
          {hero.stats.map(({ value, label }) => (
            <div key={label} className="stat-item">
              <span className="stat-value">{value}</span>
              <span className="stat-label">{label}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="hero-fade-bottom" />
    </section>
  )
}

export default Hero
