import { useI18n } from '../../../i18n'
import './Features.css'

const Features = () => {
  const { t } = useI18n()
  const { features } = t

  return (
    <section className="features" id="features">
      <div className="section-inner">
        <div className="section-header">
          <p className="section-eyebrow">{features.eyebrow}</p>
          <h2 className="section-title">
            {features.title.split('\n').map((line, i) => (
              <span key={i}>{line}{i === 0 && <br />}</span>
            ))}
          </h2>
        </div>

        <div className="features-grid">
          {features.items.map(({ icon, title, desc }) => (
            <div key={title} className="feature-card">
              <div className="feature-icon">{icon}</div>
              <h3 className="feature-title">{title}</h3>
              <p className="feature-desc">{desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

export default Features
