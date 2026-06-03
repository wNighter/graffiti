import { useRef, useMemo, useState, useEffect, useCallback } from 'react'
import { useGraffitiCanvas } from '../../hooks/useGraffitiCanvas'
import { useI18n } from '../../i18n'
import './GraffitiCanvas.css'

const TOOL_IDS = ['brush', 'spray', 'eraser']

// ── 贴图定位器 ────────────────────────────────────────────────────────
const ImagePlacer = ({ bitmap, canvasRef, canvasDisplaySize, zoom, pan, onConfirm, onCancel, tc }) => {
  const ratio = bitmap ? bitmap.width / bitmap.height : 1

  const [rect, setRect] = useState(() => {
    const initW = canvasDisplaySize.w * 0.4
    const initH = initW / ratio
    return {
      x: (canvasDisplaySize.w - initW) / 2,
      y: (canvasDisplaySize.h - initH) / 2,
      w: initW,
      h: initH,
    }
  })

  const [locked, setLocked] = useState(true)
  const lockedRef = useRef(true)
  useEffect(() => { lockedRef.current = locked }, [locked])

  const dragRef = useRef(null)
  const [previewUrl, setPreviewUrl] = useState(null)

  useEffect(() => {
    if (!bitmap) return
    const tmp = new OffscreenCanvas(bitmap.width, bitmap.height)
    tmp.getContext('2d').drawImage(bitmap, 0, 0)
    tmp.convertToBlob().then(blob => {
      const url = URL.createObjectURL(blob)
      setPreviewUrl(prev => { if (prev) URL.revokeObjectURL(prev); return url })
    })
  }, [bitmap])

  const handleMouseDown = useCallback((e, type) => {
    e.preventDefault()
    e.stopPropagation()
    dragRef.current = { type, startX: e.clientX, startY: e.clientY, origRect: { ...rect } }
  }, [rect])

  useEffect(() => {
    const onMove = (e) => {
      if (!dragRef.current) return
      const { type, startX, startY, origRect } = dragRef.current
      const dx = (e.clientX - startX) / zoom
      const dy = (e.clientY - startY) / zoom
      const lock = lockedRef.current

      if (type === 'move') {
        setRect(r => ({ ...r, x: origRect.x + dx, y: origRect.y + dy }))
        return
      }

      if (lock) {
        // 以拖拽位移的绝对量较大轴为主驱动，保持比例
        const absDx = Math.abs(dx), absDy = Math.abs(dy)
        if (type === 'br') {
          const newW = Math.max(30, origRect.w + (absDx >= absDy ? dx : dy * ratio))
          setRect(r => ({ ...r, w: newW, h: newW / ratio }))
        } else if (type === 'bl') {
          const newW = Math.max(30, origRect.w + (absDx >= absDy ? -dx : dy * ratio))
          setRect(r => ({ ...r, x: origRect.x + origRect.w - newW, w: newW, h: newW / ratio }))
        } else if (type === 'tr') {
          const newW = Math.max(30, origRect.w + (absDx >= absDy ? dx : -dy * ratio))
          const newH = newW / ratio
          setRect(r => ({ ...r, y: origRect.y + origRect.h - newH, w: newW, h: newH }))
        } else if (type === 'tl') {
          const newW = Math.max(30, origRect.w + (absDx >= absDy ? -dx : -dy * ratio))
          const newH = newW / ratio
          setRect(r => ({ ...r, x: origRect.x + origRect.w - newW, y: origRect.y + origRect.h - newH, w: newW, h: newH }))
        }
      } else {
        if (type === 'br') {
          setRect(r => ({ ...r, w: Math.max(30, origRect.w + dx), h: Math.max(30, origRect.h + dy) }))
        } else if (type === 'bl') {
          const newW = Math.max(30, origRect.w - dx)
          setRect(r => ({ ...r, x: origRect.x + origRect.w - newW, w: newW, h: Math.max(30, origRect.h + dy) }))
        } else if (type === 'tr') {
          const newH = Math.max(30, origRect.h - dy)
          setRect(r => ({ ...r, y: origRect.y + origRect.h - newH, w: Math.max(30, origRect.w + dx), h: newH }))
        } else if (type === 'tl') {
          const newW = Math.max(30, origRect.w - dx)
          const newH = Math.max(30, origRect.h - dy)
          setRect(r => ({ ...r, x: origRect.x + origRect.w - newW, y: origRect.y + origRect.h - newH, w: newW, h: newH }))
        }
      }
    }
    const onUp = () => { dragRef.current = null }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp) }
  }, [zoom, ratio])

  const handleConfirm = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    const scaleX = canvas.width / canvasDisplaySize.w
    const scaleY = canvas.height / canvasDisplaySize.h
    onConfirm(bitmap, {
      x: rect.x * scaleX, y: rect.y * scaleY,
      w: rect.w * scaleX, h: rect.h * scaleY,
    })
  }

  const overlayStyle = {
    position: 'absolute',
    left: '50%',
    top: '50%',
    transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
    transformOrigin: 'center center',
    width: canvasDisplaySize.w + 'px',
    height: canvasDisplaySize.h + 'px',
    pointerEvents: 'none',
    zIndex: 10,
    marginLeft: -canvasDisplaySize.w / 2 + 'px',
    marginTop: -canvasDisplaySize.h / 2 + 'px',
  }

  const corners = [
    { key: 'tl', style: { top: -6, left: -6, cursor: 'nw-resize' } },
    { key: 'tr', style: { top: -6, right: -6, cursor: 'ne-resize' } },
    { key: 'bl', style: { bottom: -6, left: -6, cursor: 'sw-resize' } },
    { key: 'br', style: { bottom: -6, right: -6, cursor: 'se-resize' } },
  ]

  return (
    <>
      <div style={overlayStyle}>
        <div
          className="img-place-rect"
          style={{ left: rect.x, top: rect.y, width: rect.w, height: rect.h, pointerEvents: 'auto' }}
          onMouseDown={e => handleMouseDown(e, 'move')}
        >
          {previewUrl && (
            <img src={previewUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'fill', opacity: 0.85, pointerEvents: 'none', display: 'block' }} />
          )}
          {corners.map(c => (
            <div
              key={c.key}
              className="img-place-corner"
              style={c.style}
              onMouseDown={e => handleMouseDown(e, c.key)}
            />
          ))}
        </div>
      </div>
      <div className="img-place-actions">
        <button
          className={`tool-btn lock-btn ${locked ? 'active' : ''}`}
          onClick={() => setLocked(l => !l)}
          title={locked ? '切换为自由缩放' : '切换为固定比例'}
        >
          {locked ? '🔒 固定比例' : '🔓 自由缩放'}
        </button>
        <button className="action-btn save-btn" onClick={handleConfirm}>{tc.imgPlacer.confirm}</button>
        <button className="action-btn discard-btn" onClick={onCancel}>{tc.imgPlacer.cancel}</button>
      </div>
    </>
  )
}

const MIN_ZOOM = 0.15
const MAX_ZOOM = 12
const ZOOM_STEP = 1.3

const clampZoom = (z) => Math.min(Math.max(z, MIN_ZOOM), MAX_ZOOM)

// wallInfo = { mesh, faceIndex, faceInfo: { wallW, wallH, offscreen, texture } }
const GraffitiCanvas = ({ wallInfo, onSave, onDiscard }) => {
  const { t } = useI18n()
  const tc = t.canvas
  const canvasRef = useRef(null)
  const viewportRef = useRef(null)

  // 缩放与平移状态
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [isPanning, setIsPanning] = useState(false)
  const [spaceHeld, setSpaceHeld] = useState(false)

  // 用 ref 在回调中读取最新值，避免闭包捕获旧值
  const zoomRef = useRef(1)
  const panRef = useRef({ x: 0, y: 0 })
  const spaceHeldRef = useRef(false)
  const panActiveRef = useRef(false) // 传给绘图 hook，阻止平移时绘图
  const panDragRef = useRef(null)    // { startX, startY, originPanX, originPanY }

  useEffect(() => { zoomRef.current = zoom }, [zoom])
  useEffect(() => { panRef.current = pan }, [pan])

  const panActiveRef2 = useRef(false)
  // panActiveRef 供绘图 hook 读取
  const drawPanBlockRef = panActiveRef

  const [toolbarCollapsed, setToolbarCollapsed] = useState(false)

  // 上传图片相关状态
  const [placingBitmap, setPlacingBitmap] = useState(null)        // 贴图模式
  const fileInputRef = useRef(null)

  const { tool, setTool, color, setColor, brushSize, setBrushSize, clearCanvas, saveToWall, undo, placeImage } =
    useGraffitiCanvas(canvasRef, wallInfo, drawPanBlockRef)

  // 贴图模式下阻断手绘
  useEffect(() => {
    drawPanBlockRef.current = !!placingBitmap
  }, [placingBitmap, drawPanBlockRef])

  const handleFileChange = (e) => {
    const file = e.target.files?.[0]
    if (file) {
      createImageBitmap(file).then(bmp => setPlacingBitmap(bmp))
    }
    e.target.value = ''
  }

  const handlePlaceConfirm = (bitmap, rect) => {
    placeImage(bitmap, rect)
    setPlacingBitmap(null)
  }

  // 画布显示尺寸（适应屏幕，保持墙面比例）
  const canvasDisplaySize = useMemo(() => {
    if (!wallInfo) return { w: 900, h: 600 }
    const { wallW, wallH } = wallInfo.faceInfo
    const ratio = wallW / wallH
    const maxW = Math.min(window.innerWidth * 0.88, 1280)
    const maxH = window.innerHeight * 0.62
    let w = maxW, h = maxW / ratio
    if (h > maxH) { h = maxH; w = maxH * ratio }
    return { w: Math.round(w), h: Math.round(h) }
  }, [wallInfo])

  // 画布内部分辨率（更高分辨率支持精细绘制）
  const canvasResolution = useMemo(() => {
    if (!wallInfo) return { w: 2048, h: 1024 }
    const { wallW, wallH } = wallInfo.faceInfo
    const RES = 128
    const rw = Math.min(Math.round(wallW * RES), 4096)
    const rh = Math.min(Math.round(wallH * RES), 4096)
    return { w: rw, h: rh }
  }, [wallInfo])

  // ── 滚轮缩放（以鼠标位置为缩放中心）──────────────────────────────
  const handleWheel = useCallback((e) => {
    e.preventDefault()
    const vp = viewportRef.current
    if (!vp) return
    const rect = vp.getBoundingClientRect()
    const factor = e.deltaY < 0 ? ZOOM_STEP : 1 / ZOOM_STEP
    const newZoom = clampZoom(zoomRef.current * factor)

    // 鼠标在 viewport 中心坐标系中的位置
    const vx = e.clientX - rect.left - rect.width / 2
    const vy = e.clientY - rect.top - rect.height / 2
    // 保持鼠标下的点不动
    const ox = (vx - panRef.current.x) / zoomRef.current
    const oy = (vy - panRef.current.y) / zoomRef.current
    setZoom(newZoom)
    setPan({ x: vx - ox * newZoom, y: vy - oy * newZoom })
  }, [])

  useEffect(() => {
    const vp = viewportRef.current
    if (!vp) return
    vp.addEventListener('wheel', handleWheel, { passive: false })
    return () => vp.removeEventListener('wheel', handleWheel)
  }, [handleWheel])

  // ── 键盘快捷键（空格平移 + Ctrl+Z 撤销）──────────────────────────
  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.code === 'Space' && !e.repeat) {
        e.preventDefault()
        spaceHeldRef.current = true
        drawPanBlockRef.current = true // 空格按下即阻断画笔，避免后续 mousedown 误画
        setSpaceHeld(true)
      }
      if ((e.ctrlKey || e.metaKey) && e.code === 'KeyZ' && !e.repeat) {
        e.preventDefault()
        undo()
      }
    }
    const onKeyUp = (e) => {
      if (e.code === 'Space') {
        spaceHeldRef.current = false
        // 只有在没有鼠标平移进行中时才解除阻断
        if (!panDragRef.current) drawPanBlockRef.current = false
        setSpaceHeld(false)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
    }
  }, [undo])

  // ── 鼠标平移（中键 或 空格+左键）────────────────────────────────
  const handleViewportMouseDown = useCallback((e) => {
    const isPanGesture = e.button === 1 || (e.button === 0 && spaceHeldRef.current)
    if (!isPanGesture) return
    e.preventDefault()
    drawPanBlockRef.current = true
    setIsPanning(true)
    panDragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      originX: panRef.current.x,
      originY: panRef.current.y,
    }
  }, [drawPanBlockRef])

  useEffect(() => {
    const onMouseMove = (e) => {
      if (!panDragRef.current) return
      const { startX, startY, originX, originY } = panDragRef.current
      setPan({ x: originX + (e.clientX - startX), y: originY + (e.clientY - startY) })
    }
    const onMouseUp = () => {
      if (panDragRef.current) {
        panDragRef.current = null
        // 只有空格也已松开时才解除画笔阻断
        if (!spaceHeldRef.current) drawPanBlockRef.current = false
        setIsPanning(false)
      }
    }
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
    return () => {
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
    }
  }, [drawPanBlockRef])

  // ── 缩放快捷操作 ─────────────────────────────────────────────────
  const zoomIn  = () => setZoom(z => clampZoom(z * ZOOM_STEP))
  const zoomOut = () => setZoom(z => clampZoom(z / ZOOM_STEP))
  const resetView = () => { setZoom(1); setPan({ x: 0, y: 0 }) }
  const fitView = () => {
    // 适配视口，让整个画布居中显示
    setZoom(1)
    setPan({ x: 0, y: 0 })
  }

  const handleSave = () => {
    saveToWall()
    onSave()
  }

  // 光标样式
  const canvasCursor = isPanning ? 'grabbing'
    : spaceHeld ? 'grab'
    : tool === 'eraser' ? 'cell'
    : 'crosshair'

  return (
    <div className="graffiti-overlay">
      <div className="graffiti-panel">

        {/* ── 工具栏 ── */}
        <div className={`graffiti-toolbar ${toolbarCollapsed ? 'collapsed' : ''}`}>
          <button
            className="toolbar-toggle"
            onClick={() => setToolbarCollapsed(c => !c)}
            title={toolbarCollapsed ? tc.toolbar.expand : tc.toolbar.collapse}
          >
            {toolbarCollapsed ? '▼' : '▲'}
          </button>

          {!toolbarCollapsed && (<>
            <div className="tool-group">
              {TOOL_IDS.map((id) => (
                <button
                  key={id}
                  className={`tool-btn ${tool === id ? 'active' : ''}`}
                  onClick={() => setTool(id)}
                  title={tc.tools[id].title}
                >
                  {tc.tools[id].label}
                </button>
              ))}
              <button className="tool-btn clear-btn" onClick={clearCanvas} title={tc.toolbar.clearTitle}>
                {tc.toolbar.clear}
              </button>
              <button className="tool-btn undo-btn" onClick={undo} title={tc.toolbar.undoTitle}>
                {tc.toolbar.undo}
              </button>
              <label className="tool-btn upload-btn" htmlFor="graffiti-file-input" title={tc.toolbar.uploadImageTitle} style={{ cursor: 'pointer' }}>
                {tc.toolbar.uploadImage}
              </label>
            </div>

            <div className="tool-group">
              <label className="tool-label">{tc.toolbar.color}</label>
              <input
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="color-picker"
              />
            </div>

            <div className="tool-group">
              <label className="tool-label">{tc.toolbar.brushSize} {brushSize}px</label>
              <input
                type="range"
                min="1"
                max="120"
                value={brushSize}
                onChange={(e) => setBrushSize(Number(e.target.value))}
                className="brush-slider"
              />
            </div>

            {/* 缩放控制 */}
            <div className="tool-group zoom-group">
              <button className="zoom-btn" onClick={zoomOut} title={tc.toolbar.zoomOutTitle}>－</button>
              <span className="zoom-label" title={tc.toolbar.resetZoomTitle} onDoubleClick={resetView}>
                {Math.round(zoom * 100)}%
              </span>
              <button className="zoom-btn" onClick={zoomIn} title={tc.toolbar.zoomInTitle}>＋</button>
              <button className="zoom-btn zoom-fit" onClick={fitView} title={tc.toolbar.fitViewTitle}>⌖</button>
            </div>

            <div className="tool-group action-group">
              <button className="action-btn save-btn" onClick={handleSave}>{tc.toolbar.save}</button>
              <button className="action-btn discard-btn" onClick={onDiscard}>{tc.toolbar.discard}</button>
            </div>
          </>)}

          {/* 折叠状态下仍显示保存/放弃 */}
          {toolbarCollapsed && (
            <div className="tool-group action-group">
              <button className="action-btn save-btn" onClick={handleSave}>{tc.toolbar.save}</button>
              <button className="action-btn discard-btn" onClick={onDiscard}>{tc.toolbar.discard}</button>
            </div>
          )}

          {/* 文件输入始终挂载，id 与 label htmlFor 对应 */}
          <input
            id="graffiti-file-input"
            ref={fileInputRef}
            type="file"
            accept="image/*"
            style={{ position: 'absolute', opacity: 0, width: 0, height: 0, pointerEvents: 'none' }}
            onChange={handleFileChange}
          />
        </div>

        {/* ── 提示栏 ── */}
        <div className="canvas-hints">
          <span>{tc.hints.zoom}</span>
          <span>·</span>
          <span>{tc.hints.pan}</span>
          <span>·</span>
          <span>{tc.hints.undo}</span>
          <span>·</span>
          <span>📐 {wallInfo?.faceInfo.wallW} × {wallInfo?.faceInfo.wallH} m</span>
          <span>·</span>
          <span>{tc.hints.resolution} {canvasResolution.w} × {canvasResolution.h}</span>
        </div>

        {/* ── 画布视口 ── */}
        <div
          ref={viewportRef}
          className="canvas-viewport"
          onMouseDown={handleViewportMouseDown}
          style={{ cursor: canvasCursor }}
        >
          {/* 变换容器：缩放 + 平移 */}
          <div
            className="canvas-transform-container"
            style={{
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            }}
          >
            <canvas
              ref={canvasRef}
              width={canvasResolution.w}
              height={canvasResolution.h}
              className="graffiti-draw-canvas"
              style={{
                width: canvasDisplaySize.w + 'px',
                height: canvasDisplaySize.h + 'px',
                cursor: canvasCursor,
              }}
            />
          </div>

          {/* 贴图定位层 */}
          {placingBitmap && (
            <ImagePlacer
              bitmap={placingBitmap}
              canvasRef={canvasRef}
              canvasDisplaySize={canvasDisplaySize}
              zoom={zoom}
              pan={pan}
              onConfirm={handlePlaceConfirm}
              onCancel={() => setPlacingBitmap(null)}
              tc={tc}
            />
          )}

          {/* 缩放 < 50% 时显示提示 */}
          {zoom < 0.5 && (
            <div className="zoom-tip">{tc.zoomTip}</div>
          )}
        </div>

      </div>
    </div>
  )
}

export default GraffitiCanvas
