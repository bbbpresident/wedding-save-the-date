import './style.css'
import saveTheDatePhoto from './assets/savethedate_vector.png'

let CARD_W = window.innerWidth
let CARD_H = window.innerHeight
const BRUSH_RADIUS = 36

function buildDOM(photoSrc: string): { canvas: HTMLCanvasElement } {
  CARD_W = window.innerWidth
  CARD_H = window.innerHeight

  const app = document.getElementById('app')!

  // Card at original proportions, centered in viewport
  const scene = document.createElement('div')
  scene.className = 'relative cursor-crosshair select-none'

  const card = document.createElement('div')
  card.className = 'card-reveal w-[min(calc(100vw-40px),calc(100vh*2347/3390))] aspect-[2347/3390] rounded-[4px] relative overflow-hidden bg-center bg-[length:100%_100%] bg-[#3f0d0d]'
  card.style.backgroundImage = `url(${photoSrc})`

  scene.appendChild(card)
  app.appendChild(scene)

  // Full-screen scratch canvas overlaid on top of everything
  const canvas = document.createElement('canvas')
  canvas.className = 'fixed inset-0 z-10 touch-none cursor-crosshair'
  canvas.width = CARD_W
  canvas.height = CARD_H

  app.appendChild(canvas)

  return { canvas }
}

function drawScratchLayer(ctx: CanvasRenderingContext2D) {
  const gradient = ctx.createLinearGradient(0, 0, CARD_W, CARD_H)
  gradient.addColorStop(0, '#f0ece6')
  gradient.addColorStop(0.4, '#faf8f5')
  gradient.addColorStop(0.7, '#ede9e3')
  gradient.addColorStop(1, '#f5f1eb')
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, CARD_W, CARD_H)

  for (let i = 0; i < 8000; i++) {
    const x = Math.random() * CARD_W
    const y = Math.random() * CARD_H
    ctx.fillStyle = `rgba(180,165,140,${Math.random() * 0.04})`
    ctx.fillRect(x, y, 1, 1)
  }

  ctx.save()
  ctx.translate(CARD_W / 2, CARD_H / 2)
  ctx.font = '300 20px Montserrat, sans-serif'
  ctx.fillStyle = 'rgba(140,125,105,0.55)'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText('something awaits', 0, 0)
  ctx.fillText('click here.', 0, 20)
  ctx.restore()

  ctx.strokeStyle = 'rgba(201,169,110,0.25)'
  ctx.lineWidth = 1.5
  ctx.strokeRect(1, 1, CARD_W - 2, CARD_H - 2)
}

function getCanvasPos(canvas: HTMLCanvasElement, clientX: number, clientY: number): { x: number; y: number } {
  const rect = canvas.getBoundingClientRect()

  // Center of the rotated element in screen coords (bounding box center = element center)
  const cx = rect.left + rect.width / 2
  const cy = rect.top + rect.height / 2

  // Offset from center in screen space
  const dx = clientX - cx
  const dy = clientY - cy

  // Rotate back by -30° to get canvas-local offset from center
  const rad = 0 * (Math.PI / 180)
  const lx = dx * Math.cos(rad) - dy * Math.sin(rad)
  const ly = dx * Math.sin(rad) + dy * Math.cos(rad)

  // Canvas displays at its natural size (CARD_W × CARD_H), so no scaling needed
  return {
    x: lx + CARD_W / 2,
    y: ly + CARD_H / 2,
  }
}

function scratch(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.globalCompositeOperation = 'destination-out'
  const grad = ctx.createRadialGradient(x, y, 0, x, y, BRUSH_RADIUS)
  grad.addColorStop(0, 'rgba(0,0,0,1)')
  grad.addColorStop(0.9, 'rgba(0,0,0,0.9)')
  grad.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.fillStyle = grad
  ctx.beginPath()
  ctx.arc(x, y, BRUSH_RADIUS, 0, Math.PI * 2)
  ctx.fill()
  ctx.globalCompositeOperation = 'source-over'
}

function scratchLine(
  ctx: CanvasRenderingContext2D,
  from: { x: number; y: number },
  to: { x: number; y: number }
) {
  const dist = Math.hypot(to.x - from.x, to.y - from.y)
  const steps = Math.max(1, Math.ceil(dist / (BRUSH_RADIUS * 0.4)))
  for (let i = 0; i <= steps; i++) {
    const t = i / steps
    scratch(ctx, from.x + (to.x - from.x) * t, from.y + (to.y - from.y) * t)
  }
}

function getRevealedFraction(ctx: CanvasRenderingContext2D): number {
  const data = ctx.getImageData(0, 0, CARD_W, CARD_H).data
  let transparent = 0
  // sample every 32nd pixel (alpha channel) for performance
  for (let i = 3; i < data.length; i += 4 * 32) {
    if (data[i] < 128) transparent++
  }
  return transparent / Math.floor((CARD_W * CARD_H) / 32)
}

function init() {
  const { canvas } = buildDOM(saveTheDatePhoto)
  const ctx = canvas.getContext('2d')!
  drawScratchLayer(ctx)

  let lastPos: { x: number; y: number } | null = null
  let done = false
  let lastCheck = 0

  function afterScratch() {
    if (done) return
    const now = Date.now()
    if (now - lastCheck < 150) return
    lastCheck = now
    if (getRevealedFraction(ctx) >= 0.3) {
      done = true
      canvas.style.transition = 'opacity 2s ease'
      canvas.style.opacity = '0'
      canvas.addEventListener('transitionend', () => canvas.remove(), { once: true })
    }
  }

  canvas.addEventListener('pointermove', (e) => {
    if (done) return
    const pos = getCanvasPos(canvas, e.clientX, e.clientY)
    if (lastPos) scratchLine(ctx, lastPos, pos)
    else scratch(ctx, pos.x, pos.y)
    lastPos = pos
    afterScratch()
  })

  canvas.addEventListener('pointerleave', () => {
    lastPos = null
  })

  canvas.addEventListener('touchstart', (e) => {
    e.preventDefault()
    const t = e.touches[0]
    const pos = getCanvasPos(canvas, t.clientX, t.clientY)
    lastPos = pos
    scratch(ctx, pos.x, pos.y)
  }, { passive: false })

  canvas.addEventListener('touchmove', (e) => {
    e.preventDefault()
    if (done) return
    const t = e.touches[0]
    const pos = getCanvasPos(canvas, t.clientX, t.clientY)
    if (lastPos) scratchLine(ctx, lastPos, pos)
    lastPos = pos
    afterScratch()
  }, { passive: false })

  canvas.addEventListener('touchend', () => { lastPos = null })
}

init()
