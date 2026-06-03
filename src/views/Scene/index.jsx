import { useRef, useState, useCallback, useEffect } from 'react'
import { useStreetScene } from '../../hooks/useStreetScene'
import { useRoamingRecorder } from '../../hooks/useRoamingRecorder'
import GraffitiCanvas from './GraffitiCanvas'
import SettingsPanel from './SettingsPanel'
import './Scene.css'

const Scene = ({ onBack }) => {
  const containerRef = useRef(null)
  const [paintMode, setPaintMode] = useState(false)
  const [wallInfo, setWallInfo] = useState(null)
  const [viewMode, setViewMode] = useState('fps')
  const [locked, setLocked] = useState(false)
  const [nearWall, setNearWall] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)

  // 漫游录制状态
  const [roaming, setRoaming] = useState(false)
  const [roamProgress, setRoamProgress] = useState(0)
  const [videoUrl, setVideoUrl] = useState(null)

  const { startRoaming, stopRoaming } = useRoamingRecorder()
  const handleStartRoamingRef = useRef(null)

  const handleWallSelect = useCallback((info) => {
    setWallInfo(info)
    setPaintMode(true)
  }, [])

  // ESC / unlock 时打开设置面板
  const handleLockChange = useCallback((isLocked) => {
    setLocked(isLocked)
    if (!isLocked) setSettingsOpen(true)
  }, [])

  const { resumeScene, stateRef } = useStreetScene(containerRef, {
    onWallSelect: handleWallSelect,
    onViewModeChange: setViewMode,
    onLockChange: handleLockChange,
    onStartRoaming: useCallback(() => handleStartRoamingRef.current?.(), []),
  })

  // 检测是否靠近墙面
  useEffect(() => {
    if (paintMode) return
    const id = setInterval(() => {
      setNearWall(!!stateRef.current?.highlightedInfo)
    }, 120)
    return () => clearInterval(id)
  }, [paintMode, stateRef])

  const handleSave = useCallback(() => {
    setPaintMode(false)
    setWallInfo(null)
    resumeScene()
  }, [resumeScene])

  const handleDiscard = useCallback(() => {
    setPaintMode(false)
    setWallInfo(null)
    resumeScene()
  }, [resumeScene])

  const handleStartRoaming = useCallback(() => {
    if (paintMode) { setPaintMode(false); setWallInfo(null); resumeScene() }
    setVideoUrl(null)
    setRoaming(true)
    setRoamProgress(0)
    startRoaming(
      stateRef,
      (p) => setRoamProgress(p),
      (url) => { setRoaming(false); setVideoUrl(url) }
    )
  }, [paintMode, resumeScene, startRoaming, stateRef])
  handleStartRoamingRef.current = handleStartRoaming

  const handleStopRoaming = useCallback(() => {
    stopRoaming(stateRef)
    setRoaming(false)
  }, [stopRoaming, stateRef])

  const handleCloseSettings = useCallback(() => {
    setSettingsOpen(false)
  }, [])

  const toggleView = useCallback(() => {
    const s = stateRef.current
    if (!s) return
    const next = s.viewMode === 'fps' ? 'tps' : 'fps'
    s.viewMode = next
    s.playerMesh.visible = next === 'tps'
    if (next === 'fps') {
      s.camera.position.set(s.playerMesh.position.x, 1.7, s.playerMesh.position.z)
      s.controls?.lock()
    } else {
      s.controls?.unlock()
      s.playerMesh.position.set(s.camera.position.x, 0, s.camera.position.z)
      s.tpsYaw = Math.PI
    }
    setViewMode(next)
    setLocked(next === 'tps')
  }, [stateRef])

  return (
    <div className="scene-root">
      <div ref={containerRef} className="scene-canvas-container" />

      {!paintMode && (
        <>
          {/* 准星（漫游中隐藏） */}
          {!roaming && <div className="crosshair">＋</div>}

          {/* 左下角操作说明 */}
          <div className="hud-hints">
            <span><kbd>WASD</kbd> 移动</span>
            {viewMode === 'fps'
              ? <span><kbd>鼠标</kbd> 控制视角</span>
              : <span><kbd>左键拖拽</kbd> 旋转视角</span>
            }
            <span><kbd>E</kbd> 绘制墙面</span>
            <span><kbd>V</kbd> 切换视角</span>
            <span><kbd>Esc</kbd> 打开设置</span>
          </div>

          {/* 靠近墙面时提示 */}
          {nearWall && !roaming && (
            <div className="wall-hint">
              🎨 按 <kbd>E</kbd> 开始绘制
            </div>
          )}

          {/* 视角切换按钮（漫游中隐藏） */}
          {!roaming && (
            <button className="view-mode-btn" onClick={toggleView} title="切换第一/第三人称 (V)">
              {viewMode === 'fps' ? '👁️ 第一人称' : '🎮 第三人称'}
            </button>
          )}

          {/* 漫游中进度提示 */}
          {roaming && (
            <div className="roam-overlay-hint">🚶 自动漫游录制中 {roamProgress}%，请勿操作…</div>
          )}

          {/* 返回 */}
          <button className="back-btn" onClick={onBack}>← 返回</button>

          {/* FPS 未锁定 且 设置面板未打开 时的引导遮罩 */}
          {viewMode === 'fps' && !locked && !settingsOpen && !roaming && (
            <div className="start-overlay" onClick={() => stateRef.current?.controls?.lock()}>
              <div className="start-card">
                <div className="start-icon">🎮</div>
                <div className="start-title">点击进入街区</div>
                <div className="start-desc">WASD 移动 · 鼠标控制视角<br />靠近围墙、建筑或道具按 E 涂鸦</div>
                <div className="start-hint">按 Esc 打开设置面板</div>
              </div>
            </div>
          )}
        </>
      )}

      {/* 绘画模式 */}
      {paintMode && wallInfo && (
        <GraffitiCanvas
          wallInfo={wallInfo}
          onSave={handleSave}
          onDiscard={handleDiscard}
        />
      )}

      {/* 设置面板 */}
      <SettingsPanel
        open={settingsOpen}
        onClose={handleCloseSettings}
        roaming={roaming}
        roamProgress={roamProgress}
        videoUrl={videoUrl}
        onStartRoaming={() => { handleCloseSettings(); handleStartRoaming() }}
        onStopRoaming={handleStopRoaming}
        onClearVideo={() => { URL.revokeObjectURL(videoUrl); setVideoUrl(null) }}
      />
    </div>
  )
}

export default Scene
