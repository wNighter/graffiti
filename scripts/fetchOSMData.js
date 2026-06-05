/**
 * 从 OSM 官方 API 获取指定中心点周边建筑数据
 * 运行：node scripts/fetchOSMData.js
 * 输出：src/data/osmBuildings.json
 *
 * 坐标策略：1:1 真实米坐标，以中心点为原点
 * 查询范围：中心点周边 200×200 米，不过滤建筑，全量还原
 */

import { writeFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { parseStringPromise } from 'xml2js'

const __dirname = dirname(fileURLToPath(import.meta.url))

const CENTER_LAT = 40.7580
const CENTER_LON = -73.9855   // 纽约时代广场（Broadway & 7th Ave, 44th St）
const R = 6371000

// 查询范围：中心点周边 500×500 米（各方向 250m）
const RANGE_M = 250
const avgLatRad = CENTER_LAT * Math.PI / 180
const dLat = RANGE_M / R * (180 / Math.PI)
const dLon = RANGE_M / (R * Math.cos(avgLatRad)) * (180 / Math.PI)
const BBOX = [
  (CENTER_LON - dLon).toFixed(6),
  (CENTER_LAT - dLat).toFixed(6),
  (CENTER_LON + dLon).toFixed(6),
  (CENTER_LAT + dLat).toFixed(6),
].join(',')
const OSM_URL = `https://api.openstreetmap.org/api/0.6/map?bbox=${BBOX}`

function latLonToMeters(lat, lon) {
  const dLon = (lon - CENTER_LON) * Math.PI / 180
  const dLat = (lat - CENTER_LAT) * Math.PI / 180
  return {
    x: dLon * R * Math.cos(avgLatRad),
    z: -dLat * R,
  }
}

function footprintToBox(points) {
  const xs = points.map(p => p.x), zs = points.map(p => p.z)
  const minX = Math.min(...xs), maxX = Math.max(...xs)
  const minZ = Math.min(...zs), maxZ = Math.max(...zs)
  return { cx: (minX + maxX) / 2, cz: (minZ + maxZ) / 2, w: maxX - minX, d: maxZ - minZ }
}

function footprintArea(points) {
  let area = 0
  const n = points.length
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n
    area += points[i].x * points[j].z - points[j].x * points[i].z
  }
  return Math.abs(area) / 2
}

const OSM_TO_STYLE = {
  commercial: 'tower', office: 'tower', hotel: 'tower', skyscraper: 'tower',
  residential: 'apartment', apartments: 'apartment', house: 'apartment', dormitory: 'apartment',
  industrial: 'warehouse', parking: 'warehouse', garage: 'warehouse',
  retail: 'shop', supermarket: 'shop', kiosk: 'shop',
  mixed_use: 'corner', civic: 'corner', public: 'corner', government: 'corner',
}

function resolveStyle(tags, height) {
  if (height > 30) return 'tower'
  if (height <= 6) return 'shop'
  return OSM_TO_STYLE[tags['building'] || ''] || 'apartment'
}

function resolveHeight(tags, style) {
  if (tags['height']) { const h = parseFloat(tags['height']); if (!isNaN(h) && h > 0) return h }
  if (tags['building:levels']) { const l = parseInt(tags['building:levels']); if (!isNaN(l) && l > 0) return l * 3.5 }
  return { tower: 40, apartment: 18, shop: 6, warehouse: 10, corner: 25 }[style] || 15
}

async function main() {
  console.log(`查询范围：中心点 ±${RANGE_M}m（${RANGE_M * 2}×${RANGE_M * 2} 米）`)
  console.log(`BBOX：${BBOX}`)
  console.log('正在从 OSM API 获取建筑数据...')

  const res = await fetch(OSM_URL, { headers: { 'User-Agent': 'graffiti-app/1.0' } })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const xml = await res.text()
  console.log(`收到 XML：${(xml.length / 1024).toFixed(0)} KB`)

  const parsed = await parseStringPromise(xml, { explicitArray: false, mergeAttrs: true })
  const el = parsed.osm

  const nodeMap = {}
  const nodes = Array.isArray(el.node) ? el.node : (el.node ? [el.node] : [])
  nodes.forEach(n => { nodeMap[n.id] = { lat: parseFloat(n.lat), lon: parseFloat(n.lon) } })
  console.log(`节点数：${nodes.length}`)

  const ways = Array.isArray(el.way) ? el.way : (el.way ? [el.way] : [])
  console.log(`way 总数：${ways.length}`)

  const buildings = []

  for (const way of ways) {
    const tags = {}
    const tagArr = Array.isArray(way.tag) ? way.tag : (way.tag ? [way.tag] : [])
    tagArr.forEach(t => { tags[t.k] = t.v })
    if (!tags['building']) continue

    const ndArr = Array.isArray(way.nd) ? way.nd : (way.nd ? [way.nd] : [])
    if (ndArr.length < 4) continue

    const points = ndArr
      .map(nd => nodeMap[nd.ref])
      .filter(Boolean)
      .map(n => latLonToMeters(n.lat, n.lon))
    if (points.length < 3) continue

    const box = footprintToBox(points)
    const area = footprintArea(points)

    const styleTmp = resolveStyle(tags, 15)
    const height = resolveHeight(tags, styleTmp)
    const style = resolveStyle(tags, height)

    // 多边形轮廓（相对于建筑中心的偏移坐标），用于 ExtrudeGeometry 还原真实形状
    const footprint = points.map(p => [
      Math.round((p.x - box.cx) * 10) / 10,
      Math.round((p.z - box.cz) * 10) / 10,
    ])

    buildings.push({
      id: `way/${way.id}`,
      cx: Math.round(box.cx * 10) / 10,
      cz: Math.round(box.cz * 10) / 10,
      w:  Math.round(box.w  * 10) / 10,
      d:  Math.round(box.d  * 10) / 10,
      height: Math.round(height * 10) / 10,
      style,
      area: Math.round(area),
      footprint,
      tags: {
        building: tags.building || '',
        name: tags.name || tags['name:en'] || '',
        height: tags.height || '',
        levels: tags['building:levels'] || '',
      },
    })
  }

  // 按面积降序，便于阅读
  buildings.sort((a, b) => b.area - a.area)
  console.log(`共获取建筑：${buildings.length} 栋（全量，不过滤）`)

  // ── 道路提取（highway 标签的 way）
  const ROAD_TYPES = {
    motorway: 30, trunk: 26, primary: 20, secondary: 16,
    tertiary: 12, residential: 10, service: 6,
    pedestrian: 8, footway: 4, path: 3, cycleway: 3,
  }
  const roads = []
  for (const way of ways) {
    const tags = {}
    const tagArr = Array.isArray(way.tag) ? way.tag : (way.tag ? [way.tag] : [])
    tagArr.forEach(t => { tags[t.k] = t.v })
    const hwType = tags['highway']
    if (!hwType || !(hwType in ROAD_TYPES)) continue

    const ndArr = Array.isArray(way.nd) ? way.nd : (way.nd ? [way.nd] : [])
    const rawPoints = ndArr.map(nd => nodeMap[nd.ref]).filter(Boolean).map(n => latLonToMeters(n.lat, n.lon))
    if (rawPoints.length < 2) continue

    // OSM 返回完整 way，裁剪超出查询范围的点，避免道路线段延伸到场景边界外
    const clippedPoints = rawPoints.filter(p => Math.abs(p.x) <= RANGE_M && Math.abs(p.z) <= RANGE_M)
    if (clippedPoints.length < 2) continue

    roads.push({
      id: `way/${way.id}`,
      type: hwType,
      name: tags['name'] || tags['name:en'] || '',
      width: ROAD_TYPES[hwType],
      points: clippedPoints.map(p => [Math.round(p.x * 10) / 10, Math.round(p.z * 10) / 10]),
    })
  }
  console.log(`共获取道路：${roads.length} 条`)

  // 计算实际坐标范围，加 20m 边距作为世界边界
  const PAD = 20
  const allX = buildings.flatMap(b => [b.cx - b.w / 2, b.cx + b.w / 2])
  const allZ = buildings.flatMap(b => [b.cz - b.d / 2, b.cz + b.d / 2])
  const world = buildings.length > 0
    ? {
        minX: Math.floor(Math.min(...allX)) - PAD,
        maxX: Math.ceil(Math.max(...allX))  + PAD,
        minZ: Math.floor(Math.min(...allZ)) - PAD,
        maxZ: Math.ceil(Math.max(...allZ))  + PAD,
      }
    : { minX: -120, maxX: 120, minZ: -120, maxZ: 120 }

  console.log(`世界范围：X [${world.minX}, ${world.maxX}]  Z [${world.minZ}, ${world.maxZ}]`)

  // 在道路上找一个好的出生点（选第一条主干道的中间点）
  const mainRoad = roads.find(r => ['primary','secondary','tertiary','pedestrian'].includes(r.type))
  let spawnPoint = { x: 0, z: 0 }
  if (mainRoad && mainRoad.points.length >= 2) {
    const mid = Math.floor(mainRoad.points.length / 2)
    spawnPoint = { x: mainRoad.points[mid][0], z: mainRoad.points[mid][1] }
    console.log(`出生点：(${spawnPoint.x}, ${spawnPoint.z})  道路：${mainRoad.name || mainRoad.type}`)
  }
  console.log()

  buildings.slice(0, 20).forEach(b => {
    const name = (b.tags.name || b.id).substring(0, 35)
    console.log(`  [${b.style.padEnd(9)}] cx=${String(b.cx).padStart(7)} cz=${String(b.cz).padStart(7)} w=${String(b.w).padStart(6)} d=${String(b.d).padStart(6)} h=${String(b.height).padStart(6)}m  ${name}`)
  })
  if (buildings.length > 20) console.log(`  ... 共 ${buildings.length} 栋`)

  const output = {
    name: `OSM ${CENTER_LAT},${CENTER_LON} 500m`,
    world,
    spawnPoint,
    center: { lat: CENTER_LAT, lon: CENTER_LON },
    queryDate: new Date().toISOString().slice(0, 10),
    source: 'openstreetmap-api',
    scale: 1,
    buildings,
    roads,
  }

  const outPath = join(__dirname, '..', 'src', 'data', 'osmBuildings.json')
  writeFileSync(outPath, JSON.stringify(output, null, 2), 'utf-8')
  console.log(`\n已写入：${outPath}（共 ${buildings.length} 栋）`)
}

main().catch(e => { console.error(e); process.exit(1) })
