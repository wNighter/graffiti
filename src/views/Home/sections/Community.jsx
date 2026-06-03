import { useI18n } from '../../../i18n'
import './Community.css'

const Community = () => {
  const { t } = useI18n()
  const { community } = t

  return (
    <section className="community" id="community">
      <div className="section-inner">
        <div className="section-header">
          <p className="section-eyebrow">{community.eyebrow}</p>
          <h2 className="section-title">{community.title}</h2>
        </div>

        <div className="tag-cloud">
          {community.tags.map(tag => (
            <span key={tag} className="tag">{tag}</span>
          ))}
        </div>

        <div className="testimonials">
          {community.testimonials.map(({ name, handle, avatar, color, text }) => (
            <div key={name} className="testimonial-card">
              <p className="testimonial-text">"{text}"</p>
              <div className="testimonial-author">
                <div className="avatar" style={{ background: color }}>{avatar}</div>
                <div>
                  <div className="author-name">{name}</div>
                  <div className="author-handle">{handle}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

export default Community
