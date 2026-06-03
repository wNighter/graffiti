import { ROAM_DURATION } from '../../data/roamingPath'

const formatDuration = (ms) => `${(ms / 1000).toFixed(0)}秒`

const SettingsPanel = ({
  open,
  onClose,
  roaming,
  roamProgress,
  videoUrl,
  onStartRoaming,
  onStopRoaming,
  onClearVideo,
}) => {
  return (
    <>
      {/* 半透明遮罩 */}
      <div
        className={`settings-backdrop ${open ? 'settings-backdrop--visible' : ''}`}
        onClick={onClose}
      />

      {/* 侧边栏 */}
      <aside className={`settings-panel ${open ? 'settings-panel--open' : ''}`}>
        <div className="settings-header">
          <span className="settings-title">⚙️ 设置</span>
          <button className="settings-close" onClick={onClose} title="关闭 (Esc)">✕</button>
        </div>

        <div className="settings-body">
          {/* ── 漫游视频 ── */}
          <section className="settings-section">
            <div className="settings-section-label">🎬 漫游视频</div>
            <p className="settings-section-desc">
              自动生成第一视角街区漫游视频，时长约 {formatDuration(ROAM_DURATION)}，录制完成后可下载 .webm 文件。
            </p>

            {!roaming && !videoUrl && (
              <button className="settings-action-btn settings-action-btn--primary" onClick={onStartRoaming}>
                开始录制漫游
              </button>
            )}

            {roaming && (
              <div className="settings-roam-recording">
                <div className="settings-roam-row">
                  <span className="settings-roam-label">🔴 录制中… {roamProgress}%</span>
                  <button className="settings-action-btn settings-action-btn--danger" onClick={onStopRoaming}>
                    停止
                  </button>
                </div>
                <div className="settings-progress-bar">
                  <div className="settings-progress-fill" style={{ width: `${roamProgress}%` }} />
                </div>
              </div>
            )}

            {videoUrl && !roaming && (
              <div className="settings-roam-done">
                <span className="settings-roam-done-label">✅ 视频已生成</span>
                <div className="settings-roam-actions">
                  <a className="settings-action-btn settings-action-btn--success" href={videoUrl} download="graffiti-roam.webm">
                    ⬇️ 下载视频
                  </a>
                  <button
                    className="settings-action-btn settings-action-btn--ghost"
                    onClick={onClearVideo}
                  >
                    重新录制
                  </button>
                </div>
              </div>
            )}
          </section>

          {/* ── 占位：未来扩展 ── */}
          <section className="settings-section settings-section--disabled">
            <div className="settings-section-label">🖼️ 画廊导出 <span className="settings-badge">即将推出</span></div>
            <p className="settings-section-desc">将当前所有墙面涂鸦导出为高分辨率图集。</p>
          </section>

          <section className="settings-section settings-section--disabled">
            <div className="settings-section-label">🔊 音效设置 <span className="settings-badge">即将推出</span></div>
            <p className="settings-section-desc">调整环境音效与喷漆音效音量。</p>
          </section>
        </div>

        <div className="settings-footer">
          按 <kbd>Esc</kbd> 或点击空白处关闭，点击场景重新进入游览
        </div>
      </aside>
    </>
  )
}

export default SettingsPanel
