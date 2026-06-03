import { useI18n } from '../../../i18n'
import './CallToAction.css'

const CallToAction = () => {
  const { t } = useI18n()
  const { cta } = t

  return (
    <section className="cta" id="about">
      <div className="section-inner cta-inner">
        <div className="cta-glow" />
        <p className="section-eyebrow">{cta.eyebrow}</p>
        <h2 className="cta-title">{cta.title}</h2>
        <p className="cta-desc">{cta.desc}</p>
        <div className="cta-actions">
          <a href="#" className="btn-cta">{cta.primary}</a>
          <a href="#" className="btn-ghost">{cta.secondary}</a>
        </div>
        <p className="cta-note">{cta.note}</p>
      </div>
    </section>
  )
}

export default CallToAction
