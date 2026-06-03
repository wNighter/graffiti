import './UIOverlay.css'

const UIOverlay = ({ mode, onModeChange }) => (
  <div className="ui-overlay">
    <div className="ui-panel">
      <h1 className="ui-title">Graffiti Canvas</h1>
      <div className="ui-mode-switcher">
        <button
          className={`ui-btn ${mode === 'threejs' ? 'active' : ''}`}
          onClick={() => onModeChange('threejs')}
        >
          Three.js 3D
        </button>
        <button
          className={`ui-btn ${mode === 'canvas2d' ? 'active' : ''}`}
          onClick={() => onModeChange('canvas2d')}
        >
          Canvas 2D
        </button>
      </div>
      <p className="ui-hint">
        {mode === 'threejs'
          ? '拖动旋转 · 滚轮缩放 · 右键平移'
          : '鼠标移动查看粒子追踪效果'}
      </p>
    </div>
  </div>
)

export default UIOverlay
