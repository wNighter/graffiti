# Graffiti Canvas

基于 **React 18 + Vite + Three.js + Canvas 2D API** 搭建的前端渲染框架，支持在 3D 场景与 2D 粒子画布间无缝切换。

---

## 技术栈

| 层级 | 技术 |
|------|------|
| UI 框架 | React 18（函数组件 + Hooks） |
| 构建工具 | Vite 8 |
| 3D 渲染 | Three.js 0.184 + OrbitControls |
| 2D 渲染 | 原生 Canvas 2D API |

---

## 目录结构

```
src/
├── components/
│   ├── SceneCanvas.jsx     # 渲染容器，根据 mode 挂载 Three.js / Canvas 2D
│   ├── UIOverlay.jsx       # 悬浮控制面板
│   └── UIOverlay.css
├── hooks/
│   ├── useThreeScene.js    # Three.js 场景生命周期 Hook
│   └── useCanvas2D.js      # Canvas 2D 粒子动画 Hook
├── App.jsx                 # 根组件，管理 mode 状态
└── index.css               # 全局重置样式
```

---

## 快速启动

### 前置要求

- Node.js >= 18（推荐 20.19+ 或 22+；若使用 Node 20.16 及以下，项目已锁定 Vite 5 以保持兼容）
- npm >= 9

### 安装依赖

```bash
npm install
```

### 开发模式（热更新）

```bash
npm run dev
```

启动后访问 [http://localhost:5173](http://localhost:5173)

### 生产构建

```bash
npm run build
```

产物输出到 `dist/` 目录。

### 预览构建产物

```bash
npm run preview
```

启动后访问 [http://localhost:4173](http://localhost:4173)

### 代码检查

```bash
npm run lint
```

---

## 功能说明

### Three.js 3D 模式

- 粒子点云（3000 个随机粒子）
- 线框旋转立方体
- OrbitControls 交互：拖动旋转 / 滚轮缩放 / 右键平移
- 自动响应窗口尺寸变化

### Canvas 2D 模式

- 120 个粒子跟随鼠标吸引
- 残影拖尾效果
- 蓝紫色调 HSL 动态着色
- 边界环绕

---

## 扩展指南

### 添加新的 Three.js 对象

编辑 `src/hooks/useThreeScene.js`，在 `scene.add(...)` 区域追加即可。

### 添加新的 2D 效果

编辑 `src/hooks/useCanvas2D.js`，在 `draw` 函数中扩展绘制逻辑。

### 新增渲染模式

1. 在 `src/App.jsx` 的 `mode` 状态中添加新值
2. 在 `src/components/SceneCanvas.jsx` 中挂载对应 canvas/容器
3. 编写对应的自定义 Hook 并接入
