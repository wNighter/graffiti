import { useRef, useEffect } from 'react'
import useThreeScene from '../hooks/useThreeScene'
import useCanvas2D from '../hooks/useCanvas2D'

/**
 * SceneCanvas - 根据 mode 切换渲染器
 * mode: 'threejs' | 'canvas2d'
 */
const SceneCanvas = ({ mode }) => {
  const threeRef = useRef(null)
  const canvas2dRef = useRef(null)

  useThreeScene(threeRef, mode === 'threejs')
  useCanvas2D(canvas2dRef, mode === 'canvas2d')

  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      {/* Three.js 挂载容器 */}
      <div
        ref={threeRef}
        style={{
          width: '100%',
          height: '100%',
          display: mode === 'threejs' ? 'block' : 'none',
        }}
      />
      {/* Canvas 2D */}
      <canvas
        ref={canvas2dRef}
        style={{
          width: '100%',
          height: '100%',
          display: mode === 'canvas2d' ? 'block' : 'none',
        }}
      />
    </div>
  )
}

export default SceneCanvas
