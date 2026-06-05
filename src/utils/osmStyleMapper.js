const OSM_TO_STYLE = {
  commercial: 'tower',
  office: 'tower',
  hotel: 'tower',
  skyscraper: 'tower',
  residential: 'apartment',
  apartments: 'apartment',
  house: 'apartment',
  dormitory: 'apartment',
  industrial: 'warehouse',
  parking: 'warehouse',
  garage: 'warehouse',
  storage: 'warehouse',
  retail: 'shop',
  supermarket: 'shop',
  kiosk: 'shop',
  restaurant: 'shop',
  mixed_use: 'corner',
  civic: 'corner',
  public: 'corner',
  government: 'corner',
  cathedral: 'corner',
  church: 'corner',
}

/**
 * 根据 OSM 标签和解析后高度，返回 BUILDING_TYPES 的 key
 */
export function resolveStyle(tags, height) {
  if (height > 30) return 'tower'
  if (height <= 6) return 'shop'

  const osmType = tags['building'] || tags['amenity'] || ''
  return OSM_TO_STYLE[osmType] || 'apartment'
}

/**
 * 从 OSM 标签解析建筑高度（米）
 */
export function resolveHeight(tags, styleFallback) {
  if (tags['height']) {
    const h = parseFloat(tags['height'])
    if (!isNaN(h) && h > 0) return h
  }
  if (tags['building:levels']) {
    const levels = parseInt(tags['building:levels'])
    if (!isNaN(levels) && levels > 0) return levels * 3.5
  }
  // 按风格给兜底高度
  const defaults = { tower: 25, apartment: 12, shop: 5, warehouse: 8, corner: 18 }
  return defaults[styleFallback] || 10
}
