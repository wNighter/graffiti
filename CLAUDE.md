# Graffiti — 项目快速参考

## 项目简介

**Graffiti（代号 Sprayz）** 是一个虚拟 3D 街头艺术创作平台。用户可在赛博朋克风格的 3D 城市街景中行走，靠近建筑墙面后进入 2D 涂鸦编辑器，完成创作后将涂鸦贴回 3D 墙面。

技术栈：**React 19 + Vite + Three.js + Canvas 2D API**，无路由库，用 `useState` 手动切换两个顶层视图。

## 常用命令

```bash
npm run dev      # 开发服务器 → http://localhost:5173
npm run build    # 生产构建 → dist/
npm run preview  # 预览构建产物
npm run lint     # ESLint 检查
```

## 目录结构

```
src/
├── App.jsx                  # 顶层页面切换（home ↔ scene）
├── main.jsx                 # React 入口
├── views/
│   ├── Home/                # 营销落地页（静态展示 + 3D 背景）
│   │   ├── index.jsx        # 组装各 section 的容器
│   │   └── sections/        # Header Hero Features Community CTA Footer LangToggle
│   └── Scene/               # 主交互页（约 1046 行）
│       ├── index.jsx        # 场景根组件：FPS/TPS 切换、HUD、状态管理
│       ├── GraffitiCanvas.jsx  # 涂鸦编辑器 UI（工具栏、色轮、图片定位、撤销/保存）
│       ├── Scene.css
│       └── GraffitiCanvas.css
├── hooks/
│   ├── useThreeScene.js     # Home Hero 的赛博朋克 3D 场景（345 行）
│   ├── useStreetScene.js    # Scene 的完整街景系统（1446 行）★ 最核心
│   ├── useGraffitiCanvas.js # 涂鸦绘制逻辑（笔刷/喷枪/橡皮擦/撤销）
│   └── useCanvas2D.js       # Home 页 2D 粒子跟随鼠标效果
├── components/
│   ├── SceneCanvas.jsx      # Three.js canvas 挂载容器
│   └── UIOverlay.jsx        # 悬浮控制面板（TPS/FPS 切换按钮等）
└── i18n/
    ├── index.jsx            # I18nProvider + useI18n Hook
    └── locales/en.js zh.js  # 英文 / 中文翻译键
```

## 核心流程

### 页面切换
`App.jsx` 持有 `page` 状态（`'home'` | `'scene'`），通过 props 向下传递 `onNavigate` 回调。

### 涂鸦工作流
1. 玩家在 `Scene/index.jsx` 中用 FPS/TPS 视角行走
2. `useStreetScene.js` 做 Raycasting，检测玩家是否靠近墙面 → 设置 `nearWall` 状态
3. 按 `E` 键触发 `paintMode = true`，传入 `wallInfo`（包含墙面截图 DataURL）
4. 渲染 `GraffitiCanvas.jsx`，使用 `useGraffitiCanvas.js` 进行绘制
5. 保存后将涂鸦 DataURL 通过 `useStreetScene` 的回调更新到 Three.js 纹理

### 3D 纹理更新
`useStreetScene.js` 为每面可绘墙创建离屏 Canvas → `CanvasTexture`。保存涂鸦时将图像绘制到离屏 Canvas 上，Three.js 自动 flag `needsUpdate = true`。

## 关键文件速查

| 要改什么 | 去哪里 |
|---------|--------|
| 导航栏 / 语言切换 | `src/views/Home/sections/Header.jsx` |
| 首页 Hero 3D 场景（建筑/粒子/灯光） | `src/hooks/useThreeScene.js` |
| 玩家移动 / 碰撞 / 视角 | `src/hooks/useStreetScene.js` |
| 墙面拾取 / 涂鸦贴图回写 | `src/hooks/useStreetScene.js` 搜索 `raycaster` / `graffitiTexture` |
| 涂鸦工具（笔刷/喷枪/橡皮擦） | `src/hooks/useGraffitiCanvas.js` |
| 涂鸦编辑器 UI 布局 | `src/views/Scene/GraffitiCanvas.jsx` |
| HUD / 准星 / 操作提示 | `src/views/Scene/index.jsx` + `Scene.css` |
| 国际化文案 | `src/i18n/locales/en.js` 和 `zh.js` |

## 技术要点

- **Two.js 动态纹理**：涂鸦通过 `OffscreenCanvas` → `THREE.CanvasTexture` 实时更新到 3D 墙面，无需重建 Mesh。
- **FPS 模式**：依赖 `PointerLockControls`，需要用户点击屏幕触发锁定；ESC 退出锁定。
- **TPS 模式**：球面坐标相机绕玩家旋转，不使用 `PointerLockControls`。
- **风化层**：墙面初始化时程序化生成污渍/裂缝纹理叠加在基础颜色上。
- **撤销**：`useGraffitiCanvas` 在每次笔触结束时保存 `ImageData` 快照，最多保留 30 步。
- **国际化**：`localStorage` 持久化语言偏好，Context 全局注入，不依赖第三方 i18n 库。

## 注意事项

- `useStreetScene.js` 超过 1400 行，修改前建议搜索具体函数名，避免误改。
- Three.js 对象（Mesh、Material、Texture）在组件卸载时须在 `useEffect` 的 cleanup 中手动 `dispose()`，否则内存泄漏。
- `PointerLockControls` 的 `lock()` 必须在用户事件回调中调用，不能在 `useEffect` 直接调用。
- 构建产物体积较大（Three.js ~600KB gzip），生产环境建议开启 CDN 外链。
