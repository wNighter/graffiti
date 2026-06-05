// 街区数据加载器
// 从 URL 参数 ?district=<id> 读取街区，无需修改代码即可扩展新街区
//
// 支持三种来源：
//   1. 内置默认（无参数） → 使用 osmBuildings.json 打包数据
//   2. 本地文件（?district=soho） → fetch /districts/soho.json（放 public/districts/）
//   3. 外部 URL（?district=https://...） → 直接 fetch

import defaultDistrict from './osmBuildings.json'

const getDistrictParam = () => {
  try {
    return new URLSearchParams(window.location.search).get('district')
  } catch {
    return null
  }
}

export const loadDistrict = async () => {
  const param = getDistrictParam()

  if (!param) return defaultDistrict

  // 外部 URL
  if (param.startsWith('http://') || param.startsWith('https://') || param.startsWith('/')) {
    const res = await fetch(param)
    if (!res.ok) throw new Error(`Failed to load district: ${param} (${res.status})`)
    return res.json()
  }

  // 本地 /districts/<id>.json（放在 public 目录）
  const res = await fetch(`/districts/${param}.json`)
  if (!res.ok) throw new Error(`District not found: ${param}`)
  return res.json()
}

// 从街区数据中提取世界范围（兼容旧格式）
export const getWorldBounds = (district) => {
  if (district.world) return district.world
  // 旧格式没有 world 字段时，从建筑坐标自动推导
  const xs = district.buildings.flatMap(b => [b.cx - b.w / 2, b.cx + b.w / 2])
  const zs = district.buildings.flatMap(b => [b.cz - b.d / 2, b.cz + b.d / 2])
  const pad = 60
  return {
    minX: Math.min(...xs) - pad,
    maxX: Math.max(...xs) + pad,
    minZ: Math.min(...zs) - pad,
    maxZ: Math.max(...zs) + pad,
  }
}
