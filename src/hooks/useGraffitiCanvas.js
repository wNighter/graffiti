import { useEffect, useRef, useState, useCallback } from 'react'

const MAX_HISTORY = 30

// wallInfo = { mesh, faceIndex, faceInfo: { offscreen, texture, wallW, wallH } }
// panActiveRef: 当正在平移时为 true，阻止绘图
export const useGraffitiCanvas = (canvasRef, wallInfo, panActiveRef) => {
  const [tool, setTool] = useState('brush')
  const [color, setColor] = useState('#ff3399')
  const [brushSize, setBrushSize] = useState(14)
  const drawingRef = useRef(false)
  const sprayTimerRef = useRef(null)
  const lastPosRef = useRef(null)
  // 历史记录栈（每笔结束后保存快照）
  const historyRef = useRef([])

  const saveSnapshot = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    const snapshot = ctx.getImageData(0, 0, canvas.width, canvas.height)
    historyRef.current.push(snapshot)
    if (historyRef.current.length > MAX_HISTORY) historyRef.current.shift()
  }, [canvasRef])

  const undo = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const history = historyRef.current
    if (history.length === 0) return
    const ctx = canvas.getContext('2d')
    const snapshot = history.pop()
    ctx.putImageData(snapshot, 0, 0)
  }, [canvasRef])

  // 初始化画布内容（从 offscreen 读取已有涂鸦）
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !wallInfo) return
    const ctx = canvas.getContext('2d')
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    const { offscreen } = wallInfo.faceInfo
    if (offscreen) {
      ctx.drawImage(offscreen, 0, 0, canvas.width, canvas.height)
    }
  }, [canvasRef, wallInfo])

  // getBoundingClientRect 已包含 CSS transform，坐标映射天然正确
  const getPos = (e, canvas) => {
    const rect = canvas.getBoundingClientRect()
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    }
  }

  const sprayAt = useCallback((ctx, x, y, size, col) => {
    ctx.save()
    for (let i = 0; i < 60; i++) {
      const angle = Math.random() * Math.PI * 2
      const r = Math.pow(Math.random(), 0.5) * size * 1.8
      const alpha = (1 - r / (size * 1.8)) * 0.45
      ctx.globalAlpha = alpha
      ctx.fillStyle = col
      ctx.beginPath()
      ctx.arc(x + Math.cos(angle) * r, y + Math.sin(angle) * r, Math.random() * 1.8 + 0.3, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.restore()
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')

    const startDraw = (e) => {
      if (e.button !== 0) return
      if (panActiveRef?.current) return // 平移中禁止绘图
      e.preventDefault()
      saveSnapshot() // 落笔前保存快照，确保撤销能回到本笔前的状态
      drawingRef.current = true
      const pos = getPos(e, canvas)
      lastPosRef.current = pos

      if (tool === 'brush') {
        ctx.globalCompositeOperation = 'source-over'
        ctx.globalAlpha = 1
        ctx.strokeStyle = color
        ctx.lineWidth = brushSize
        ctx.lineCap = 'round'
        ctx.lineJoin = 'round'
        ctx.beginPath()
        ctx.arc(pos.x, pos.y, brushSize / 2, 0, Math.PI * 2)
        ctx.fillStyle = color
        ctx.fill()
        ctx.beginPath()
        ctx.moveTo(pos.x, pos.y)
      } else if (tool === 'spray') {
        sprayAt(ctx, pos.x, pos.y, brushSize, color)
        sprayTimerRef.current = setInterval(() => {
          if (lastPosRef.current) sprayAt(ctx, lastPosRef.current.x, lastPosRef.current.y, brushSize, color)
        }, 25)
      } else if (tool === 'eraser') {
        ctx.globalCompositeOperation = 'destination-out'
        ctx.globalAlpha = 1
        ctx.lineWidth = brushSize * 2.5
        ctx.lineCap = 'round'
        ctx.lineJoin = 'round'
        ctx.beginPath()
        ctx.moveTo(pos.x, pos.y)
      }
    }

    const draw = (e) => {
      if (!drawingRef.current) return
      if (panActiveRef?.current) { drawingRef.current = false; return }
      const pos = getPos(e, canvas)
      const last = lastPosRef.current

      if (tool === 'brush') {
        ctx.globalCompositeOperation = 'source-over'
        ctx.globalAlpha = 0.95
        ctx.strokeStyle = color
        ctx.lineWidth = brushSize
        ctx.lineCap = 'round'
        ctx.lineJoin = 'round'
        ctx.lineTo(pos.x, pos.y)
        ctx.stroke()
        ctx.beginPath()
        ctx.moveTo(pos.x, pos.y)
      } else if (tool === 'eraser' && last) {
        ctx.globalCompositeOperation = 'destination-out'
        ctx.globalAlpha = 1
        ctx.lineWidth = brushSize * 2.5
        ctx.lineCap = 'round'
        ctx.beginPath()
        ctx.moveTo(last.x, last.y)
        ctx.lineTo(pos.x, pos.y)
        ctx.stroke()
      }
      lastPosRef.current = pos
    }

    const endDraw = () => {
      drawingRef.current = false
      if (sprayTimerRef.current) { clearInterval(sprayTimerRef.current); sprayTimerRef.current = null }
      ctx.globalAlpha = 1
      ctx.globalCompositeOperation = 'source-over'
    }

    canvas.addEventListener('mousedown', startDraw)
    canvas.addEventListener('mousemove', draw)
    window.addEventListener('mouseup', endDraw)
    canvas.addEventListener('mouseleave', endDraw)

    return () => {
      canvas.removeEventListener('mousedown', startDraw)
      canvas.removeEventListener('mousemove', draw)
      window.removeEventListener('mouseup', endDraw)
      canvas.removeEventListener('mouseleave', endDraw)
      if (sprayTimerRef.current) clearInterval(sprayTimerRef.current)
    }
  }, [tool, color, brushSize, sprayAt, saveSnapshot, canvasRef, panActiveRef])

  const clearCanvas = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    if (wallInfo?.faceInfo?.offscreen && !wallInfo.faceInfo.hasGraffiti) {
      ctx.drawImage(wallInfo.faceInfo.offscreen, 0, 0, canvas.width, canvas.height)
    }
  }, [canvasRef, wallInfo])

  const saveToWall = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas || !wallInfo) return
    const { faceInfo } = wallInfo
    const { offscreen, texture } = faceInfo
    const octx = offscreen.getContext('2d')
    octx.clearRect(0, 0, offscreen.width, offscreen.height)
    octx.drawImage(canvas, 0, 0, offscreen.width, offscreen.height)
    texture.needsUpdate = true
    faceInfo.hasGraffiti = true
  }, [canvasRef, wallInfo])

  const placeImage = useCallback((imageBitmap, rect) => {
    const canvas = canvasRef.current
    if (!canvas || !imageBitmap) return
    saveSnapshot()
    const ctx = canvas.getContext('2d')
    ctx.globalCompositeOperation = 'source-over'
    ctx.globalAlpha = 1
    ctx.drawImage(imageBitmap, rect.x, rect.y, rect.w, rect.h)
  }, [canvasRef, saveSnapshot])

  return { tool, setTool, color, setColor, brushSize, setBrushSize, clearCanvas, saveToWall, undo, placeImage }
}
