import { useRef, useState, useCallback, useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { useStreetScene } from '../../hooks/useStreetScene'
import { useRoamingRecorder } from '../../hooks/useRoamingRecorder'
import { useI18n } from '../../i18n'
import GraffitiCanvas from './GraffitiCanvas'
import SettingsPanel from './SettingsPanel'
import { loadDistrict, getWorldBounds } from '../../data/districtLoader'
import './Scene.css'

const MAP_W = 150

const MiniMap = ({ stateRef, buildingDefs, worldBounds }) => {
  const canvasRef = useRef(null)
  const mapH = worldBounds
    ? Math.round(MAP_W * (worldBounds.maxZ - worldBounds.minZ) / (worldBounds.maxX - worldBounds.minX))
    : MAP_W

  const worldToMap = useCallback((wx, wz) => {
    if (!worldBounds) return { mx: 0, my: 0 }
    return {
      mx: Math.round((wx - worldBounds.minX) / (worldBounds.maxX - worldBounds.minX) * MAP_W),
      my: Math.round((wz - worldBounds.minZ) / (worldBounds.maxZ - worldBounds.minZ) * mapH),
    }
  }, [worldBounds, mapH])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !buildingDefs || !worldBounds) return
    const ctx = canvas.getContext('2d')
    let rafId

    const draw = () => {
      rafId = requestAnimationFrame(draw)
      ctx.clearRect(0, 0, MAP_W, mapH)

      // 背景
      ctx.fillStyle = 'rgba(8, 10, 20, 0.82)'
      ctx.fillRect(0, 0, MAP_W, mapH)

      // 建筑块
      ctx.fillStyle = 'rgba(80, 90, 130, 0.75)'
      buildingDefs.forEach(({ x, z, w, d }) => {
        const tl = worldToMap(x - w / 2, z - d / 2)
        const br = worldToMap(x + w / 2, z + d / 2)
        ctx.fillRect(tl.mx, tl.my, br.mx - tl.mx, br.my - tl.my)
      })

      // 玩家位置
      const s = stateRef.current
      if (!s) return
      const src = s.viewMode === 'fps' ? s.camera : s.playerMesh
      if (!src) return
      const { mx, my } = worldToMap(src.position.x, src.position.z)

      // 朝向箭头（FPS 用相机 yaw，TPS 用 tpsYaw）
      let yaw = 0
      if (s.viewMode === 'fps' && s.camera) {
        const dir = new THREE.Vector3()
        s.camera.getWorldDirection(dir)
        yaw = Math.atan2(dir.x, -dir.z)
      } else {
        yaw = -(s.tpsYaw ?? 0)
      }

      ctx.save()
      ctx.translate(mx, my)
      ctx.rotate(yaw)
      ctx.fillStyle = '#f87171'
      ctx.beginPath()
      ctx.moveTo(0, -6)
      ctx.lineTo(4, 4)
      ctx.lineTo(0, 2)
      ctx.lineTo(-4, 4)
      ctx.closePath()
      ctx.fill()
      ctx.restore()

      // 边框
      ctx.strokeStyle = 'rgba(99, 102, 241, 0.6)'
      ctx.lineWidth = 1
      ctx.strokeRect(0.5, 0.5, MAP_W - 1, mapH - 1)
    }

    draw()
    return () => cancelAnimationFrame(rafId)
  }, [stateRef, buildingDefs, worldBounds, worldToMap, mapH])

  return (
    <div className="minimap-wrap">
      <div className="minimap-label">MINIMAP</div>
      <canvas ref={canvasRef} width={MAP_W} height={mapH} className="minimap-canvas" />
    </div>
  )
}

const LoadingOverlay = ({ ready, onEnter }) => {
  const { t } = useI18n()
  const tl = t.scene.loading
  const steps = tl.steps

  const [step, setStep] = useState(0)
  const [progress, setProgress] = useState(0)
  const [entered, setEntered] = useState(false)

  useEffect(() => {
    if (ready) {
      setStep(steps.length - 1)
      setProgress(100)
      return
    }
    const totalMs = 2200
    const stepMs = totalMs / (steps.length - 1)
    let cur = 0
    const iv = setInterval(() => {
      cur++
      if (cur >= steps.length - 1) { clearInterval(iv); return }
      setStep(cur)
      setProgress(Math.round((cur / (steps.length - 1)) * 90))
    }, stepMs)
    return () => clearInterval(iv)
  }, [ready, steps])

  const handleEnter = () => {
    setEntered(true)
    onEnter()
  }

  return (
    <div className={`scene-loading-overlay${entered ? ' scene-loading-exit' : ''}`}>
      <div className="scene-loading-card">
        <div className="scene-loading-title">SPRAYZ</div>
        <div className="scene-loading-subtitle">{tl.subtitle}</div>

        <div className="scene-loading-bar-wrap">
          <div className="scene-loading-bar" style={{ width: `${progress}%` }} />
        </div>
        <div className="scene-loading-percent">{progress}%</div>
        <div className="scene-loading-step">{steps[step]}</div>

        {ready && (
          <button className="scene-loading-enter" onClick={handleEnter}>
            {tl.enter}
          </button>
        )}
      </div>
    </div>
  )
}

const Scene = ({ onBack }) => {
  const containerRef = useRef(null)
  const [paintMode, setPaintMode] = useState(false)
  const [wallInfo, setWallInfo] = useState(null)
  const [viewMode, setViewMode] = useState('fps')
  const [locked, setLocked] = useState(false)
  const [nearWall, setNearWall] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [sceneReady, setSceneReady] = useState(false)
  const [entered, setEntered] = useState(false)

  // 街区数据（从 URL ?district= 加载）
  const [districtData, setDistrictData] = useState(null)
  const [districtError, setDistrictError] = useState(null)
  useEffect(() => {
    loadDistrict()
      .then(setDistrictData)
      .catch(err => setDistrictError(err.message))
  }, [])

  const districtSpawnPoint = districtData?.spawnPoint ?? null

  // 以 spawnPoint 为中心 200×200m 的局部视野
  const VIEW_RANGE = 100
  const localBuildings = useMemo(() => {
    const all = districtData?.buildings
    if (!all || !districtSpawnPoint) return all ?? null
    const { x: ox, z: oz } = districtSpawnPoint
    // 建筑包围盒与视野范围有任意重叠即纳入
    return all.filter(b =>
      b.cx + b.w / 2 >= ox - VIEW_RANGE && b.cx - b.w / 2 <= ox + VIEW_RANGE &&
      b.cz + b.d / 2 >= oz - VIEW_RANGE && b.cz - b.d / 2 <= oz + VIEW_RANGE
    )
  }, [districtData, districtSpawnPoint])

  const localRoads = useMemo(() => {
    const all = districtData?.roads
    if (!all || !districtSpawnPoint) return all ?? null
    const { x: ox, z: oz } = districtSpawnPoint
    return all.filter(r => r.points?.some(([px, pz]) =>
      px >= ox - VIEW_RANGE && px <= ox + VIEW_RANGE &&
      pz >= oz - VIEW_RANGE && pz <= oz + VIEW_RANGE
    ))
  }, [districtData, districtSpawnPoint])

  // 小地图 bounds：局部 100×100 区域
  const localWorldBounds = districtSpawnPoint ? {
    minX: districtSpawnPoint.x - VIEW_RANGE,
    maxX: districtSpawnPoint.x + VIEW_RANGE,
    minZ: districtSpawnPoint.z - VIEW_RANGE,
    maxZ: districtSpawnPoint.z + VIEW_RANGE,
  } : null

  const localBuildingDefs = localBuildings?.map(b => ({ x: b.cx, z: b.cz, w: b.w, d: b.d })) ?? null

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

  const handleReady = useCallback(() => setSceneReady(true), [])

  const { t } = useI18n()
  const ts = t.scene.hud

  const { resumeScene, stateRef } = useStreetScene(containerRef, {
    onWallSelect: handleWallSelect,
    onViewModeChange: setViewMode,
    onLockChange: handleLockChange,
    onStartRoaming: useCallback(() => handleStartRoamingRef.current?.(), []),
    onReady: handleReady,
    buildings: localBuildings,
    roads: localRoads,
    spawnPoint: districtSpawnPoint,
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
      s.isSwitchingView = true
      s.controls?.unlock()
      s.playerMesh.position.set(s.camera.position.x, 0, s.camera.position.z)
      s.tpsYaw = Math.PI
    }
    setViewMode(next)
    setLocked(next === 'tps')
  }, [stateRef])

  const handleEnterScene = useCallback(() => {
    setEntered(true)
    stateRef.current?.controls?.lock()
  }, [stateRef])

  return (
    <div className="scene-root">
      <div ref={containerRef} className="scene-canvas-container" />

      {/* 加载 / 进入遮罩 */}
      {!entered && (
        <LoadingOverlay ready={sceneReady} onEnter={handleEnterScene} />
      )}

      {!paintMode && entered && (
        <>
          {/* 准星（漫游中隐藏） */}
          {!roaming && <div className="crosshair">＋</div>}

          {/* 左下角操作说明 */}
          <div className="hud-hints">
            <span><kbd>WASD</kbd> {ts.move}</span>
            {viewMode === 'fps'
              ? <span><kbd>Mouse</kbd> {ts.lookMouse}</span>
              : <span><kbd>Drag</kbd> {ts.lookDrag}</span>
            }
            <span><kbd>E</kbd> {ts.paint}</span>
            <span><kbd>V</kbd> {viewMode === 'fps' ? ts.switchTps : ts.switchFps}</span>
            <span><kbd>Esc</kbd> {ts.openSettings}</span>
          </div>

          {/* 靠近墙面时提示 */}
          {nearWall && !roaming && (
            <div className="wall-hint">{ts.paintHint}</div>
          )}

          {/* 漫游中进度提示 */}
          {roaming && (
            <div className="roam-overlay-hint">{ts.roaming.replace('{p}', roamProgress)}</div>
          )}

          {/* 右下角小地图 */}
          <MiniMap stateRef={stateRef} buildingDefs={localBuildingDefs} worldBounds={localWorldBounds} />

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
        onResume={resumeScene}
        onBack={onBack}
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
