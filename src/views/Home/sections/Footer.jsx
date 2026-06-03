import { useI18n } from '../../../i18n'
import './Footer.css'

const Footer = () => {
  const { t } = useI18n()
  const { footer } = t

  return (
    <footer className="footer">
      <div className="section-inner footer-inner">
        <div className="footer-brand">
          <div className="logo">
            <span className="logo-icon">✦</span>
            <span className="logo-text">Sprayz</span>
          </div>
          <p className="footer-tagline">
            {footer.tagline.split('\n').map((line, i) => (
              <span key={i}>{line}{i === 0 && <br />}</span>
            ))}
          </p>
        </div>

        <div className="footer-links">
          {Object.entries(footer.links).map(([group, items]) => (
            <div key={group} className="footer-col">
              <h4 className="footer-col-title">{group}</h4>
              <ul>
                {items.map(item => (
                  <li key={item}><a href="#">{item}</a></li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      <div className="footer-bottom">
        <div className="section-inner footer-bottom-inner">
          <span>{footer.copyright}</span>
          <span>{footer.made}</span>
        </div>
      </div>
    </footer>
  )
}

export default Footer
