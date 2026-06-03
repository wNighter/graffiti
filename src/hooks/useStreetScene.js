import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js'

// ─── 工具：离屏 Canvas ───────────────────────────────────────────

const makeOffscreen = (wallW, wallH, drawFn) => {
  const RES = 80
  const pw = Math.min(Math.round(wallW * RES), 2048)
  const ph = Math.min(Math.round(wallH * RES), 2048)
  const c = document.createElement('canvas')
  c.width = pw
  c.height = ph
  drawFn(c.getContext('2d'), pw, ph)
  return c
}

// ─── 工具：生成可绘制表面纹理 ────────────────────────────────────

const makePaintable = (mesh, wallW, wallH, drawFn) => {
  const offscreen = makeOffscreen(wallW, wallH, drawFn || ((ctx, w, h) => {
    ctx.clearRect(0, 0, w, h)
  }))
  const texture = new THREE.CanvasTexture(offscreen)
  const faceInfo = { offscreen, texture, wallW, wallH, hasGraffiti: false }
  const paintMat = new THREE.MeshLambertMaterial({ map: texture })
  const groupCount = mesh.geometry?.groups?.length || 1
  // 用同一默认材质填满所有 face group，避免 Three.js 访问 undefined material
  const defaultMat = new THREE.MeshLambertMaterial({ color: 0x888888 })
  mesh.material = Array.from({ length: groupCount }, (_, i) => i === 0 ? paintMat : defaultMat)
  mesh.userData.faces = [faceInfo]
  return faceInfo
}

// ─── 公共风化层（叠在所有纹理最上方） ──────────────────────────

const applyWeathering = (ctx, w, h) => {
  // 随机噪点（模拟墙面颗粒）
  for (let i = 0; i < w * h * 0.018; i++) {
    const nx = Math.random() * w
    const ny = Math.random() * h
    const alpha = Math.random() * 0.09
    ctx.fillStyle = Math.random() > 0.5
      ? `rgba(0,0,0,${alpha})`
      : `rgba(255,255,255,${alpha * 0.5})`
    ctx.fillRect(nx, ny, 1 + Math.random() * 2, 1 + Math.random() * 2)
  }

  // 竖向渗水痕（从顶部窗台往下延伸）
  const streakCount = Math.floor(w / 28) + 1
  for (let i = 0; i < streakCount; i++) {
    const sx = (Math.random() * 0.85 + 0.08) * w
    const sy = Math.random() * h * 0.25
    const sh = h * (0.25 + Math.random() * 0.55)
    const sw = 1 + Math.random() * 2.5
    const grad = ctx.createLinearGradient(sx, sy, sx, sy + sh)
    grad.addColorStop(0, 'rgba(30,20,10,0.22)')
    grad.addColorStop(0.6, 'rgba(20,14,8,0.1)')
    grad.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.fillStyle = grad
    ctx.fillRect(sx, sy, sw, sh)
  }

  // 墙角积污（底部加深）
  const cornerGrad = ctx.createLinearGradient(0, h * 0.72, 0, h)
  cornerGrad.addColorStop(0, 'rgba(0,0,0,0)')
  cornerGrad.addColorStop(1, 'rgba(0,0,0,0.32)')
  ctx.fillStyle = cornerGrad
  ctx.fillRect(0, h * 0.72, w, h * 0.28)

  // 顶部轻微褪色
  const topGrad = ctx.createLinearGradient(0, 0, 0, h * 0.12)
  topGrad.addColorStop(0, 'rgba(255,255,255,0.07)')
  topGrad.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.fillStyle = topGrad
  ctx.fillRect(0, 0, w, h * 0.12)

  // 细裂缝（随机折线）
  const crackCount = Math.floor(w / 120) + 1
  ctx.strokeStyle = 'rgba(0,0,0,0.12)'
  ctx.lineWidth = 1
  for (let i = 0; i < crackCount; i++) {
    let cx = Math.random() * w, cy = Math.random() * h
    ctx.beginPath()
    ctx.moveTo(cx, cy)
    for (let s = 0; s < 5 + Math.floor(Math.random() * 6); s++) {
      cx += (Math.random() - 0.5) * 18
      cy += Math.random() * 14 + 2
      ctx.lineTo(cx, cy)
    }
    ctx.stroke()
  }
}

// ─── 建筑纹理绘制函数 ────────────────────────────────────────────

const drawWindows = {
  // 玻璃幕墙（办公塔楼）
  tower: (ctx, w, h, baseHex) => {
    // 混凝土底色 + 轻微色差
    const grad = ctx.createLinearGradient(0, 0, w, h)
    grad.addColorStop(0, `#${baseHex}`)
    grad.addColorStop(0.45, '#354555')
    grad.addColorStop(1, '#2a3a4a')
    ctx.fillStyle = grad
    ctx.fillRect(0, 0, w, h)

    // 楼层腰带（每隔若干行加深横条）
    const cols = 5, rows = Math.round(h / (w / cols) * 1.2)
    const cw = w / cols, rh = h / rows
    const floorBandEvery = Math.max(3, Math.floor(rows / 6))
    for (let r = 0; r < rows; r++) {
      if (r % floorBandEvery === 0) {
        ctx.fillStyle = 'rgba(0,0,0,0.18)'
        ctx.fillRect(0, r * rh, w, 5)
      }
      for (let c = 0; c < cols; c++) {
        const lum = 0.25 + Math.random() * 0.5
        const lit = Math.random() > 0.35
        if (lit) {
          ctx.fillStyle = `rgba(${Math.round(140 * lum)},${Math.round(190 * lum)},${Math.round(255 * lum)},0.7)`
        } else {
          ctx.fillStyle = `rgba(15,25,45,0.85)`
        }
        ctx.fillRect(c * cw + 4, r * rh + 4, cw - 8, rh - 8)
        if (lit) {
          // 镜面反光
          ctx.fillStyle = 'rgba(255,255,255,0.07)'
          ctx.fillRect(c * cw + 4, r * rh + 4, (cw - 8) * 0.35, rh - 8)
          // 云影反射（斜向高光）
          ctx.fillStyle = 'rgba(200,220,255,0.04)'
          ctx.fillRect(c * cw + 4, r * rh + 4, cw - 8, (rh - 8) * 0.4)
        }
      }
    }

    // 钢结构框架
    ctx.strokeStyle = 'rgba(160,185,210,0.3)'
    ctx.lineWidth = 3
    for (let c = 0; c <= cols; c++) {
      ctx.beginPath(); ctx.moveTo(c * cw, 0); ctx.lineTo(c * cw, h); ctx.stroke()
    }
    ctx.lineWidth = 2
    for (let r = 0; r <= rows; r++) {
      ctx.beginPath(); ctx.moveTo(0, r * rh); ctx.lineTo(w, r * rh); ctx.stroke()
    }

    applyWeathering(ctx, w, h)
  },

  // 居家小窗（公寓楼）
  apartment: (ctx, w, h, baseHex) => {
    // 砖墙底色（4色随机拼砌）
    const brickColors = ['#c4b89a', '#c8bb9e', '#c0b494', '#bdb18f', '#b8a888', '#ccc0a8']
    const bh = 14, bw = 28
    for (let y = 0; y < h; y += bh) {
      const offset = Math.floor(y / bh) % 2 === 0 ? 0 : bw / 2
      for (let x = -bw; x < w + bw; x += bw) {
        ctx.fillStyle = brickColors[Math.floor(Math.random() * brickColors.length)]
        ctx.fillRect(x + offset + 1, y + 1, bw - 2, bh - 2)
      }
    }
    // 砖缝勾边（深色）
    ctx.strokeStyle = 'rgba(90,70,50,0.45)'
    ctx.lineWidth = 1
    for (let y = 0; y < h; y += bh) {
      const offset = Math.floor(y / bh) % 2 === 0 ? 0 : bw / 2
      for (let x = -bw; x < w + bw; x += bw) {
        ctx.strokeRect(x + offset + 1.5, y + 1.5, bw - 3, bh - 3)
      }
    }
    // 基调叠色
    ctx.fillStyle = `#${baseHex}22`
    ctx.fillRect(0, 0, w, h)

    const cols = 3, rows = Math.max(2, Math.round(h / 40))
    const cw = w / cols, rh = h / rows
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const lit = Math.random() > 0.28
        const wx = c * cw + cw * 0.2, wy = r * rh + rh * 0.18
        const ww = cw * 0.6, wh = rh * 0.52
        // 窗台（带厚度）
        ctx.fillStyle = 'rgba(200,190,168,0.95)'
        ctx.fillRect(wx - 4, wy + wh, ww + 8, 5)
        ctx.fillStyle = 'rgba(140,130,115,0.7)'
        ctx.fillRect(wx - 4, wy + wh + 5, ww + 8, 3)
        // 遮雨板
        ctx.fillStyle = 'rgba(110,100,85,0.5)'
        ctx.fillRect(wx - 3, wy - 3, ww + 6, 4)
        // 玻璃
        if (lit) {
          const wg = ctx.createLinearGradient(wx, wy, wx + ww, wy + wh)
          wg.addColorStop(0, 'rgba(255,235,160,0.88)')
          wg.addColorStop(1, 'rgba(230,200,120,0.72)')
          ctx.fillStyle = wg
        } else {
          ctx.fillStyle = 'rgba(28,38,65,0.8)'
        }
        ctx.fillRect(wx, wy, ww, wh)
        // 窗框
        ctx.strokeStyle = lit ? 'rgba(220,210,185,0.9)' : 'rgba(180,170,150,0.7)'
        ctx.lineWidth = 2.5
        ctx.strokeRect(wx, wy, ww, wh)
        // 横竖分格
        ctx.lineWidth = 1.5
        ctx.beginPath(); ctx.moveTo(wx, wy + wh / 2); ctx.lineTo(wx + ww, wy + wh / 2); ctx.stroke()
        ctx.beginPath(); ctx.moveTo(wx + ww / 2, wy); ctx.lineTo(wx + ww / 2, wy + wh); ctx.stroke()
        // 随机窗帘
        if (lit && Math.random() > 0.55) {
          ctx.fillStyle = `rgba(${180 + Math.random() * 60|0},${140 + Math.random() * 60|0},${80 + Math.random() * 60|0},0.35)`
          ctx.fillRect(wx, wy, ww * (0.35 + Math.random() * 0.3), wh)
        }
      }
    }
    applyWeathering(ctx, w, h)
  },

  // 工业门窗（仓库）
  warehouse: (ctx, w, h, baseHex) => {
    // 混凝土块底色
    ctx.fillStyle = `#${baseHex}`
    ctx.fillRect(0, 0, w, h)
    // 大砖纹（工业尺寸）
    ctx.strokeStyle = 'rgba(40,15,8,0.28)'
    ctx.lineWidth = 1.5
    for (let y = 0; y < h; y += 22) {
      const offset = Math.floor(y / 22) % 2 === 0 ? 0 : 18
      for (let x = -36 + offset; x < w; x += 36) {
        ctx.strokeRect(x + 1, y + 1, 35, 21)
      }
    }
    // 混凝土色差块
    for (let i = 0; i < 6; i++) {
      ctx.fillStyle = `rgba(0,0,0,${0.03 + Math.random() * 0.06})`
      ctx.fillRect(Math.random() * w * 0.8, Math.random() * h * 0.8, w * 0.25, h * 0.22)
    }
    // 大卷帘门
    ctx.fillStyle = 'rgba(45,32,18,0.88)'
    ctx.fillRect(w * 0.1, h * 0.26, w * 0.32, h * 0.7)
    ctx.fillRect(w * 0.56, h * 0.26, w * 0.32, h * 0.7)
    // 卷帘横条（带高光）
    for (let i = 0; i <= 8; i++) {
      const yl = h * 0.26 + (h * 0.7 / 8) * i
      ctx.strokeStyle = 'rgba(80,58,32,0.9)'; ctx.lineWidth = 4
      ctx.beginPath(); ctx.moveTo(w * 0.1, yl); ctx.lineTo(w * 0.42, yl); ctx.stroke()
      ctx.beginPath(); ctx.moveTo(w * 0.56, yl); ctx.lineTo(w * 0.88, yl); ctx.stroke()
      // 高光线
      ctx.strokeStyle = 'rgba(120,90,55,0.25)'; ctx.lineWidth = 1
      ctx.beginPath(); ctx.moveTo(w * 0.1, yl + 2); ctx.lineTo(w * 0.42, yl + 2); ctx.stroke()
      ctx.beginPath(); ctx.moveTo(w * 0.56, yl + 2); ctx.lineTo(w * 0.88, yl + 2); ctx.stroke()
    }
    // 顶部高窗
    ctx.fillStyle = 'rgba(140,175,220,0.38)'
    ctx.fillRect(w * 0.04, h * 0.04, w * 0.92, h * 0.15)
    ctx.strokeStyle = 'rgba(150,135,100,0.75)'; ctx.lineWidth = 3
    ctx.strokeRect(w * 0.04, h * 0.04, w * 0.92, h * 0.15)
    for (let i = 1; i < 5; i++) {
      ctx.beginPath()
      ctx.moveTo(w * 0.04 + (w * 0.92 / 5) * i, h * 0.04)
      ctx.lineTo(w * 0.04 + (w * 0.92 / 5) * i, h * 0.19)
      ctx.stroke()
    }
    // 油漆标语（随机）
    ctx.fillStyle = 'rgba(220,180,100,0.55)'
    ctx.font = `bold ${Math.round(h * 0.06)}px monospace`
    ctx.textAlign = 'center'
    ctx.fillText('LOADING ZONE', w / 2, h * 0.23)
    applyWeathering(ctx, w, h)
  },

  // 落地橱窗（商铺）
  shop: (ctx, w, h, baseHex) => {
    ctx.fillStyle = `#${baseHex}`
    ctx.fillRect(0, 0, w, h)
    // 墙面装饰横线
    ctx.strokeStyle = 'rgba(160,145,128,0.35)'
    ctx.lineWidth = 1
    for (let y = h * 0.16; y < h; y += 18) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke()
    }
    // 橱窗玻璃（带反光）
    const makeShopWindow = (wx, wy, ww, wh) => {
      const wg = ctx.createLinearGradient(wx, wy, wx + ww, wy + wh)
      wg.addColorStop(0, 'rgba(155,205,248,0.48)')
      wg.addColorStop(0.4, 'rgba(210,235,255,0.28)')
      wg.addColorStop(1, 'rgba(130,185,235,0.38)')
      ctx.fillStyle = wg
      ctx.fillRect(wx, wy, ww, wh)
      // 斜向反光
      ctx.fillStyle = 'rgba(255,255,255,0.08)'
      ctx.beginPath()
      ctx.moveTo(wx + ww * 0.1, wy)
      ctx.lineTo(wx + ww * 0.45, wy)
      ctx.lineTo(wx + ww * 0.25, wy + wh)
      ctx.lineTo(wx, wy + wh)
      ctx.closePath()
      ctx.fill()
      // 橱窗框
      ctx.strokeStyle = 'rgba(130,110,90,0.95)'; ctx.lineWidth = 4
      ctx.strokeRect(wx, wy, ww, wh)
    }
    makeShopWindow(w * 0.07, h * 0.14, w * 0.39, h * 0.66)
    makeShopWindow(w * 0.54, h * 0.14, w * 0.39, h * 0.66)
    // 玻璃门
    ctx.fillStyle = 'rgba(45,28,18,0.78)'
    ctx.fillRect(w * 0.41, h * 0.37, w * 0.18, h * 0.59)
    ctx.strokeStyle = 'rgba(110,90,65,0.92)'; ctx.lineWidth = 2
    ctx.strokeRect(w * 0.41, h * 0.37, w * 0.18, h * 0.59)
    // 门把手
    ctx.fillStyle = 'rgba(210,190,100,0.92)'
    ctx.beginPath(); ctx.arc(w * 0.454, h * 0.67, 3.5, 0, Math.PI * 2); ctx.fill()
    // 招牌（渐变）
    const sgr = ctx.createLinearGradient(0, 0, w, 0)
    sgr.addColorStop(0, 'rgba(190,50,35,0.97)')
    sgr.addColorStop(1, 'rgba(165,35,25,0.97)')
    ctx.fillStyle = sgr
    ctx.fillRect(0, 0, w, h * 0.13)
    // 招牌底边高光
    ctx.fillStyle = 'rgba(255,200,180,0.15)'
    ctx.fillRect(0, h * 0.11, w, h * 0.02)
    ctx.fillStyle = 'rgba(255,255,255,0.95)'
    ctx.font = `bold ${Math.round(h * 0.082)}px sans-serif`
    ctx.textAlign = 'center'
    ctx.fillText('SHOP', w / 2, h * 0.094)
    // 橱窗展示物（简单色块）
    ctx.fillStyle = 'rgba(255,220,180,0.2)'
    ctx.fillRect(w * 0.1, h * 0.38, w * 0.32, h * 0.18)
    ctx.fillStyle = 'rgba(180,220,255,0.18)'
    ctx.fillRect(w * 0.56, h * 0.45, w * 0.32, h * 0.14)
    applyWeathering(ctx, w, h)
  },

  // 竖向条窗（转角楼）
  corner: (ctx, w, h, baseHex) => {
    // 混凝土渐变底
    const grad = ctx.createLinearGradient(0, 0, 0, h)
    grad.addColorStop(0, '#68687e')
    grad.addColorStop(0.5, '#545468')
    grad.addColorStop(1, `#${baseHex}`)
    ctx.fillStyle = grad
    ctx.fillRect(0, 0, w, h)
    // 预制板缝（横向）
    ctx.strokeStyle = 'rgba(0,0,0,0.15)'; ctx.lineWidth = 2
    const panelH = h / Math.round(h / 35)
    for (let y = 0; y < h; y += panelH) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke()
    }
    // 竖向条窗
    const strips = Math.round(w / 30)
    const sw = w / strips
    for (let i = 0; i < strips; i++) {
      if (i % 2 === 0) {
        // 玻璃条
        const sg = ctx.createLinearGradient(i * sw, 0, i * sw + sw, 0)
        sg.addColorStop(0, 'rgba(70,95,155,0.32)')
        sg.addColorStop(0.45, 'rgba(115,145,210,0.48)')
        sg.addColorStop(0.7, 'rgba(180,200,240,0.22)')
        sg.addColorStop(1, 'rgba(70,95,155,0.18)')
        ctx.fillStyle = sg
        ctx.fillRect(i * sw + 5, h * 0.04, sw - 10, h * 0.92)
        // 楼层横向分格
        const floors = Math.round(h / 25)
        ctx.strokeStyle = 'rgba(40,55,100,0.35)'; ctx.lineWidth = 1
        for (let f = 1; f < floors; f++) {
          const fy = h * 0.04 + (h * 0.92 / floors) * f
          ctx.beginPath()
          ctx.moveTo(i * sw + 5, fy)
          ctx.lineTo(i * sw + sw - 5, fy)
          ctx.stroke()
        }
      }
    }
    // 楼层分隔腰线
    ctx.strokeStyle = 'rgba(255,255,255,0.08)'; ctx.lineWidth = 1
    const floors = Math.round(h / 22)
    for (let f = 0; f <= floors; f++) {
      const y = (h / floors) * f
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke()
    }
    // 角部强调线
    ctx.strokeStyle = 'rgba(200,210,230,0.18)'; ctx.lineWidth = 2
    ctx.strokeRect(2, 2, w - 4, h - 4)
    applyWeathering(ctx, w, h)
  },
}

// ─── 建筑类型定义 ─────────────────────────────────────────────────

const BUILDING_TYPES = {
  tower:     { w: 8,  h: 26, d: 8,  baseColor: 0x4a6878, roofColor: 0x1a2d3d, style: 'tower' },
  apartment: { w: 13, h: 12, d: 10, baseColor: 0xc4b89a, roofColor: 0x8b7355, style: 'apartment' },
  warehouse: { w: 17, h: 7,  d: 13, baseColor: 0xa05040, roofColor: 0x3a2010, style: 'warehouse' },
  shop:      { w: 10, h: 5,  d: 7,  baseColor: 0xe0d8cc, roofColor: 0xcc5533, style: 'shop' },
  corner:    { w: 12, h: 18, d: 12, baseColor: 0x4a4a5a, roofColor: 0x1e1e2e, style: 'corner' },
}

// ─── 建筑创建 ────────────────────────────────────────────────────

const createBuilding = (scene, buildingDef, x, z) => {
  const { w, h, d, baseColor, roofColor, style } = buildingDef
  const hexStr = baseColor.toString(16).padStart(6, '0')
  const drawFn = drawWindows[style] || drawWindows.apartment

  const makeFace = (wallW, wallH) => {
    const offscreen = makeOffscreen(wallW, wallH, (ctx, pw, ph) => drawFn(ctx, pw, ph, hexStr))
    const texture = new THREE.CanvasTexture(offscreen)
    return { offscreen, texture, wallW, wallH, hasGraffiti: false }
  }

  const faceRight = makeFace(d, h)
  const faceLeft  = makeFace(d, h)
  const faceFront = makeFace(w, h)
  const faceBack  = makeFace(w, h)

  const roofMat   = new THREE.MeshLambertMaterial({ color: roofColor })
  const bottomMat = new THREE.MeshLambertMaterial({ color: 0x111111 })

  const materials = [
    new THREE.MeshLambertMaterial({ map: faceRight.texture }),
    new THREE.MeshLambertMaterial({ map: faceLeft.texture }),
    roofMat,
    bottomMat,
    new THREE.MeshLambertMaterial({ map: faceFront.texture }),
    new THREE.MeshLambertMaterial({ map: faceBack.texture }),
  ]

  const geo = new THREE.BoxGeometry(w, h, d)
  const mesh = new THREE.Mesh(geo, materials)
  mesh.position.set(x, h / 2, z)
  mesh.userData = {
    isBuilding: true,
    faces: [faceRight, faceLeft, null, null, faceFront, faceBack],
  }
  scene.add(mesh)

  // ── 底座（所有建筑共有，略宽于主体）
  const baseColor3 = new THREE.Color(baseColor).multiplyScalar(0.65)
  const baseMat = new THREE.MeshLambertMaterial({ color: baseColor3 })
  const base = new THREE.Mesh(new THREE.BoxGeometry(w + 0.8, 0.55, d + 0.8), baseMat)
  base.position.set(x, 0.275, z)
  scene.add(base)

  // 底座上沿压线
  const plinthMat = new THREE.MeshLambertMaterial({ color: new THREE.Color(baseColor).multiplyScalar(0.9) })
  const plinthLine = new THREE.Mesh(new THREE.BoxGeometry(w + 0.85, 0.12, d + 0.85), plinthMat)
  plinthLine.position.set(x, 0.63, z)
  scene.add(plinthLine)

  // ── 腰线（1/3 高度处横向压线，仅中高层建筑）
  if (h >= 8) {
    const waistY = h * 0.32
    const waistMat = new THREE.MeshLambertMaterial({ color: new THREE.Color(roofColor).addScalar(0.06) })
    const waist = new THREE.Mesh(new THREE.BoxGeometry(w + 0.25, 0.18, d + 0.25), waistMat)
    waist.position.set(x, waistY, z)
    scene.add(waist)
    // 腰线下阴影压线
    const shadow = new THREE.Mesh(new THREE.BoxGeometry(w + 0.22, 0.06, d + 0.22),
      new THREE.MeshLambertMaterial({ color: 0x111111 }))
    shadow.position.set(x, waistY - 0.13, z)
    scene.add(shadow)
  }

  // ── 檐口（顶部收边，所有建筑）
  const corniceColor = new THREE.Color(roofColor).addScalar(0.08)
  const corniceMat = new THREE.MeshLambertMaterial({ color: corniceColor })
  const cornice = new THREE.Mesh(new THREE.BoxGeometry(w + 0.5, 0.22, d + 0.5), corniceMat)
  cornice.position.set(x, h + 0.12, z)
  scene.add(cornice)
  // 檐口下阴影压线
  const corniceUnder = new THREE.Mesh(new THREE.BoxGeometry(w + 0.48, 0.08, d + 0.48),
    new THREE.MeshLambertMaterial({ color: 0x0a0a0a }))
  corniceUnder.position.set(x, h - 0.05, z)
  scene.add(corniceUnder)

  // ── 公寓楼专属细节
  if (style === 'apartment') {
    // 斜屋顶（四坡）
    const roofGeo = new THREE.ConeGeometry(Math.max(w, d) * 0.72, h * 0.28, 4)
    const roofMesh = new THREE.Mesh(roofGeo, new THREE.MeshLambertMaterial({ color: 0x6a4828 }))
    roofMesh.position.set(x, h + h * 0.14 + 0.02, z)
    roofMesh.rotation.y = Math.PI / 4
    scene.add(roofMesh)
    // 烟囱
    const chimMat = new THREE.MeshLambertMaterial({ color: 0xbb9977 })
    const chim = new THREE.Mesh(new THREE.BoxGeometry(0.5, h * 0.18, 0.5), chimMat)
    chim.position.set(x + w * 0.2, h + h * 0.27 + h * 0.09, z + d * 0.15)
    scene.add(chim)
    // 阳台（前面每隔一层）
    const floors = Math.floor(h / 3.2)
    const balconyMat = new THREE.MeshLambertMaterial({ color: 0xddd0b8 })
    for (let f = 1; f < floors; f++) {
      const balc = new THREE.Mesh(new THREE.BoxGeometry(w * 0.55, 0.12, 1.3), balconyMat)
      balc.position.set(x, f * 3.2 - 0.06, z + d / 2 + 0.55)
      scene.add(balc)
      // 阳台底板（带颜色差异表现厚度）
      const balcBottom = new THREE.Mesh(new THREE.BoxGeometry(w * 0.55, 0.08, 1.3),
        new THREE.MeshLambertMaterial({ color: 0xbbaa95 }))
      balcBottom.position.set(x, f * 3.2 - 0.2, z + d / 2 + 0.55)
      scene.add(balcBottom)
      // 栏杆
      const railMat = new THREE.MeshLambertMaterial({ color: 0xccbbaa })
      const rail = new THREE.Mesh(new THREE.BoxGeometry(w * 0.55 + 0.08, 0.06, 0.04), railMat)
      rail.position.set(x, f * 3.2 + 0.65, z + d / 2 + 1.1)
      scene.add(rail)
      for (let bi = -2; bi <= 2; bi++) {
        const post = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.7, 0.06), railMat)
        post.position.set(x + bi * (w * 0.55 / 4), f * 3.2 + 0.3, z + d / 2 + 1.1)
        scene.add(post)
      }
    }
    // 外露落水管（侧面）
    const pipeMat = new THREE.MeshLambertMaterial({ color: 0x777777 })
    const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, h * 0.9, 5), pipeMat)
    pipe.position.set(x + w / 2 - 0.25, h * 0.45, z - d / 2 + 0.45)
    scene.add(pipe)
    // 管道弯头
    const elbow = new THREE.Mesh(new THREE.TorusGeometry(0.18, 0.05, 5, 8, Math.PI / 2), pipeMat)
    elbow.rotation.z = Math.PI / 2
    elbow.position.set(x + w / 2 - 0.25, 0.18, z - d / 2 + 0.62)
    scene.add(elbow)
  }

  // ── 塔楼专属细节
  if (style === 'tower') {
    // 天线
    const antMat = new THREE.MeshLambertMaterial({ color: 0x999999 })
    const ant = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.07, h * 0.32, 6), antMat)
    ant.position.set(x, h + h * 0.16, z)
    scene.add(ant)
    const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.13, 6, 6),
      new THREE.MeshLambertMaterial({ color: 0xff2200, emissive: 0xaa1100 }))
    beacon.position.set(x, h + h * 0.32, z)
    scene.add(beacon)
    // 屋顶设备间
    const equip = new THREE.Mesh(
      new THREE.BoxGeometry(w * 0.48, h * 0.09, d * 0.48),
      new THREE.MeshLambertMaterial({ color: 0x1e2e3e })
    )
    equip.position.set(x, h + h * 0.045, z)
    scene.add(equip)
    // 设备间腰线
    const equipLine = new THREE.Mesh(new THREE.BoxGeometry(w * 0.5, 0.1, d * 0.5),
      new THREE.MeshLambertMaterial({ color: 0x0d1a28 }))
    equipLine.position.set(x, h + h * 0.09 + 0.05, z)
    scene.add(equipLine)
    // 空调外机（侧面集群）
    const acMat = new THREE.MeshLambertMaterial({ color: 0x8899aa })
    for (let f = 3; f <= Math.floor(h / 4); f += 3) {
      const ac = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.45, 0.32), acMat)
      ac.position.set(x + w / 2 + 0.14, f * 4 - 1, z + Math.sin(f) * (d / 3))
      scene.add(ac)
      // 散热格栅（细线）
      const grillMat = new THREE.MeshLambertMaterial({ color: 0x667788 })
      for (let g = 0; g < 3; g++) {
        const grill = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.35, 0.28), grillMat)
        grill.position.set(x + w / 2 + 0.32, f * 4 - 1, z + Math.sin(f) * (d / 3) - 0.1 + g * 0.12)
        scene.add(grill)
      }
    }
    // 幕墙竖向装饰肋（正面两侧）
    const ribMat = new THREE.MeshLambertMaterial({ color: new THREE.Color(baseColor).multiplyScalar(0.75) })
    for (const ox of [-w / 2, w / 2]) {
      const rib = new THREE.Mesh(new THREE.BoxGeometry(0.18, h, 0.18), ribMat)
      rib.position.set(x + ox, h / 2, z + d / 2 + 0.07)
      scene.add(rib)
    }
  }

  // ── 商铺专属细节
  if (style === 'shop') {
    // 遮阳棚（带条纹感）
    const awningMat = new THREE.MeshLambertMaterial({ color: 0xbb2f1e })
    const awning = new THREE.Mesh(new THREE.BoxGeometry(w, 0.22, 1.8), awningMat)
    awning.position.set(x, h - 0.5, z + d / 2 + 0.72)
    scene.add(awning)
    // 遮阳棚前缘
    const awningEdge = new THREE.Mesh(new THREE.BoxGeometry(w, 0.35, 0.08),
      new THREE.MeshLambertMaterial({ color: 0x991f10 }))
    awningEdge.position.set(x, h - 0.665, z + d / 2 + 1.58)
    scene.add(awningEdge)
    // 门口台阶
    const stepMat = new THREE.MeshLambertMaterial({ color: 0xbbaa99 })
    const step1 = new THREE.Mesh(new THREE.BoxGeometry(w * 0.38, 0.16, 0.65), stepMat)
    step1.position.set(x, 0.08, z + d / 2 + 0.28)
    scene.add(step1)
    // 招牌灯（柔和暖光）
    const signLight = new THREE.PointLight(0xff7744, 0.9, 7)
    signLight.position.set(x, h + 0.4, z + d / 2 + 0.1)
    scene.add(signLight)
  }

  // ── 仓库专属细节
  if (style === 'warehouse') {
    // 排烟管道
    const chimMat = new THREE.MeshLambertMaterial({ color: 0x4a4a4a })
    const chim = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.33, h * 0.42, 8), chimMat)
    chim.position.set(x + w / 2 - 1.2, h * 0.71, z - d / 2 + 1.5)
    scene.add(chim)
    const chimCap = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.28, 0.28, 8), chimMat)
    chimCap.position.set(x + w / 2 - 1.2, h * 0.71 + h * 0.22, z - d / 2 + 1.5)
    scene.add(chimCap)
    // 第二根管道（稍矮）
    const chim2 = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, h * 0.28, 6), chimMat)
    chim2.position.set(x + w / 2 - 2.8, h * 0.64, z - d / 2 + 1.8)
    scene.add(chim2)
    // 侧面疏散楼梯
    const stairMat = new THREE.MeshLambertMaterial({ color: 0x556677 })
    for (let s = 0; s < 6; s++) {
      const stair = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.12, 0.5), stairMat)
      stair.position.set(x - w / 2 - 0.5, s * 0.85 + 0.42, z + d / 2 - 1.2)
      scene.add(stair)
    }
    // 楼梯扶手
    const handrailMat = new THREE.MeshLambertMaterial({ color: 0x445566 })
    const handrail = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 5.5, 5), handrailMat)
    handrail.rotation.z = Math.PI * 0.08
    handrail.position.set(x - w / 2 - 0.98, 2.8, z + d / 2 - 1.2)
    scene.add(handrail)
  }

  // ── 转角楼专属细节
  if (style === 'corner') {
    // 多层退台屋顶
    const step1 = new THREE.Mesh(
      new THREE.BoxGeometry(w * 0.72, h * 0.11, d * 0.72),
      new THREE.MeshLambertMaterial({ color: roofColor })
    )
    step1.position.set(x, h + h * 0.055 + 0.01, z)
    scene.add(step1)
    const step2 = new THREE.Mesh(
      new THREE.BoxGeometry(w * 0.42, h * 0.1, d * 0.42),
      new THREE.MeshLambertMaterial({ color: new THREE.Color(roofColor).addScalar(0.05).getHex() })
    )
    step2.position.set(x, h + h * 0.16 + 0.02, z)
    scene.add(step2)
    // 屋顶水箱
    const tankMat = new THREE.MeshLambertMaterial({ color: 0x8b7355 })
    const tank = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.72, 1.4, 10), tankMat)
    tank.position.set(x + w * 0.18, h + h * 0.22 + 0.7, z - d * 0.15)
    scene.add(tank)
    const tankRoof = new THREE.Mesh(new THREE.ConeGeometry(0.76, 0.5, 10), tankMat)
    tankRoof.position.set(x + w * 0.18, h + h * 0.22 + 1.65, z - d * 0.15)
    scene.add(tankRoof)
    // 水箱支腿
    const legMat = new THREE.MeshLambertMaterial({ color: 0x5a4a35 })
    for (let i = 0; i < 4; i++) {
      const ang = (i / 4) * Math.PI * 2
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.8, 5), legMat)
      leg.position.set(
        x + w * 0.18 + Math.cos(ang) * 0.55,
        h + h * 0.22 + 0.1,
        z - d * 0.15 + Math.sin(ang) * 0.55
      )
      scene.add(leg)
    }
    // 侧面装饰竖肋
    const stripMat = new THREE.MeshLambertMaterial({ color: 0x5e5e7a })
    for (let i = -1; i <= 1; i += 2) {
      const strip = new THREE.Mesh(new THREE.BoxGeometry(0.18, h, 0.18), stripMat)
      strip.position.set(x + i * (w / 2 - 0.28), h / 2, z + d / 2 + 0.06)
      scene.add(strip)
    }
  }

  return mesh
}

// ─── 道具：树木 ──────────────────────────────────────────────────

const addTree = (scene, tx, tz) => {
  const trunkMat = new THREE.MeshLambertMaterial({ color: 0x4a2e0e })
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.16, 2.6, 7), trunkMat)
  trunk.position.set(tx, 1.3, tz)
  scene.add(trunk)
  const leafColors = [0x2d5a1b, 0x3a6e22, 0x234d14, 0x326218]
  ;[
    { y: 2.5, r: 1.1, s: 7 },
    { y: 3.3, r: 0.82, s: 6 },
    { y: 4.0, r: 0.52, s: 5 },
  ].forEach(({ y, r, s }, i) => {
    const leaves = new THREE.Mesh(
      new THREE.ConeGeometry(r, r * 1.45, s),
      new THREE.MeshLambertMaterial({ color: leafColors[i % leafColors.length] })
    )
    leaves.position.set(tx, y + r * 0.72, tz)
    scene.add(leaves)
  })
  // 树坑围边
  const pitMat = new THREE.MeshLambertMaterial({ color: 0x555544 })
  const pit = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 0.08, 8, 1, true), pitMat)
  pit.position.set(tx, 0.04, tz)
  scene.add(pit)
}

// ─── 道具：垃圾桶 ────────────────────────────────────────────────

const addTrashCan = (scene, tx, tz) => {
  const can = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.16, 0.82, 8), null)
  can.position.set(tx, 0.41, tz)
  scene.add(can)
  makePaintable(can, 0.7, 0.9, (ctx, w, h) => {
    ctx.fillStyle = '#3a5060'
    ctx.fillRect(0, 0, w, h)
    applyWeathering(ctx, w, h)
  })
  const lid = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.09, 8),
    new THREE.MeshLambertMaterial({ color: 0x2a3f50 }))
  lid.position.set(tx, 0.87, tz)
  scene.add(lid)
  return can
}

// ─── 道具：路边车辆 ──────────────────────────────────────────────

const addCar = (scene, cx, cz, colorHex) => {
  const bodyMat = new THREE.MeshLambertMaterial({ color: colorHex })
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.68, 4.2), bodyMat)
  body.position.set(cx, 0.54, cz)
  scene.add(body)
  const hexStr = colorHex.toString(16).padStart(6, '0')
  makePaintable(body, 4.2, 1.2, (ctx, w, h) => {
    ctx.fillStyle = `#${hexStr}`
    ctx.fillRect(0, 0, w, h)
    ctx.fillStyle = 'rgba(255,255,255,0.08)'
    ctx.fillRect(0, 0, w, h * 0.28)
    applyWeathering(ctx, w, h)
  })
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.58, 0.52, 2.2), bodyMat)
  cabin.position.set(cx, 1.08, cz + 0.1)
  scene.add(cabin)
  const winMat = new THREE.MeshLambertMaterial({ color: 0x1a2e44 })
  const winF = new THREE.Mesh(new THREE.BoxGeometry(1.38, 0.36, 0.06), winMat)
  winF.position.set(cx, 1.1, cz + 1.12)
  scene.add(winF)
  const winR = new THREE.Mesh(new THREE.BoxGeometry(1.38, 0.36, 0.06), winMat)
  winR.position.set(cx, 1.1, cz - 1.0)
  scene.add(winR)
  const wheelMat = new THREE.MeshLambertMaterial({ color: 0x111111 })
  ;[[-0.84, -1.35], [0.84, -1.35], [-0.84, 1.35], [0.84, 1.35]].forEach(([wx, wz]) => {
    const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.29, 0.29, 0.2, 8), wheelMat)
    wheel.rotation.z = Math.PI / 2
    wheel.position.set(cx + wx, 0.29, cz + wz)
    scene.add(wheel)
    // 轮毂
    const hubMat = new THREE.MeshLambertMaterial({ color: 0x888888 })
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.22, 6), hubMat)
    hub.rotation.z = Math.PI / 2
    hub.position.set(cx + wx, 0.29, cz + wz)
    scene.add(hub)
  })
  return body
}

// ─── 道具：消火栓 ────────────────────────────────────────────────

const addFireHydrant = (scene, tx, tz) => {
  const mat = new THREE.MeshLambertMaterial({ color: 0xcc2200 })
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.16, 0.55, 8), mat)
  body.position.set(tx, 0.275, tz)
  scene.add(body)
  const top = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.14, 0.16, 8), mat)
  top.position.set(tx, 0.63, tz)
  scene.add(top)
  const cap = new THREE.Mesh(new THREE.SphereGeometry(0.1, 7, 5), mat)
  cap.position.set(tx, 0.75, tz)
  scene.add(cap)
  // 侧耳
  const earMat = new THREE.MeshLambertMaterial({ color: 0xaa1800 })
  ;[-1, 1].forEach(side => {
    const ear = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.18, 6), earMat)
    ear.rotation.z = Math.PI / 2
    ear.position.set(tx + side * 0.2, 0.34, tz)
    scene.add(ear)
  })
}

// ─── 道具：路灯 ──────────────────────────────────────────────────

const addStreetLamp = (scene, lx, lz) => {
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.11, 7.2, 7), null)
  pole.position.set(lx, 3.6, lz)
  scene.add(pole)
  makePaintable(pole, 0.6, 7.2, (ctx, w, h) => {
    ctx.fillStyle = '#777788'
    ctx.fillRect(0, 0, w, h)
    applyWeathering(ctx, w, h)
  })
  const lampMat = new THREE.MeshLambertMaterial({ color: 0x777788 })
  const armDir = lx < 0 ? 1 : -1
  const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 2.3, 5), lampMat)
  arm.rotation.z = Math.PI / 2
  arm.position.set(lx + armDir * 1.05, 7.1, lz)
  scene.add(arm)
  const headMat = new THREE.MeshLambertMaterial({ color: 0xffffee, emissive: 0x887700 })
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.21, 7, 5), headMat)
  head.position.set(lx + armDir * 2.1, 7.0, lz)
  scene.add(head)
  const shade = new THREE.Mesh(
    new THREE.ConeGeometry(0.34, 0.28, 8, 1, true),
    new THREE.MeshLambertMaterial({ color: 0x444455, side: THREE.BackSide })
  )
  shade.position.set(lx + armDir * 2.1, 6.82, lz)
  scene.add(shade)
  const ptLight = new THREE.PointLight(0xffdd88, 1.8, 18)
  ptLight.position.set(lx + armDir * 2.1, 6.8, lz)
  scene.add(ptLight)
  return pole
}

// ─── 道具：电线杆 + 电线 ─────────────────────────────────────────

const addUtilityPole = (scene, px, pz, nextPx, nextPz) => {
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.14, 8.5, 6), null)
  pole.position.set(px, 4.25, pz)
  scene.add(pole)
  makePaintable(pole, 0.7, 8.5, (ctx, w, h) => {
    ctx.fillStyle = '#6b4a28'
    ctx.fillRect(0, 0, w, h)
    applyWeathering(ctx, w, h)
  })
  const poleMat = new THREE.MeshLambertMaterial({ color: 0x6b4a28 })
  // 横担
  const crossMat = new THREE.MeshLambertMaterial({ color: 0x5a3a1a })
  const cross = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.12, 0.12), crossMat)
  cross.position.set(px, 8.2, pz)
  scene.add(cross)
  // 绝缘子（4个）
  const insMat = new THREE.MeshLambertMaterial({ color: 0xcc8800 })
  ;[-0.85, -0.28, 0.28, 0.85].forEach(ox => {
    const ins = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.22, 5), insMat)
    ins.position.set(px + ox, 8.31, pz)
    scene.add(ins)
  })
  // 电线（到下一根杆）
  if (nextPx !== undefined) {
    const wireMat = new THREE.LineBasicMaterial({ color: 0x222222 })
    ;[-0.85, -0.28, 0.28, 0.85].forEach((ox, i) => {
      const sag = 0.4 + i * 0.05  // 垂度
      const pts = []
      for (let t = 0; t <= 12; t++) {
        const alpha = t / 12
        const wx = px + ox + (nextPx + ox - (px + ox)) * alpha
        const wz = pz + (nextPz - pz) * alpha
        const wy = 8.31 - Math.sin(alpha * Math.PI) * sag
        pts.push(new THREE.Vector3(wx, wy, wz))
      }
      const wireGeo = new THREE.BufferGeometry().setFromPoints(pts)
      scene.add(new THREE.Line(wireGeo, wireMat))
    })
  }
  return pole
}

// ─── 道具：路牌 ──────────────────────────────────────────────────

const addStreetSign = (scene, sx, sz, text = 'MAIN ST') => {
  const poleMat = new THREE.MeshLambertMaterial({ color: 0x888888 })
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 3.2, 6), poleMat)
  pole.position.set(sx, 1.6, sz)
  scene.add(pole)
  const signMat = new THREE.MeshLambertMaterial({ color: 0x1a6622 })
  const sign = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.38, 0.06), signMat)
  sign.position.set(sx, 3.1, sz)
  scene.add(sign)
  // 反光白边
  const border = new THREE.Mesh(new THREE.BoxGeometry(1.46, 0.44, 0.04),
    new THREE.MeshLambertMaterial({ color: 0xdddddd }))
  border.position.set(sx, 3.1, sz + 0.01)
  scene.add(border)
  sign.position.z = sz + 0.03
  scene.add(sign)
}

// ─── 道具：报刊亭 ────────────────────────────────────────────────

const addNewsstand = (scene, nx, nz) => {
  const bodyMat = new THREE.MeshLambertMaterial({ color: 0x3355aa })
  const body = new THREE.Mesh(new THREE.BoxGeometry(1.6, 2.0, 1.0), bodyMat)
  body.position.set(nx, 1.0, nz)
  scene.add(body)
  const roofMat = new THREE.MeshLambertMaterial({ color: 0x2244aa })
  const roof = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.12, 1.2), roofMat)
  roof.position.set(nx, 2.06, nz)
  scene.add(roof)
  // 遮阳棚
  const awning = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.08, 0.7),
    new THREE.MeshLambertMaterial({ color: 0xdd4422 }))
  awning.position.set(nx, 1.85, nz + 0.82)
  scene.add(awning)
  // 报刊展示架
  const displayMat = new THREE.MeshLambertMaterial({ color: 0xeeeecc })
  const display = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.6, 0.06), displayMat)
  display.position.set(nx, 1.3, nz + 0.53)
  scene.add(display)
}

// ─── 道具：长凳 ──────────────────────────────────────────────────

const addBench = (scene, bx, bz) => {
  const seat = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.1, 0.5), null)
  seat.position.set(bx, 0.5, bz)
  scene.add(seat)
  makePaintable(seat, 1.8, 0.5, (ctx, w, h) => {
    ctx.fillStyle = '#8B6914'
    ctx.fillRect(0, 0, w, h)
    applyWeathering(ctx, w, h)
  })
  const legMat = new THREE.MeshLambertMaterial({ color: 0x555555 })
  ;[[-0.7, -0.18], [-0.7, 0.18], [0.7, -0.18], [0.7, 0.18]].forEach(([lx, lz]) => {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.5, 0.07), legMat)
    leg.position.set(bx + lx, 0.25, bz + lz)
    scene.add(leg)
  })
  const back = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.38, 0.07),
    new THREE.MeshLambertMaterial({ color: 0x7a5c10 }))
  back.position.set(bx, 0.74, bz - 0.24)
  scene.add(back)
  return seat
}

// ─── 围墙创建 ────────────────────────────────────────────────────

const createWall = (scene, x, z, width, height, depth, rotY = 0) => {
  const makeFace = (w, h) => {
    const offscreen = makeOffscreen(w, h, (ctx, pw, ph) => {
      ctx.fillStyle = '#8a8a9a'
      ctx.fillRect(0, 0, pw, ph)
      ctx.strokeStyle = 'rgba(0,0,0,0.22)'
      ctx.lineWidth = 1.5
      const bh = 14, bw = 28
      for (let y = 0; y < ph; y += bh) {
        const off = Math.floor(y / bh) % 2 === 0 ? 0 : bw / 2
        for (let lx = -bw + off; lx < pw; lx += bw) {
          ctx.strokeRect(lx + 1, y + 1, bw - 2, bh - 2)
        }
      }
      applyWeathering(ctx, pw, ph)
    })
    const texture = new THREE.CanvasTexture(offscreen)
    return { offscreen, texture, wallW: w, wallH: h, hasGraffiti: false }
  }
  const faceFront = makeFace(width, height)
  const faceBack  = makeFace(width, height)
  const faceRight = makeFace(depth, height)
  const faceLeft  = makeFace(depth, height)
  const materials = [
    new THREE.MeshLambertMaterial({ map: faceRight.texture }),
    new THREE.MeshLambertMaterial({ map: faceLeft.texture }),
    new THREE.MeshLambertMaterial({ color: 0x6a6a7a }),
    new THREE.MeshLambertMaterial({ color: 0x111111 }),
    new THREE.MeshLambertMaterial({ map: faceFront.texture }),
    new THREE.MeshLambertMaterial({ map: faceBack.texture }),
  ]
  const geo = new THREE.BoxGeometry(width, height, depth)
  const mesh = new THREE.Mesh(geo, materials)
  mesh.position.set(x, height / 2, z)
  if (rotY) mesh.rotation.y = rotY
  mesh.userData = { isBuilding: true, faces: [faceRight, faceLeft, null, null, faceFront, faceBack] }
  scene.add(mesh)
  return mesh
}

// ─── 大门创建 ────────────────────────────────────────────────────

const createGate = (scene) => {
  const meshes = []
  const GATE_Z = 23
  ;[-6, 6].forEach(px => {
    const pillar = new THREE.Mesh(new THREE.BoxGeometry(1.2, 5.5, 1.2), null)
    pillar.position.set(px, 2.75, GATE_Z)
    scene.add(pillar)
    makePaintable(pillar, 1.2, 5.5, (ctx, w, h) => {
      ctx.fillStyle = '#666688'
      ctx.fillRect(0, 0, w, h)
      applyWeathering(ctx, w, h)
    })
    meshes.push(pillar)
  })
  const beam = new THREE.Mesh(new THREE.BoxGeometry(13.4, 0.4, 1.2),
    new THREE.MeshLambertMaterial({ color: 0x444466 }))
  beam.position.set(0, 5.36, GATE_Z)
  scene.add(beam)
  const signboard = new THREE.Mesh(new THREE.BoxGeometry(12, 1.6, 0.4), null)
  signboard.position.set(0, 4.3, GATE_Z - 0.1)
  scene.add(signboard)
  makePaintable(signboard, 12, 1.6, (ctx, w, h) => {
    const grad = ctx.createLinearGradient(0, 0, w, 0)
    grad.addColorStop(0, '#8a1a0a')
    grad.addColorStop(0.5, '#cc2211')
    grad.addColorStop(1, '#8a1a0a')
    ctx.fillStyle = grad
    ctx.fillRect(0, 0, w, h)
    ctx.fillStyle = 'rgba(255,255,255,0.95)'
    ctx.font = `bold ${Math.round(h * 0.52)}px sans-serif`
    ctx.textAlign = 'center'
    ctx.fillText('GRAFFITI BLOCK', w / 2, h * 0.72)
    ctx.strokeStyle = 'rgba(255,200,150,0.6)'
    ctx.lineWidth = 3
    ctx.strokeRect(4, 4, w - 8, h - 8)
    applyWeathering(ctx, w, h)
  })
  meshes.push(signboard)
  const gateLight = new THREE.PointLight(0xff6644, 1.2, 12)
  gateLight.position.set(0, 5.5, GATE_Z + 1)
  scene.add(gateLight)
  return meshes
}

// ─── 街区场景构建 ────────────────────────────────────────────────

const buildStreetScene = (scene) => {
  const buildingMeshes = []
  const buildingBoxes  = []
  const paintableMeshes = []

  // 外部地面
  const groundCanvas = document.createElement('canvas')
  groundCanvas.width = groundCanvas.height = 512
  const gctx = groundCanvas.getContext('2d')
  gctx.fillStyle = '#252525'
  gctx.fillRect(0, 0, 512, 512)
  gctx.strokeStyle = 'rgba(255,255,255,0.04)'
  gctx.lineWidth = 1
  for (let i = 0; i < 512; i += 32) {
    gctx.beginPath(); gctx.moveTo(i, 0); gctx.lineTo(i, 512); gctx.stroke()
    gctx.beginPath(); gctx.moveTo(0, i); gctx.lineTo(512, i); gctx.stroke()
  }
  const groundTex = new THREE.CanvasTexture(groundCanvas)
  groundTex.wrapS = groundTex.wrapT = THREE.RepeatWrapping
  groundTex.repeat.set(6, 6)
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(100, 100),
    new THREE.MeshLambertMaterial({ map: groundTex, polygonOffset: true, polygonOffsetFactor: 2, polygonOffsetUnits: 2 })
  )
  ground.rotation.x = -Math.PI / 2
  scene.add(ground)

  // 街区内部地面（砖纹）
  const swCanvas = document.createElement('canvas')
  swCanvas.width = swCanvas.height = 256
  const swctx = swCanvas.getContext('2d')
  swctx.fillStyle = '#7a7060'
  swctx.fillRect(0, 0, 256, 256)
  swctx.strokeStyle = 'rgba(0,0,0,0.2)'
  swctx.lineWidth = 1.5
  for (let y = 0; y < 256; y += 28) {
    const off = Math.floor(y / 28) % 2 === 0 ? 0 : 14
    for (let x = -28 + off; x < 256; x += 28) {
      swctx.strokeRect(x + 1, y + 1, 27, 27)
    }
  }
  const swTex = new THREE.CanvasTexture(swCanvas)
  swTex.wrapS = swTex.wrapT = THREE.RepeatWrapping
  swTex.repeat.set(4, 4)
  const innerGround = new THREE.Mesh(
    new THREE.PlaneGeometry(60, 52),
    new THREE.MeshLambertMaterial({ map: swTex, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 })
  )
  innerGround.rotation.x = -Math.PI / 2
  innerGround.position.set(0, 0.005, -3)
  scene.add(innerGround)

  // 街区内部地面可涂鸦层
  const groundOverlay = new THREE.Mesh(new THREE.PlaneGeometry(60, 52), null)
  groundOverlay.rotation.x = -Math.PI / 2
  groundOverlay.position.set(0, 0.02, -3)
  scene.add(groundOverlay)
  makePaintable(groundOverlay, 60, 52, (ctx, pw, ph) => ctx.clearRect(0, 0, pw, ph))
  groundOverlay.material[0].transparent = true
  groundOverlay.material[0].depthWrite = false
  groundOverlay.userData.isGroundSurface = true
  paintableMeshes.push(groundOverlay)

  // 围墙（4面）
  const WALL_H = 4.5, WALL_T = 1.2

  const wallN = createWall(scene, 0, -28.6, 62, WALL_H, WALL_T)
  buildingMeshes.push(wallN)
  buildingBoxes.push({ minX: -31, maxX: 31, minZ: -29.2, maxZ: -28 })

  const wallSL = createWall(scene, -18, 23, 24, WALL_H, WALL_T)
  buildingMeshes.push(wallSL)
  buildingBoxes.push({ minX: -31, maxX: -5.5, minZ: 22.4, maxZ: 23.6 })

  const wallSR = createWall(scene, 18, 23, 24, WALL_H, WALL_T)
  buildingMeshes.push(wallSR)
  buildingBoxes.push({ minX: 5.5, maxX: 31, minZ: 22.4, maxZ: 23.6 })

  const wallE = createWall(scene, 30.6, -3, 52, WALL_H, WALL_T, Math.PI / 2)
  buildingMeshes.push(wallE)
  buildingBoxes.push({ minX: 30, maxX: 32, minZ: -29, maxZ: 24 })

  const wallW = createWall(scene, -30.6, -3, 52, WALL_H, WALL_T, Math.PI / 2)
  buildingMeshes.push(wallW)
  buildingBoxes.push({ minX: -32, maxX: -30, minZ: -29, maxZ: 24 })

  // 大门（入口招牌）
  createGate(scene).forEach(m => paintableMeshes.push(m))

  // 建筑布局（16栋）
  const layout = [
    { type: 'corner',    x: -22, z: -22 },
    { type: 'apartment', x:  -8, z: -22 },
    { type: 'shop',      x:   5, z: -22 },
    { type: 'apartment', x:  20, z: -22 },
    { type: 'tower',     x: -23, z: -13 },
    { type: 'shop',      x:  -8, z: -13 },
    { type: 'apartment', x:   6, z: -13 },
    { type: 'corner',    x:  20, z: -13 },
    { type: 'warehouse', x: -20, z:  -3 },
    { type: 'shop',      x:  -5, z:  -3 },
    { type: 'apartment', x:  10, z:  -3 },
    { type: 'corner',    x:  22, z:  -3 },
    { type: 'apartment', x: -21, z:  10 },
    { type: 'tower',     x:  -5, z:  10 },
    { type: 'shop',      x:  10, z:  10 },
    { type: 'warehouse', x:  22, z:  10 },
  ]

  layout.forEach(({ type, x, z }) => {
    const def = BUILDING_TYPES[type]
    const mesh = createBuilding(scene, def, x, z)
    buildingMeshes.push(mesh)
    const margin = 0.9
    buildingBoxes.push({
      minX: x - def.w / 2 - margin,
      maxX: x + def.w / 2 + margin,
      minZ: z - def.d / 2 - margin,
      maxZ: z + def.d / 2 + margin,
    })
  })

  // 路灯（内部通道）
  ;[
    [-14, -17], [0, -17], [14, -17],
    [-14,  -7], [14,  -7],
    [-14,   5], [0,    5], [14, 5],
  ].forEach(([lx, lz]) => paintableMeshes.push(addStreetLamp(scene, lx, lz)))

  // 电线杆（街区内）
  const poleZs = [-22, -8, 6]
  poleZs.forEach((pz, i) => {
    const nextPz = poleZs[i + 1]
    paintableMeshes.push(addUtilityPole(scene, -14, pz, -14, nextPz))
    paintableMeshes.push(addUtilityPole(scene,  14, pz,  14, nextPz))
  })

  // 消火栓
  ;[
    [-14, -22], [14, -22],
    [-14,  -3], [14,  -3],
  ].forEach(([hx, hz]) => addFireHydrant(scene, hx, hz))

  // 路牌
  addStreetSign(scene, -14, -18, 'BLOCK A')
  addStreetSign(scene,  14, -18, 'BLOCK B')
  addStreetSign(scene, -14,  15, 'PARK ST')
  addStreetSign(scene,  14,  15, 'PARK ST')

  // 报刊亭
  addNewsstand(scene, -13, 18)
  addNewsstand(scene,  13, 18)

  // 树木
  ;[
    [-14, -25], [0, -25], [14, -25],
    [-14, -10], [14, -10],
    [-14,   2], [14,   2],
    [-14,  17], [0,   17], [14, 17],
  ].forEach(([tx, tz]) => addTree(scene, tx, tz))

  // 垃圾桶
  ;[
    [-13, -20], [13, -20],
    [-13,  -5], [13,  -5],
    [-13,  15], [13, 15],
  ].forEach(([tx, tz]) => paintableMeshes.push(addTrashCan(scene, tx, tz)))

  // 长凳
  ;[
    [-10, 18], [10, 18],
    [-13,  0], [13,  0],
  ].forEach(([bx, bz]) => paintableMeshes.push(addBench(scene, bx, bz)))

  // 停放车辆
  ;[
    { cx: -13, cz: -24, color: 0x4466aa },
    { cx:  13, cz: -24, color: 0xaa3322 },
    { cx: -13, cz: -14, color: 0x558833 },
    { cx:  13, cz: -14, color: 0x887755 },
    { cx: -13, cz:   8, color: 0x445566 },
    { cx:  13, cz:   8, color: 0x993344 },
    { cx:  -3, cz: -25, color: 0x776633 },
    { cx:   3, cz: -25, color: 0x334466 },
  ].forEach(({ cx, cz, color }) => paintableMeshes.push(addCar(scene, cx, cz, color)))

  return { buildingMeshes, buildingBoxes, paintableMeshes }
}

// ─── 碰撞检测 ────────────────────────────────────────────────────

const isInsideBuilding = (px, pz, boxes) =>
  boxes.some(b => px > b.minX && px < b.maxX && pz > b.minZ && pz < b.maxZ)

// ─── Hook ─────────────────────────────────────────────────────────

export const useStreetScene = (containerRef, { onWallSelect, onViewModeChange, onLockChange, onStartRoaming }) => {
  const stateRef = useRef({
    renderer: null, scene: null, camera: null, controls: null,
    buildingMeshes: [], buildingBoxes: [], paintableMeshes: [], keys: {}, viewMode: 'fps',
    playerMesh: null, tpsYaw: Math.PI, tpsDragging: false, tpsDragLastX: 0,
    highlightedInfo: null, animId: null, isPainting: false,
  })

  useEffect(() => {
    const s = stateRef.current
    s.onWallSelect = onWallSelect
    s.onViewModeChange = onViewModeChange
    s.onLockChange = onLockChange
    s.onStartRoaming = onStartRoaming
  }, [onWallSelect, onViewModeChange, onLockChange, onStartRoaming])

  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    const s = stateRef.current

    const renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setSize(container.clientWidth, container.clientHeight)
    renderer.shadowMap.enabled = false
    container.appendChild(renderer.domElement)
    s.renderer = renderer

    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0x87ceeb)
    scene.fog = new THREE.FogExp2(0xc9e8f5, 0.008)
    s.scene = scene

    const hemiLight = new THREE.HemisphereLight(0xbfdfff, 0xd4c8a0, 1.2)
    scene.add(hemiLight)
    const sunLight = new THREE.DirectionalLight(0xfff5e0, 2.0)
    sunLight.position.set(40, 60, 20)
    scene.add(sunLight)
    s.dirLight = sunLight
    const fillLight = new THREE.DirectionalLight(0xd0e8ff, 0.4)
    fillLight.position.set(-30, 20, -15)
    scene.add(fillLight)

    const camera = new THREE.PerspectiveCamera(70, container.clientWidth / container.clientHeight, 0.1, 300)
    camera.position.set(0, 1.7, 29)
    s.camera = camera

    const { buildingMeshes, buildingBoxes, paintableMeshes } = buildStreetScene(scene)
    s.buildingMeshes  = buildingMeshes
    s.buildingBoxes   = buildingBoxes
    s.paintableMeshes = paintableMeshes

    // 玩家模型
    const playerGroup = new THREE.Group()
    const bodyMat = new THREE.MeshLambertMaterial({ color: 0xee5522 })
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 1.1, 8), bodyMat)
    body.position.set(0, 0.55, 0)
    playerGroup.add(body)
    const headMesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.26, 8, 8),
      new THREE.MeshLambertMaterial({ color: 0xffccaa })
    )
    headMesh.position.y = 1.45
    playerGroup.add(headMesh)
    const bag = new THREE.Mesh(
      new THREE.BoxGeometry(0.4, 0.5, 0.2),
      new THREE.MeshLambertMaterial({ color: 0x336633 })
    )
    bag.position.set(0, 0.8, 0.22)
    playerGroup.add(bag)
    playerGroup.position.set(0, 0, 8)
    playerGroup.visible = false
    scene.add(playerGroup)
    s.playerMesh = playerGroup

    const controls = new PointerLockControls(camera, renderer.domElement)
    controls.addEventListener('lock', () => s.onLockChange?.(true))
    controls.addEventListener('unlock', () => { if (!s.isPainting) s.onLockChange?.(false) })
    s.controls = controls

    const onMouseDown = (e) => {
      if (s.viewMode === 'tps' && e.button === 0) {
        s.tpsDragging = true; s.tpsDragLastX = e.clientX
      }
    }
    const onMouseMove = (e) => {
      if (s.viewMode === 'tps' && s.tpsDragging) {
        s.tpsYaw += (e.clientX - s.tpsDragLastX) * 0.004
        s.tpsDragLastX = e.clientX
      }
    }
    const onMouseUp = () => { s.tpsDragging = false }
    renderer.domElement.addEventListener('mousedown', onMouseDown)
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
    renderer.domElement.addEventListener('contextmenu', (e) => e.preventDefault())

    const onKeyDown = (e) => {
      s.keys[e.code] = true
      if (e.code === 'KeyV' && !s.isPainting) {
        const next = s.viewMode === 'fps' ? 'tps' : 'fps'
        s.viewMode = next
        s.playerMesh.visible = next === 'tps'
        if (next === 'fps') {
          camera.position.set(s.playerMesh.position.x, 1.7, s.playerMesh.position.z)
          controls.lock()
        } else {
          controls.unlock()
          s.playerMesh.position.set(camera.position.x, 0, camera.position.z)
          s.tpsYaw = Math.PI
        }
        s.onViewModeChange?.(next)
      }
      if (e.code === 'KeyE' && !s.isPainting && s.highlightedInfo) {
        controls.unlock()
        s.isPainting = true
        s.onWallSelect?.(s.highlightedInfo)
      }
      if (e.code === 'KeyR' && !s.isPainting && !s.roamingMode) {
        s.onStartRoaming?.()
      }
    }
    const onKeyUp = (e) => { s.keys[e.code] = false }
    document.addEventListener('keydown', onKeyDown)
    document.addEventListener('keyup', onKeyUp)

    const raycaster = new THREE.Raycaster()
    const center = new THREE.Vector2(0, 0)
    const clamp = (v, a, b) => Math.max(a, Math.min(b, v))

    let time = 0
    const animate = () => {
      s.animId = requestAnimationFrame(animate)
      time += 0.004
      const r = Math.sin(time * 0.25) * 0.5 + 0.5
      s.dirLight.color.setRGB(0.4 + r * 0.5, 0.25 + r * 0.2, 0.7 - r * 0.4)

      // 漫游录制模式：跳过玩家输入，由 useRoamingRecorder 驱动相机
      if (s.roamingMode) {
        renderer.render(scene, camera)
        return
      }

      const speed = 0.12
      const { keys } = s

      if (s.viewMode === 'fps' && controls.isLocked) {
        const prevX = camera.position.x
        const prevZ = camera.position.z
        if (keys['KeyW']) controls.moveForward(speed)
        if (keys['KeyS']) controls.moveForward(-speed)
        camera.position.y = 1.7
        if (isInsideBuilding(camera.position.x, prevZ, s.buildingBoxes)) camera.position.x = prevX
        if (keys['KeyA']) controls.moveRight(-speed)
        if (keys['KeyD']) controls.moveRight(speed)
        camera.position.y = 1.7
        if (isInsideBuilding(camera.position.x, camera.position.z, s.buildingBoxes)) camera.position.z = prevZ
        if (isInsideBuilding(camera.position.x, camera.position.z, s.buildingBoxes)) {
          camera.position.x = prevX; camera.position.z = prevZ
        }
      } else if (s.viewMode === 'tps') {
        const p = s.playerMesh
        const yaw = s.tpsYaw
        const fx = -Math.sin(yaw), fz = -Math.cos(yaw)
        const rx =  Math.cos(yaw), rz = -Math.sin(yaw)
        const prevX = p.position.x, prevZ = p.position.z
        let moved = false
        if (keys['KeyW']) { p.position.x += fx * speed; p.position.z += fz * speed; moved = true }
        if (keys['KeyS']) { p.position.x -= fx * speed; p.position.z -= fz * speed; moved = true }
        if (keys['KeyA']) { p.position.x -= rx * speed; p.position.z -= rz * speed; moved = true }
        if (keys['KeyD']) { p.position.x += rx * speed; p.position.z += rz * speed; moved = true }
        if (moved) {
          if (isInsideBuilding(p.position.x, prevZ, s.buildingBoxes)) p.position.x = prevX
          if (isInsideBuilding(p.position.x, p.position.z, s.buildingBoxes)) p.position.z = prevZ
          if (isInsideBuilding(p.position.x, p.position.z, s.buildingBoxes)) {
            p.position.x = prevX; p.position.z = prevZ
          }
          p.rotation.y = Math.atan2(fx, fz)
        }
        const dist = 6, camH = 3.5
        const targetCamPos = new THREE.Vector3(
          p.position.x + Math.sin(yaw) * dist,
          p.position.y + camH,
          p.position.z + Math.cos(yaw) * dist
        )
        camera.position.lerp(targetCamPos, 0.12)
        camera.lookAt(p.position.x, p.position.y + 1.2, p.position.z)
      }

      camera.position.x = clamp(camera.position.x, -29.5, 29.5)
      camera.position.z = clamp(camera.position.z, -27.5, 35)
      if (s.viewMode === 'tps') {
        s.playerMesh.position.x = clamp(s.playerMesh.position.x, -29.5, 29.5)
        s.playerMesh.position.z = clamp(s.playerMesh.position.z, -27.5, 35)
      }

      if (s.highlightedInfo) {
        const { mesh, faceIndex } = s.highlightedInfo
        const prevMat = Array.isArray(mesh.material) ? mesh.material[faceIndex] : mesh.material
        prevMat?.emissive?.set(0x000000)
        s.highlightedInfo = null
      }

      raycaster.setFromCamera(center, camera)
      const allPaintable = [...s.buildingMeshes, ...s.paintableMeshes].filter(m => m && m.material)
      const hits = raycaster.intersectObjects(allPaintable)
      const hit = hits.find(h => {
        const maxDist = h.object.userData.isGroundSurface ? 14 : 7
        return h.distance < maxDist && h.object.userData.faces?.[h.face.materialIndex]
      })
      if (hit) {
        const faceIndex = hit.face.materialIndex
        const faceInfo = hit.object.userData.faces[faceIndex]
        const hitMat = Array.isArray(hit.object.material) ? hit.object.material[faceIndex] : hit.object.material
        hitMat?.emissive?.set(0x334466)
        s.highlightedInfo = { mesh: hit.object, faceIndex, faceInfo }
      }

      renderer.render(scene, camera)
    }
    animate()

    const onResize = () => {
      const w = container.clientWidth, h = container.clientHeight
      renderer.setSize(w, h); camera.aspect = w / h; camera.updateProjectionMatrix()
    }
    window.addEventListener('resize', onResize)

    return () => {
      cancelAnimationFrame(s.animId)
      controls.dispose()
      document.removeEventListener('keydown', onKeyDown)
      document.removeEventListener('keyup', onKeyUp)
      window.removeEventListener('resize', onResize)
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
      renderer.dispose()
      if (container.contains(renderer.domElement)) container.removeChild(renderer.domElement)
    }
  }, [containerRef])

  const resumeScene = () => {
    const s = stateRef.current
    s.isPainting = false
    if (s.viewMode === 'fps') s.controls?.lock()
  }

  return { resumeScene, stateRef }
}
