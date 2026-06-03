import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'

// 创建单栋赛博朋克建筑
const createBuilding = (scene, x, z, width, depth, height, color, windowColor) => {
  // 建筑主体（实心半透明）
  const bodyGeo = new THREE.BoxGeometry(width, height, depth)
  const bodyMat = new THREE.MeshPhongMaterial({
    color: 0x050510,
    emissive: color,
    emissiveIntensity: 0.05,
    transparent: true,
    opacity: 0.85,
  })
  const body = new THREE.Mesh(bodyGeo, bodyMat)
  body.position.set(x, height / 2 - 3, z)
  body.castShadow = true
  scene.add(body)

  // 建筑线框外轮廓
  const edgesGeo = new THREE.EdgesGeometry(bodyGeo)
  const edgesMat = new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.8 })
  const edges = new THREE.LineSegments(edgesGeo, edgesMat)
  edges.position.copy(body.position)
  scene.add(edges)

  // 顶部发光天线
  const antennaGeo = new THREE.CylinderGeometry(0.02, 0.02, height * 0.25, 4)
  const antennaMat = new THREE.MeshBasicMaterial({ color: windowColor })
  const antenna = new THREE.Mesh(antennaGeo, antennaMat)
  antenna.position.set(x, height + height * 0.125 - 3, z)
  scene.add(antenna)

  // 顶部信号灯
  const beaconGeo = new THREE.SphereGeometry(0.06, 8, 8)
  const beaconMat = new THREE.MeshBasicMaterial({ color: windowColor })
  const beacon = new THREE.Mesh(beaconGeo, beaconMat)
  beacon.position.set(x, height + height * 0.25 - 3 + 0.06, z)
  scene.add(beacon)

  // 窗户行
  const rows = Math.floor(height / 0.6)
  const cols = Math.floor(width / 0.35)
  const windows = []
  for (let row = 1; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      if (Math.random() < 0.35) continue // 部分窗户不亮
      const winGeo = new THREE.PlaneGeometry(0.18, 0.22)
      const winMat = new THREE.MeshBasicMaterial({
        color: windowColor,
        transparent: true,
        opacity: 0.6 + Math.random() * 0.4,
        side: THREE.DoubleSide,
      })
      const win = new THREE.Mesh(winGeo, winMat)
      const wx = x - width / 2 + 0.25 + col * (width / cols)
      const wy = -3 + row * 0.6 + 0.1
      win.position.set(wx, wy, z + depth / 2 + 0.01)
      windows.push({ mesh: win, baseMat: winMat, phase: Math.random() * Math.PI * 2 })
      scene.add(win)

      // 背面窗户
      const winBack = win.clone()
      winBack.position.set(wx, wy, z - depth / 2 - 0.01)
      winBack.rotation.y = Math.PI
      windows.push({ mesh: winBack, baseMat: winBack.material, phase: Math.random() * Math.PI * 2 })
      scene.add(winBack)
    }
  }

  return { body, edges, beacon, beaconMat, windows }
}

// 创建霓虹招牌
const createNeonSign = (scene, x, y, z, text, color) => {
  const signGeo = new THREE.PlaneGeometry(1.8, 0.45)
  const signMat = new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity: 0.9,
    side: THREE.DoubleSide,
  })
  const sign = new THREE.Mesh(signGeo, signMat)
  sign.position.set(x, y, z)
  scene.add(sign)

  // 边框
  const frameGeo = new THREE.EdgesGeometry(signGeo)
  const frameMat = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.6 })
  const frame = new THREE.LineSegments(frameGeo, frameMat)
  frame.position.copy(sign.position)
  scene.add(frame)

  return { sign, signMat }
}

const useThreeScene = (containerRef, active) => {
  const stateRef = useRef(null)

  useEffect(() => {
    if (!active || !containerRef.current) return

    const container = containerRef.current
    const { clientWidth: w, clientHeight: h } = container

    // --- 渲染器 ---
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false })
    renderer.setSize(w, h)
    renderer.setPixelRatio(window.devicePixelRatio)
    renderer.setClearColor(0x010008, 1)
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFSoftShadowMap
    container.appendChild(renderer.domElement)

    const scene = new THREE.Scene()
    scene.fog = new THREE.FogExp2(0x010008, 0.045)

    const camera = new THREE.PerspectiveCamera(65, w / h, 0.1, 200)
    camera.position.set(0, 4, 14)

    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true
    controls.dampingFactor = 0.05
    controls.maxPolarAngle = Math.PI * 0.72
    controls.target.set(0, 1, 0)

    // --- 地面：反光街道 ---
    const groundGeo = new THREE.PlaneGeometry(60, 60)
    const groundMat = new THREE.MeshPhongMaterial({
      color: 0x050510,
      emissive: 0x1100aa,
      emissiveIntensity: 0.12,
      shininess: 120,
    })
    const ground = new THREE.Mesh(groundGeo, groundMat)
    ground.rotation.x = -Math.PI / 2
    ground.position.y = -3
    ground.receiveShadow = true
    scene.add(ground)

    // 霓虹网格地面
    const gridHelper = new THREE.GridHelper(40, 40, 0x00ffff, 0x220066)
    gridHelper.position.y = -2.99
    scene.add(gridHelper)

    // 大网格
    const gridHelper2 = new THREE.GridHelper(40, 8, 0xff00ff, 0xff00ff)
    gridHelper2.position.y = -2.98
    const gridMat2 = gridHelper2.material
    if (Array.isArray(gridMat2)) {
      gridMat2.forEach(m => { m.opacity = 0.25; m.transparent = true })
    }
    scene.add(gridHelper2)

    // 道路中心线
    const roadLineGeo = new THREE.PlaneGeometry(0.1, 30)
    const roadLineMat = new THREE.MeshBasicMaterial({ color: 0xffff00, transparent: true, opacity: 0.4 })
    const roadLine = new THREE.Mesh(roadLineGeo, roadLineMat)
    roadLine.rotation.x = -Math.PI / 2
    roadLine.position.set(0, -2.97, 0)
    scene.add(roadLine)

    const roadLine2 = roadLine.clone()
    roadLine2.rotation.z = Math.PI / 2
    scene.add(roadLine2)

    // --- 建筑群 ---
    const buildings = []
    const neonSigns = []

    // 中央高楼（主角）
    const mainBuilding = createBuilding(scene, 0, -2, 2.5, 2, 12, 0x00ffff, 0x00ffaa)
    buildings.push(mainBuilding)
    neonSigns.push(createNeonSign(scene, 0, 7.5, -0.98, '', 0x00ffff))
    neonSigns.push(createNeonSign(scene, 0, 6.5, -0.98, '', 0xff00ff))

    // 左侧建筑
    buildings.push(createBuilding(scene, -4, -3, 2, 1.8, 8, 0xff00ff, 0xff44ff))
    buildings.push(createBuilding(scene, -7, -2, 1.5, 1.5, 6, 0x7700ff, 0xaa44ff))
    buildings.push(createBuilding(scene, -3, -5, 1.8, 1.6, 10, 0x00ffff, 0x44ffff))
    buildings.push(createBuilding(scene, -6, -6, 1.2, 1.2, 5, 0xff6600, 0xff8800))

    // 右侧建筑
    buildings.push(createBuilding(scene, 4, -3, 2, 1.8, 9, 0xff00ff, 0xff00aa))
    buildings.push(createBuilding(scene, 7, -2, 1.5, 1.5, 7, 0x00ffcc, 0x00ffcc))
    buildings.push(createBuilding(scene, 3, -6, 1.8, 1.6, 6, 0xff4400, 0xff6600))
    buildings.push(createBuilding(scene, 6, -5, 1.2, 1.2, 4, 0xffff00, 0xffff44))

    // 背景远景建筑
    buildings.push(createBuilding(scene, -9, -8, 3, 2, 7, 0x330099, 0x6600ff))
    buildings.push(createBuilding(scene, 9, -8, 3, 2, 8, 0x009933, 0x00ff66))
    buildings.push(createBuilding(scene, 0, -9, 4, 2.5, 5, 0x660033, 0xff0066))

    // 霓虹招牌（挂在建筑侧面）
    neonSigns.push(createNeonSign(scene, -4.9, 2.5, -2, '', 0xff00ff))
    neonSigns.push(createNeonSign(scene, 4.9, 3.5, -2, '', 0x00ffcc))
    neonSigns.push(createNeonSign(scene, -3.9, 4.5, -4, '', 0xff4400))
    neonSigns.push(createNeonSign(scene, 3.9, 2, -5, '', 0xffff00))

    // --- 雨丝粒子 ---
    const rainCount = 3000
    const rainPos = new Float32Array(rainCount * 3)
    for (let i = 0; i < rainCount; i++) {
      rainPos[i * 3] = (Math.random() - 0.5) * 40
      rainPos[i * 3 + 1] = Math.random() * 25 - 5
      rainPos[i * 3 + 2] = (Math.random() - 0.5) * 40
    }
    const rainGeo = new THREE.BufferGeometry()
    rainGeo.setAttribute('position', new THREE.BufferAttribute(rainPos, 3))
    const rainMat = new THREE.PointsMaterial({
      color: 0x88aaff,
      size: 0.04,
      transparent: true,
      opacity: 0.35,
    })
    const rain = new THREE.Points(rainGeo, rainMat)
    scene.add(rain)

    // --- 霓虹粒子光晕 ---
    const glowCount = 800
    const glowPos = new Float32Array(glowCount * 3)
    const glowCol = new Float32Array(glowCount * 3)
    const cyan = new THREE.Color(0x00ffff)
    const magenta = new THREE.Color(0xff00ff)
    const purple = new THREE.Color(0x7700ff)
    const palette = [cyan, magenta, purple]

    for (let i = 0; i < glowCount; i++) {
      const r = 6 + Math.random() * 8
      const theta = Math.random() * Math.PI * 2
      glowPos[i * 3] = Math.cos(theta) * r
      glowPos[i * 3 + 1] = (Math.random() - 0.3) * 12
      glowPos[i * 3 + 2] = Math.sin(theta) * r - 5
      const c = palette[Math.floor(Math.random() * palette.length)]
      glowCol[i * 3] = c.r; glowCol[i * 3 + 1] = c.g; glowCol[i * 3 + 2] = c.b
    }

    const glowGeo = new THREE.BufferGeometry()
    glowGeo.setAttribute('position', new THREE.BufferAttribute(glowPos, 3))
    glowGeo.setAttribute('color', new THREE.BufferAttribute(glowCol, 3))
    const glowMat = new THREE.PointsMaterial({ size: 0.08, vertexColors: true, transparent: true, opacity: 0.7 })
    const glowParticles = new THREE.Points(glowGeo, glowMat)
    scene.add(glowParticles)

    // --- 光源 ---
    const ambientLight = new THREE.AmbientLight(0x110022, 0.5)
    scene.add(ambientLight)

    const light1 = new THREE.PointLight(0x00ffff, 4, 20)
    light1.position.set(0, 6, -2)
    scene.add(light1)

    const light2 = new THREE.PointLight(0xff00ff, 3, 18)
    light2.position.set(-5, 3, 0)
    scene.add(light2)

    const light3 = new THREE.PointLight(0x7700ff, 3, 18)
    light3.position.set(5, 3, 0)
    scene.add(light3)

    const streetLight1 = new THREE.PointLight(0xff4400, 2, 8)
    streetLight1.position.set(-3, -1, 2)
    scene.add(streetLight1)

    const streetLight2 = new THREE.PointLight(0x0044ff, 2, 8)
    streetLight2.position.set(3, -1, 2)
    scene.add(streetLight2)

    // --- 动画循环 ---
    let rafId
    let t = 0
    const rainArray = rainGeo.attributes.position.array

    const animate = () => {
      rafId = requestAnimationFrame(animate)
      t += 0.01

      // 雨丝下落
      for (let i = 0; i < rainCount; i++) {
        rainArray[i * 3 + 1] -= 0.18
        if (rainArray[i * 3 + 1] < -5) {
          rainArray[i * 3 + 1] = 20
        }
      }
      rainGeo.attributes.position.needsUpdate = true

      // 环境光晕微旋
      glowParticles.rotation.y += 0.0005

      // 光源呼吸
      light1.intensity = 3.5 + Math.sin(t * 1.5) * 1.5
      light2.intensity = 2.5 + Math.sin(t * 2.1 + 1) * 1
      light3.intensity = 2.5 + Math.cos(t * 1.7 + 2) * 1

      // 建筑顶部信号灯闪烁
      buildings.forEach(({ beaconMat }, i) => {
        if (beaconMat) {
          beaconMat.color.setHSL((t * 0.1 + i * 0.15) % 1, 1, 0.5 + Math.abs(Math.sin(t * 2 + i)) * 0.3)
        }
      })

      // 窗户闪烁
      buildings.forEach(({ windows }) => {
        windows.forEach(({ mesh, baseMat, phase }) => {
          mesh.material.opacity = 0.3 + Math.abs(Math.sin(t * 0.5 + phase)) * 0.65
        })
      })

      // 霓虹招牌闪烁
      neonSigns.forEach(({ signMat }, i) => {
        signMat.opacity = 0.6 + Math.abs(Math.sin(t * 1.2 + i * 0.8)) * 0.35
      })

      controls.update()
      renderer.render(scene, camera)
    }
    animate()

    // --- 响应式尺寸 ---
    const onResize = () => {
      const { clientWidth: nw, clientHeight: nh } = container
      camera.aspect = nw / nh
      camera.updateProjectionMatrix()
      renderer.setSize(nw, nh)
    }
    window.addEventListener('resize', onResize)

    stateRef.current = { renderer, rafId, onResize }

    return () => {
      cancelAnimationFrame(rafId)
      window.removeEventListener('resize', onResize)
      controls.dispose()
      renderer.dispose()
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement)
      }
      stateRef.current = null
    }
  }, [active, containerRef])
}

export default useThreeScene
