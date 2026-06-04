import { useI18n } from '../../i18n'
import { ROAM_DURATION } from '../../data/roamingPath'

const SettingsPanel = ({
  open,
  onClose,
  onResume,
  onBack,
  roaming,
  roamProgress,
  videoUrl,
  onStartRoaming,
  onStopRoaming,
  onClearVideo,
}) => {
  const { t } = useI18n()
  const ts = t.settings
  const durationSec = Math.round(ROAM_DURATION / 1000)

  const handleClose = () => {
    onClose()
    onResume?.()
  }

  return (
    <>
      <div
        className={`settings-backdrop ${open ? 'settings-backdrop--visible' : ''}`}
        onClick={handleClose}
      />

      <aside className={`settings-panel ${open ? 'settings-panel--open' : ''}`}>
        <div className="settings-header">
          <span className="settings-title">{ts.title}</span>
          <button className="settings-close" onClick={handleClose} title={ts.closeTitle}>✕</button>
        </div>

        <div className="settings-body">
          {/* ── 漫游视频 ── */}
          <section className="settings-section">
            <div className="settings-section-label">{ts.roam.label}</div>
            <p className="settings-section-desc">
              {ts.roam.desc.replace('{d}', durationSec)}
            </p>

            {!roaming && !videoUrl && (
              <button className="settings-action-btn settings-action-btn--primary" onClick={onStartRoaming}>
                {ts.roam.start}
              </button>
            )}

            {roaming && (
              <div className="settings-roam-recording">
                <div className="settings-roam-row">
                  <span className="settings-roam-label">{ts.roam.recording.replace('{p}', roamProgress)}</span>
                  <button className="settings-action-btn settings-action-btn--danger" onClick={onStopRoaming}>
                    {ts.roam.stop}
                  </button>
                </div>
                <div className="settings-progress-bar">
                  <div className="settings-progress-fill" style={{ width: `${roamProgress}%` }} />
                </div>
              </div>
            )}

            {videoUrl && !roaming && (
              <div className="settings-roam-done">
                <span className="settings-roam-done-label">{ts.roam.done}</span>
                <div className="settings-roam-actions">
                  <a className="settings-action-btn settings-action-btn--success" href={videoUrl} download="graffiti-roam.webm">
                    {ts.roam.download}
                  </a>
                  <button className="settings-action-btn settings-action-btn--ghost" onClick={onClearVideo}>
                    {ts.roam.reRecord}
                  </button>
                </div>
              </div>
            )}
          </section>

          <section className="settings-section settings-section--disabled">
            <div className="settings-section-label">{ts.gallery.label} <span className="settings-badge">{ts.gallery.soon}</span></div>
            <p className="settings-section-desc">{ts.gallery.desc}</p>
          </section>

          <section className="settings-section settings-section--disabled">
            <div className="settings-section-label">{ts.audio.label} <span className="settings-badge">{ts.audio.soon}</span></div>
            <p className="settings-section-desc">{ts.audio.desc}</p>
          </section>
        </div>

        <div className="settings-footer">
          <button className="settings-back-home-btn" onClick={onBack}>
            {ts.backHome}
          </button>
          {ts.footer}
        </div>
      </aside>
    </>
  )
}

export default SettingsPanel
