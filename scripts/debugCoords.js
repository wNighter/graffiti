// 验证坐标转换和建筑分布
const CENTER_LAT = 40.7580, CENTER_LON = -73.9855, R = 6371000

function latLonToMeters(lat, lon) {
  const dLon = (lon - CENTER_LON) * Math.PI / 180
  const dLat = (lat - CENTER_LAT) * Math.PI / 180
  const avgLat = CENTER_LAT * Math.PI / 180
  return { x: dLon * R * Math.cos(avgLat), z: -dLat * R }
}

// 已知时代广场建筑
const testPoints = [
  { name: "One Times Square",   lat: 40.7577, lon: -73.9857 },
  { name: "4 Times Square",     lat: 40.7565, lon: -73.9868 },
  { name: "Marriott Marquis",   lat: 40.7591, lon: -73.9860 },
  { name: "7 Times Square",     lat: 40.7566, lon: -73.9858 },
  { name: "BBOX Center",        lat: 40.7580, lon: -73.9855 },
  { name: "BBOX SW corner",     lat: 40.7535, lon: -73.9915 },
  { name: "BBOX NE corner",     lat: 40.7625, lon: -73.9795 },
]
console.log("=== 坐标转换验证 ===")
testPoints.forEach(p => {
  const m = latLonToMeters(p.lat, p.lon)
  console.log(`${p.name.padEnd(22)}: x=${m.x.toFixed(1).padStart(7)}, z=${m.z.toFixed(1).padStart(7)}`)
})
console.log("\nBBOX 覆盖范围:")
const sw = latLonToMeters(40.7535, -73.9915)
const ne = latLonToMeters(40.7625, -73.9795)
console.log(`X: ${sw.x.toFixed(0)} ~ ${ne.x.toFixed(0)} 米`)
console.log(`Z: ${ne.z.toFixed(0)} ~ ${sw.z.toFixed(0)} 米`)
console.log(`\n场景过滤 |cx|<44 && |cz|<37 范围内应有大量建筑`)
