import { useEffect, useRef } from 'react'

/**
 * useCanvas2D - 在 canvas ref 上运行鼠标追踪粒子效果
 * active: false 时停止动画
 */
const useCanvas2D = (canvasRef, active) => {
  const stateRef = useRef(null)

  useEffect(() => {
    if (!active || !canvasRef.current) return

    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')

    // 设置真实像素尺寸
    const resize = () => {
      canvas.width = canvas.offsetWidth * window.devicePixelRatio
      canvas.height = canvas.offsetHeight * window.devicePixelRatio
      ctx.scale(window.devicePixelRatio, window.devicePixelRatio)
    }
    resize()
    window.addEventListener('resize', resize)

    const mouse = { x: canvas.offsetWidth / 2, y: canvas.offsetHeight / 2 }
    const onMouseMove = (e) => {
      const rect = canvas.getBoundingClientRect()
      mouse.x = e.clientX - rect.left
      mouse.y = e.clientY - rect.top
    }
    window.addEventListener('mousemove', onMouseMove)

    // --- 粒子系统 ---
    const PARTICLE_COUNT = 120
    const particles = Array.from({ length: PARTICLE_COUNT }, () => createParticle(canvas))

    let rafId
    const draw = () => {
      rafId = requestAnimationFrame(draw)
      const w = canvas.offsetWidth
      const h = canvas.offsetHeight

      // 残影效果
      ctx.fillStyle = 'rgba(10, 10, 15, 0.18)'
      ctx.fillRect(0, 0, w, h)

      particles.forEach((p) => {
        // 向鼠标方向吸引
        const dx = mouse.x - p.x
        const dy = mouse.y - p.y
        const dist = Math.sqrt(dx * dx + dy * dy) || 1
        const force = Math.min(80 / (dist * dist), 0.6)
        p.vx += dx * force * 0.01
        p.vy += dy * force * 0.01

        // 阻尼
        p.vx *= 0.96
        p.vy *= 0.96

        p.x += p.vx
        p.y += p.vy

        // 边界环绕
        if (p.x < 0) p.x = w
        if (p.x > w) p.x = 0
        if (p.y < 0) p.y = h
        if (p.y > h) p.y = 0

        // 绘制
        const alpha = 0.4 + Math.min(Math.sqrt(p.vx ** 2 + p.vy ** 2) * 0.15, 0.6)
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2)
        ctx.fillStyle = `hsla(${p.hue}, 80%, 70%, ${alpha})`
        ctx.fill()
      })
    }
    draw()

    stateRef.current = { rafId, onMouseMove, resize }

    return () => {
      cancelAnimationFrame(rafId)
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('resize', resize)
      stateRef.current = null
    }
  }, [active, canvasRef])
}

const createParticle = (canvas) => ({
  x: Math.random() * canvas.offsetWidth,
  y: Math.random() * canvas.offsetHeight,
  vx: (Math.random() - 0.5) * 2,
  vy: (Math.random() - 0.5) * 2,
  radius: Math.random() * 2 + 1,
  hue: Math.random() * 60 + 240, // 蓝紫色调
})

export default useCanvas2D
