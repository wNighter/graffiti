// 时代广场中心坐标（作为本地坐标系原点）
const CENTER_LAT = 40.7580
const CENTER_LON = -73.9855  // 纽约时代广场（Broadway & 7th Ave, 42nd-47th St）
const R = 6371000 // 地球半径（米）

/**
 * WGS84 经纬度 → 本地平面坐标（米）
 * Three.js 坐标系：东西 → X，南北 → -Z（北为负Z）
 */
export function latLonToMeters(lat, lon) {
  const dLon = (lon - CENTER_LON) * Math.PI / 180
  const dLat = (lat - CENTER_LAT) * Math.PI / 180
  const avgLat = CENTER_LAT * Math.PI / 180
  return {
    x: dLon * R * Math.cos(avgLat),
    z: -dLat * R,
  }
}

export { CENTER_LAT, CENTER_LON }
