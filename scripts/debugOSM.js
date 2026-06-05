// 调试 OSM XML 解析
import { parseStringPromise } from 'xml2js'

const CENTER_LAT = 40.7580, CENTER_LON = -73.9855, R = 6371000

function latLonToMeters(lat, lon) {
  const dLon = (lon - CENTER_LON) * Math.PI / 180
  const dLat = (lat - CENTER_LAT) * Math.PI / 180
  const avgLat = CENTER_LAT * Math.PI / 180
  return { x: dLon * R * Math.cos(avgLat), z: -dLat * R }
}

const BBOX = '-73.9915,40.7535,-73.9795,40.7625'
const xml = await (await fetch(`https://api.openstreetmap.org/api/0.6/map?bbox=${BBOX}`, {
  headers: { 'User-Agent': 'graffiti-debug/1.0' }
})).text()

console.log(`XML 长度: ${(xml.length/1024).toFixed(0)} KB`)

const parsed = await parseStringPromise(xml, { explicitArray: false, mergeAttrs: true })
const el = parsed.osm

// 检查 node 结构
const nodes = Array.isArray(el.node) ? el.node : (el.node ? [el.node] : [])
console.log(`\n节点总数: ${nodes.length}`)
console.log('前3个节点结构:', JSON.stringify(nodes.slice(0, 3), null, 2))

// 检查 way 结构
const ways = Array.isArray(el.way) ? el.way : (el.way ? [el.way] : [])
const buildingWays = ways.filter(w => {
  const tagArr = Array.isArray(w.tag) ? w.tag : (w.tag ? [w.tag] : [])
  return tagArr.some(t => t.k === 'building')
})
console.log(`\nway 总数: ${ways.length}, 建筑 way: ${buildingWays.length}`)
if (buildingWays.length > 0) {
  console.log('第1栋建筑 way 结构:', JSON.stringify(buildingWays[0], null, 2))
}
