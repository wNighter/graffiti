import { useRef, useCallback } from 'react'
import { ROAMING_PATH, ROAM_DURATION } from '../data/roamingPath'

// 若相机落入建筑内，沿最短轴推出到边界外
const pushOutOfBuildings = ([x, y, z], boxes) => {
  let cx = x, cz = z
  for (const b of boxes) {
    if (cx > b.minX && cx < b.maxX && cz > b.minZ && cz < b.maxZ) {
      const gaps = [
        { axis: 'x', val: b.minX - 0.01, dist: cx - b.minX },
        { axis: 'x', val: b.maxX + 0.01, dist: b.maxX - cx },
        { axis: 'z', val: b.minZ - 0.01, dist: cz - b.minZ },
        { axis: 'z', val: b.maxZ + 0.01, dist: b.maxZ - cz },
      ]
      const best = gaps.reduce((a, b) => a.dist < b.dist ? a : b)
      if (best.axis === 'x') cx = best.val
      else cz = best.val
    }
  }
  return [cx, y, cz]
}

// 在路径点之间插值（去掉 ease，改为匀速，由外部阻尼负责平滑）
const lerpPath = (path, t) => {
  if (t <= 0) return { pos: path[0].pos, look: path[0].look }
  if (t >= 1) {
    const last = path[path.length - 1]
    return { pos: last.pos, look: last.look }
  }
  let a = path[0], b = path[path.length - 1]
  for (let i = 0; i < path.length - 1; i++) {
    if (t >= path[i].t && t <= path[i + 1].t) {
      a = path[i]; b = path[i + 1]; break
    }
  }
  const span = b.t - a.t
  const local = span === 0 ? 0 : (t - a.t) / span
  const mix = (a, b) => a + (b - a) * local
  return {
    pos:  [mix(a.pos[0],  b.pos[0]),  mix(a.pos[1],  b.pos[1]),  mix(a.pos[2],  b.pos[2])],
    look: [mix(a.look[0], b.look[0]), mix(a.look[1], b.look[1]), mix(a.look[2], b.look[2])],
  }
}

const getSupportedMimeType = () => {
  const types = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm', 'video/mp4']
  return types.find(t => MediaRecorder.isTypeSupported(t)) || ''
}

// 平滑系数：每帧向目标靠近的比例（越小越平滑/越慢）
// 60fps 下 α=0.04 约等于 0.5 秒时间常数
const POS_ALPHA  = 0.035   // 位置阻尼
const LOOK_ALPHA = 0.028   // 朝向阻尼（稍慢，转头更自然）

export const useRoamingRecorder = () => {
  const rafRef = useRef(null)
  const recorderRef = useRef(null)
  const chunksRef = useRef([])
  const startTimeRef = useRef(0)

  const startRoaming = useCallback((stateRef, onProgress, onComplete) => {
    const s = stateRef.current
    if (!s?.renderer || !s?.camera) return

    s.controls?.unlock()
    s.roamingMode = true

    const stream = s.renderer.domElement.captureStream(30)
    const mimeType = getSupportedMimeType()
    const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : {})
    recorderRef.current = recorder
    chunksRef.current = []

    recorder.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data) }
    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: mimeType || 'video/webm' })
      onComplete(URL.createObjectURL(blob))
    }
    recorder.start(100)

    startTimeRef.current = performance.now()

    // 当前平滑后的位置与朝向（从相机初始状态出发）
    const cam = s.camera
    let smoothPos  = [cam.position.x, cam.position.y, cam.position.z]
    // 从相机当前朝向推算初始 lookAt 点（前方 10 单位）
    const fwd = [
      cam.position.x - Math.sin(cam.rotation.y) * 10,
      cam.position.y,
      cam.position.z - Math.cos(cam.rotation.y) * 10,
    ]
    let smoothLook = fwd

    const tick = () => {
      const elapsed = performance.now() - startTimeRef.current
      const t = Math.min(elapsed / ROAM_DURATION, 1)
      onProgress(Math.round(t * 100))

      const { pos, look } = lerpPath(ROAMING_PATH, t)
      const safePos = pushOutOfBuildings(pos, s.buildingBoxes || [])

      // 对位置和朝向分别做指数平滑（低通滤波）
      smoothPos  = smoothPos.map((v, i)  => v + (safePos[i] - v) * POS_ALPHA)
      smoothLook = smoothLook.map((v, i) => v + (look[i]    - v) * LOOK_ALPHA)

      cam.position.set(smoothPos[0], smoothPos[1], smoothPos[2])
      cam.lookAt(smoothLook[0], smoothLook[1], smoothLook[2])

      if (t >= 1) {
        recorder.stop()
        s.roamingMode = false
        return
      }
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
  }, [])

  const stopRoaming = useCallback((stateRef) => {
    cancelAnimationFrame(rafRef.current)
    if (recorderRef.current?.state !== 'inactive') recorderRef.current?.stop()
    const s = stateRef.current
    if (s) s.roamingMode = false
  }, [])

  return { startRoaming, stopRoaming }
}
