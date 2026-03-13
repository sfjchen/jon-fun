'use client'

import React, { useState, useCallback, useRef, useEffect, useImperativeHandle, forwardRef } from 'react'
import Link from 'next/link'
import html2canvas from 'html2canvas'

const BRUSH_BLUE = '#60a5fa'
const BRUSH_YELLOW = '#fbbf24'

export type SkyPaintCanvasHandle = { exportAs: (format: 'png' | 'jpeg') => Promise<Blob | null> }

const SkyPaintCanvas = forwardRef<SkyPaintCanvasHandle, {
  enabled: boolean
  canvasVisible?: boolean
  brushColor: 'blue' | 'yellow'
  blendMode?: 'normal' | 'multiply' | 'overlay' | 'screen'
  paintPhase?: 'blue' | 'yellow'
  onFirstStroke?: () => void
  onStrokeCount?: (blue: number, yellow: number) => void
  className?: string
}>(function SkyPaintCanvas({
  enabled,
  canvasVisible,
  brushColor,
  blendMode,
  paintPhase,
  onFirstStroke,
  onStrokeCount,
  className,
}: {
  enabled: boolean
  canvasVisible?: boolean
  brushColor: 'blue' | 'yellow'
  blendMode?: 'normal' | 'multiply' | 'overlay' | 'screen'
  paintPhase?: 'blue' | 'yellow'
  onFirstStroke?: () => void
  onStrokeCount?: (blue: number, yellow: number) => void
  className?: string
}, ref) {
  const show = canvasVisible ?? enabled
  const containerRef = useRef<HTMLDivElement>(null)
  const blueRef = useRef<HTMLCanvasElement>(null)
  const yellowRef = useRef<HTMLCanvasElement>(null)
  const isDrawingRef = useRef(false)
  const blueStrokeCountRef = useRef(0)
  const yellowStrokeCountRef = useRef(0)
  const hasAdvancedRef = useRef(false)
  const strokeColorRef = useRef<'blue' | 'yellow'>('blue')
  const prevPhaseRef = useRef<'blue' | 'yellow' | undefined>(undefined)
  if (prevPhaseRef.current !== paintPhase) {
    prevPhaseRef.current = paintPhase
    hasAdvancedRef.current = false
  }

  const setupCanvas = useCallback((canvas: HTMLCanvasElement | null) => {
    if (!show || !containerRef.current || !canvas) return
    const container = containerRef.current
    const rect = container.getBoundingClientRect()
    const dpr = window.devicePixelRatio || 1
    const w = Math.floor(rect.width * dpr)
    const h = Math.floor(rect.height * dpr)
    const needsResize = canvas.width !== w || canvas.height !== h
    if (needsResize) {
      canvas.width = w
      canvas.height = h
      canvas.style.width = `${rect.width}px`
      canvas.style.height = `${rect.height}px`
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      ctx.scale(dpr, dpr)
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
      ctx.lineWidth = 24
    } else {
      canvas.style.width = `${rect.width}px`
      canvas.style.height = `${rect.height}px`
    }
  }, [show])

  useEffect(() => {
    setupCanvas(blueRef.current)
    setupCanvas(yellowRef.current)
    if (!containerRef.current) return
    const ro = new ResizeObserver(() => {
      setupCanvas(blueRef.current)
      setupCanvas(yellowRef.current)
    })
    ro.observe(containerRef.current)
    return () => ro.disconnect()
  }, [show, setupCanvas])

  const getPos = (e: React.PointerEvent | PointerEvent) => {
    if (!containerRef.current) return null
    const rect = containerRef.current.getBoundingClientRect()
    return { x: e.clientX - rect.left, y: e.clientY - rect.top }
  }

  const getCtx = (color: 'blue' | 'yellow') => {
    const canvas = color === 'blue' ? blueRef.current : yellowRef.current
    return canvas?.getContext('2d')
  }

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (!enabled || !containerRef.current) return
      e.preventDefault()
      e.stopPropagation()
      yellowRef.current?.setPointerCapture?.(e.pointerId)
      const pos = getPos(e)
      if (!pos) return
      strokeColorRef.current = brushColor
      isDrawingRef.current = true
      const ctx = getCtx(brushColor)
      if (!ctx) return
      ctx.strokeStyle = brushColor === 'blue' ? BRUSH_BLUE : BRUSH_YELLOW
      ctx.beginPath()
      ctx.moveTo(pos.x, pos.y)
    },
    [enabled, brushColor]
  )

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!enabled || !isDrawingRef.current) return
      e.preventDefault()
      e.stopPropagation()
      const pos = getPos(e)
      if (!pos) return
      const ctx = getCtx(strokeColorRef.current)
      if (!ctx) return
      ctx.lineTo(pos.x, pos.y)
      ctx.stroke()
    },
    [enabled]
  )

  const handlePointerUp = useCallback(
    (e: React.PointerEvent) => {
      if (!enabled) return
      e.preventDefault()
      e.stopPropagation()
      yellowRef.current?.releasePointerCapture?.(e.pointerId)
      if (isDrawingRef.current) {
        isDrawingRef.current = false
        const color = strokeColorRef.current
        if (color === 'blue') blueStrokeCountRef.current += 1
        else yellowStrokeCountRef.current += 1
        onStrokeCount?.(blueStrokeCountRef.current, yellowStrokeCountRef.current)
        const blueOk = paintPhase === 'blue' && blueStrokeCountRef.current >= 1
        const yellowOk = paintPhase === 'yellow' && yellowStrokeCountRef.current >= 1
        if ((blueOk || yellowOk) && !hasAdvancedRef.current) {
          hasAdvancedRef.current = true
          onFirstStroke?.()
        }
      }
    },
    [enabled, onFirstStroke, onStrokeCount, paintPhase]
  )

  useImperativeHandle(ref, () => ({
    exportAs: async (format: 'png' | 'jpeg') => {
      const blue = blueRef.current
      const yellow = yellowRef.current
      if (!blue || !yellow || !containerRef.current) return null
      const w = blue.width
      const h = blue.height
      const out = document.createElement('canvas')
      out.width = w
      out.height = h
      const ctx = out.getContext('2d')
      if (!ctx) return null
      ctx.drawImage(blue, 0, 0)
      if (blendMode && blendMode !== 'normal') ctx.globalCompositeOperation = blendMode
      ctx.drawImage(yellow, 0, 0)
      ctx.globalCompositeOperation = 'source-over'
      const mime = format === 'jpeg' ? 'image/jpeg' : 'image/png'
      const quality = format === 'jpeg' ? 0.92 : undefined
      return new Promise<Blob | null>((resolve) => out.toBlob((b) => resolve(b), mime, quality))
    },
  }), [blendMode])

  if (!show) return null
  return (
    <div ref={containerRef} className={`absolute inset-0 ${className ?? ''}`}>
      <canvas ref={blueRef} className="absolute inset-0 w-full h-full pointer-events-none" />
      <div className="absolute inset-0 w-full h-full" style={blendMode && blendMode !== 'normal' ? { mixBlendMode: blendMode } : undefined}>
        <canvas
          ref={yellowRef}
          className="absolute inset-0 w-full h-full touch-none cursor-crosshair"
          style={{ pointerEvents: 'auto' }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerUp}
        />
      </div>
    </div>
  )
})

type Step = {
  title: string
  desc: string
  hint?: string
  highlight: { x: number; y: number; w: number; h: number }
  hotspotId?: string
}

type Task = {
  app: string
  steps: Step[]
  mock: 'figma' | 'procreate'
}

const TASKS: Record<string, Task> = {
  procreateSky: {
    app: 'PearCreate (PearPad)',
    mock: 'procreate',
    steps: [
      { title: 'Open Brush Library', desc: 'Tap the brush icon to open the Brush Library.', hint: 'Brush Library shows your brush sets', highlight: { x: 280, y: 14, w: 80, h: 36 }, hotspotId: 'proc-brush' },
      { title: 'Create new brush', desc: 'Tap + in the Brush Library to create a new brush.', hint: 'Creates a custom brush in Brush Studio', highlight: { x: 24, y: 70, w: 60, h: 36 }, hotspotId: 'proc-new' },
      { title: 'Open Shape menu', desc: 'Tap Shape in Brush Studio to open shape options.', hint: 'Shape controls brush tip', highlight: { x: 520, y: 100, w: 80, h: 32 }, hotspotId: 'proc-shape' },
      { title: 'Select shape type', desc: 'Tap Circle, Grain, or Texture for brush tip.', hint: 'Grain adds texture', highlight: { x: 520, y: 140, w: 80, h: 100 }, hotspotId: 'proc-shape-grain' },
      { title: 'Open Dynamics menu', desc: 'Tap Dynamics to open pressure settings.', hint: 'Size, Opacity, Flow', highlight: { x: 520, y: 200, w: 80, h: 32 }, hotspotId: 'proc-dynamics' },
      { title: 'Apply dynamics', desc: 'Tap Apply or adjust sliders, then confirm.', hint: 'Apple Pencil pressure controls stroke variation', highlight: { x: 520, y: 240, w: 80, h: 80 }, hotspotId: 'proc-dynamics-apply' },
      { title: 'Save brush', desc: 'Tap Done to exit Brush Studio and save your brush.', hint: 'Organize brushes into sets', highlight: { x: 300, y: 320, w: 100, h: 36 }, hotspotId: 'proc-done' },
      { title: 'Pick base color', desc: 'Tap the color disc. Choose a soft blue for your first strokes.', hint: 'HSV wheel or hex input', highlight: { x: 260, y: 14, w: 48, h: 36 }, hotspotId: 'proc-color' },
      { title: 'Add new layer', desc: 'Tap + in the Layers panel to add a new layer.', hint: 'Layers stack; paint above background', highlight: { x: 24, y: 120, w: 60, h: 36 }, hotspotId: 'proc-layer' },
      { title: 'Paint 1 stroke with blue', desc: 'Paint 1 stroke with blue. You\'ll mix with yellow next to see blending.', hint: 'Use the blue brush first', highlight: { x: 120, y: 80, w: 280, h: 200 }, hotspotId: 'proc-canvas' },
      { title: 'Select yellow', desc: 'Tap the yellow color swatch. Mix with blue to see blending.', hint: 'Overlap blue and yellow for blend effect', highlight: { x: 520, y: 100, w: 48, h: 48 }, hotspotId: 'proc-yellow' },
      { title: 'Paint with yellow', desc: 'Paint 1+ strokes with yellow. Overlap with blue to mix and see the blending effect.', hint: 'Mix blue + yellow to see blend modes', highlight: { x: 120, y: 80, w: 280, h: 200 }, hotspotId: 'proc-canvas' },
      { title: 'Open blend menu', desc: 'Select the layer and tap the blend mode dropdown.', hint: 'Blend modes affect how layers combine', highlight: { x: 520, y: 60, w: 80, h: 28 }, hotspotId: 'proc-blend' },
      { title: 'Select blend mode', desc: 'Tap Multiply, Overlay, or Screen.', hint: 'Overlay adds contrast; Multiply darkens', highlight: { x: 520, y: 100, w: 80, h: 120 }, hotspotId: 'proc-blend-overlay' },
      { title: 'Open export menu', desc: 'Tap the wrench icon to open Actions. Tap Share.', hint: 'Share exports your artwork', highlight: { x: 24, y: 14, w: 48, h: 36 }, hotspotId: 'proc-export' },
      { title: 'Save your painting', desc: 'Tap PNG or JPG to download your painting.', hint: 'Both formats work', highlight: { x: 24, y: 14, w: 48, h: 36 }, hotspotId: 'proc-export-format' },
    ],
  },
  figmaBusinessCard: {
    app: 'Pigma (PearPad)',
    mock: 'figma',
    steps: [
      { title: 'Choose template', desc: 'Tap the template dropdown to pick a layout.', hint: 'Minimal, Classic, or Modern', highlight: { x: 520, y: 60, w: 120, h: 40 }, hotspotId: 'fig-template' },
      { title: 'Select background color', desc: 'Tap Fill and pick a background color.', hint: 'Dark tones work well', highlight: { x: 520, y: 100, w: 100, h: 80 }, hotspotId: 'fig-fill-bg' },
      { title: 'Select accent color', desc: 'Pick an accent color for the accent bar.', hint: 'Contrasting color pops', highlight: { x: 520, y: 100, w: 100, h: 80 }, hotspotId: 'fig-fill-accent' },
      { title: 'Add your name', desc: 'Tap Text to add a textbox. Type your name, then tap Done.', hint: 'e.g. Alex Chen', highlight: { x: 520, y: 100, w: 80, h: 36 }, hotspotId: 'fig-text' },
      { title: 'Add your role', desc: 'Tap Text again. Type your title or role, then tap Done.', hint: 'e.g. Product Designer', highlight: { x: 520, y: 140, w: 80, h: 36 }, hotspotId: 'fig-text' },
      { title: 'Add your email', desc: 'Tap Text. Type your email or phone, then tap Done.', hint: 'e.g. alex@studio.co', highlight: { x: 520, y: 180, w: 80, h: 36 }, hotspotId: 'fig-text' },
      { title: 'Add accent', desc: 'Tap Rectangle to add the accent bar.', hint: 'Finishing touch', highlight: { x: 520, y: 220, w: 80, h: 36 }, hotspotId: 'fig-accent' },
      { title: 'Open export menu', desc: 'Tap the wrench icon to open Actions. Tap Share.', hint: 'Share exports your card', highlight: { x: 24, y: 14, w: 48, h: 36 }, hotspotId: 'fig-bc-export' },
      { title: 'Save your card', desc: 'Tap PNG or JPG to download your business card.', hint: 'Both formats work', highlight: { x: 24, y: 14, w: 48, h: 36 }, hotspotId: 'fig-bc-export-format' },
    ],
  },
  figmaMindmap: {
    app: 'Pigma (PearPad)',
    mock: 'figma',
    steps: [
      { title: 'Create central frame', desc: 'Select the Frame tool and draw a frame for your central idea.', hint: 'Tap the canvas area', highlight: { x: 180, y: 100, w: 120, h: 60 }, hotspotId: 'fig-canvas' },
      { title: 'Add text to frame', desc: 'Double-tap the frame and type your central topic (e.g. "Project").', hint: 'Frame becomes editable', highlight: { x: 200, y: 110, w: 80, h: 40 }, hotspotId: 'fig-text' },
      { title: 'Create component', desc: 'Select the frame and tap Create component to make it reusable.', hint: 'Components for branches', highlight: { x: 520, y: 60, w: 100, h: 36 }, hotspotId: 'fig-component-tab' },
      { title: 'Add first instance', desc: 'Tap Instance to add your first branch. It will overlap until auto layout.', hint: 'One tap adds one', highlight: { x: 180, y: 180, w: 100, h: 50 }, hotspotId: 'fig-instance' },
      { title: 'Add instances', desc: 'Tap Instance 8 more times to add branches A through I. They stack until auto layout.', hint: 'One tap per instance', highlight: { x: 520, y: 100, w: 90, h: 45 }, hotspotId: 'fig-instance' },
      { title: 'Auto layout', desc: 'Tap Auto layout to spread all instances into the radial configuration.', hint: 'Nodes fan out', highlight: { x: 520, y: 140, w: 90, h: 32 }, hotspotId: 'fig-autolayout' },
      { title: 'Add connectors', desc: 'Tap Connector once per branch to add lines. They overlap until auto layout.', hint: 'One tap per connector', highlight: { x: 520, y: 140, w: 80, h: 32 }, hotspotId: 'fig-connector' },
      { title: 'Auto layout', desc: 'Tap Auto layout to spread connectors to their respective cells.', hint: 'Lines connect correctly', highlight: { x: 520, y: 180, w: 90, h: 32 }, hotspotId: 'fig-autolayout' },
      { title: 'Fill', desc: 'Tap Fill and pick a color for all bubbles (center and branches).', hint: 'One color for all', highlight: { x: 520, y: 100, w: 100, h: 80 }, hotspotId: 'fig-fill' },
      { title: 'See example', desc: 'Tap See example to replace labels with PM terms (OKR, KPI, Agile, etc.).', hint: 'Words only—colors and layout stay the same', highlight: { x: 520, y: 220, w: 100, h: 36 }, hotspotId: 'fig-style' },
    ],
  },
}

type MockProps = {
  currentHotspotId?: string | undefined
  onStepComplete: () => void
  onWrongTap?: () => void
  showHighlight?: boolean | undefined
  stepIdx?: number | undefined
  taskId?: string | undefined
  isVariantB?: boolean | undefined
}

function HotspotButton({
  id,
  currentHotspotId,
  onStepComplete,
  onWrongTap,
  showHighlight,
  children,
  className,
}: {
  id: string
  currentHotspotId?: string | undefined
  onStepComplete: () => void
  onWrongTap?: () => void
  showHighlight?: boolean | undefined
  children: React.ReactNode
  className?: string
}) {
  const isTarget = currentHotspotId === id
  const showOverlay = showHighlight && isTarget
  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (isTarget) onStepComplete()
    else if (showHighlight && currentHotspotId) onWrongTap?.()
  }
  const handleTouchEnd = (e: React.TouchEvent) => {
    e.stopPropagation()
    e.preventDefault()
    if (isTarget) onStepComplete()
    else if (showHighlight && currentHotspotId) onWrongTap?.()
  }
  return (
    <button
      type="button"
      onClick={handleClick}
      onTouchEnd={handleTouchEnd}
      className={`relative cursor-pointer touch-manipulation active:scale-[0.97] active:brightness-110 transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2 focus-visible:ring-offset-[#252525] ${className ?? ''}`}
      aria-pressed={isTarget}
    >
      {children}
      {showOverlay && (
        <span
          role="img"
          aria-label={`Highlight: ${id}`}
          className="absolute inset-0 rounded-lg border-[4px] border-red-500 bg-red-500/25 pointer-events-none z-10 ring-4 ring-red-500/60 shadow-[0_0_0_2px_rgba(239,68,68,0.8)]"
        />
      )}
    </button>
  )
}

const TASK_ORDER = ['procreateSky', 'figmaBusinessCard', 'figmaMindmap'] as const
const TASK_LABELS: Record<string, string> = {
  procreateSky: 'Your first painting!',
  figmaBusinessCard: 'Design a business card',
  figmaMindmap: 'Create a mindmap',
}

const CLUTTER_CLASS = 'px-1 sm:px-2 py-0.5 rounded bg-white/5 text-white/45 text-[9px] sm:text-[10px] md:text-xs pointer-events-none shrink-0 max-[480px]:hidden'
const HOTSPOT_BTN = 'min-h-7 sm:min-h-8 md:min-h-9 rounded flex items-center px-1.5 sm:px-2 text-[10px] sm:text-xs md:text-sm font-medium touch-manipulation'
const HOTSPOT_INACTIVE = 'bg-[#34c759]/20 text-[#34c759]'
const HOTSPOT_ACTIVE = 'bg-[#34c759]/30 text-[#34c759] ring-2 ring-[#34c759]/50'

const CARD_TEMPLATES = [{ id: 'minimal', label: 'Minimal' }, { id: 'classic', label: 'Classic' }, { id: 'modern', label: 'Modern' }] as const
const FILL_COLORS: { id: string; label: string; bg: string }[] = [
  { id: 'slate', label: 'Slate', bg: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)' },
  { id: 'navy', label: 'Navy', bg: 'linear-gradient(135deg, #0c1929 0%, #1e3a5f 100%)' },
  { id: 'charcoal', label: 'Charcoal', bg: 'linear-gradient(135deg, #1c1917 0%, #292524 100%)' },
  { id: 'forest', label: 'Forest', bg: 'linear-gradient(135deg, #052e16 0%, #14532d 100%)' },
]
const ACCENT_COLORS: { id: string; label: string; bg: string }[] = [
  { id: 'amber', label: 'Amber', bg: 'linear-gradient(180deg, #fbbf24, #d97706)' },
  { id: 'teal', label: 'Teal', bg: 'linear-gradient(180deg, #2dd4bf, #0d9488)' },
  { id: 'rose', label: 'Rose', bg: 'linear-gradient(180deg, #fb7185, #e11d48)' },
  { id: 'blue', label: 'Blue', bg: 'linear-gradient(180deg, #60a5fa, #2563eb)' },
]
const MM_FILL_COLORS: { id: string; label: string; bg: string; border: string }[] = [
  { id: 'blue', label: 'Blue', bg: 'rgba(59,130,246,0.95)', border: 'rgba(96,165,250,0.8)' },
  { id: 'teal', label: 'Teal', bg: 'rgba(20,184,166,0.95)', border: 'rgba(52,211,153,0.8)' },
  { id: 'rose', label: 'Rose', bg: 'rgba(219,39,119,0.95)', border: 'rgba(244,114,182,0.8)' },
  { id: 'amber', label: 'Amber', bg: 'rgba(217,119,6,0.95)', border: 'rgba(251,191,36,0.8)' },
]

function FigmaMock({ currentHotspotId, onStepComplete, onWrongTap, showHighlight, stepIdx = 0, taskId, isVariantB }: MockProps) {
  const [bcTemplate, setBcTemplate] = useState<string>('')
  const [bcFillBg, setBcFillBg] = useState<string>('slate')
  const [bcFillAccent, setBcFillAccent] = useState<string>('amber')
  const [bcName, setBcName] = useState('')
  const [bcRole, setBcRole] = useState('')
  const [bcEmail, setBcEmail] = useState('')
  const [bcTextInput, setBcTextInput] = useState<'name' | 'role' | 'email' | null>(null)
  const [bcTextDraft, setBcTextDraft] = useState('')
  const [bcTemplateOpen, setBcTemplateOpen] = useState(false)
  const [bcFillBgOpen, setBcFillBgOpen] = useState(false)
  const [bcFillAccentOpen, setBcFillAccentOpen] = useState(false)
  const [mmFillOuter, setMmFillOuter] = useState<string>('blue')
  const [mmFillOuterOpen, setMmFillOuterOpen] = useState(false)
  const [mmHasSeenExample, setMmHasSeenExample] = useState(false)
  const [mmConnectorCount, setMmConnectorCount] = useState(0)
  const [mmInstanceCount, setMmInstanceCount] = useState(0)
  const [bcExportMenuOpen, setBcExportMenuOpen] = useState(false)
  const bcCardRef = useRef<HTMLDivElement>(null)
  const isMindmap = taskId === 'figmaMindmap'
  const isBusinessCard = taskId === 'figmaBusinessCard'
  const bcInExportStep = isBusinessCard && (stepIdx === 7 || stepIdx === 8)
  const handleBcExport = useCallback(async (format: 'png' | 'jpeg') => {
    const el = bcCardRef.current
    if (!el) return
    const canvas = await html2canvas(el, { scale: 2, useCORS: true, backgroundColor: null })
    const mime = format === 'jpeg' ? 'image/jpeg' : 'image/png'
    const quality = format === 'jpeg' ? 0.92 : undefined
    canvas.toBlob((blob) => {
      if (blob) {
        const a = document.createElement('a')
        a.href = URL.createObjectURL(blob)
        a.download = `pear-business-card.${format === 'jpeg' ? 'jpg' : 'png'}`
        a.click()
        URL.revokeObjectURL(a.href)
      }
      onStepComplete()
    }, mime, quality)
  }, [onStepComplete])
  useEffect(() => {
    if (taskId === 'figmaBusinessCard' && stepIdx !== 3 && stepIdx !== 4 && stepIdx !== 5) setBcTextInput(null)
    if (taskId === 'figmaMindmap' && stepIdx !== 4) setMmInstanceCount(0)
    if (taskId === 'figmaMindmap' && stepIdx !== 6) setMmConnectorCount(0)
    if (taskId !== 'figmaMindmap' || stepIdx < 9) setMmHasSeenExample(false)
    if (!bcInExportStep) setBcExportMenuOpen(false)
  }, [taskId, stepIdx, bcInExportStep])
  const hasCard = isBusinessCard && stepIdx >= 1
  const hasName = isBusinessCard && stepIdx >= 3
  const hasRole = isBusinessCard && stepIdx >= 4
  const hasEmail = isBusinessCard && stepIdx >= 5
  const hasAccent = isBusinessCard && stepIdx >= 3 && bcTemplate !== 'minimal'
  const hasCentralFrame = isMindmap && stepIdx >= 1
  const hasText = isMindmap && stepIdx >= 2
  const hasComponent = isMindmap && stepIdx >= 3
  const instanceCount = isMindmap && stepIdx >= 3 ? (stepIdx === 3 ? 1 : stepIdx === 4 ? 1 + mmInstanceCount : 9) : 0
  const hasInstanceLayout = isMindmap && stepIdx >= 6
  const connectorCount = isMindmap && stepIdx >= 6 ? (stepIdx === 6 ? mmConnectorCount : 9) : 0
  const hasConnectors = connectorCount > 0
  const hasAutoLayout = isMindmap && stepIdx >= 8
  const hasFill = isMindmap && stepIdx >= 8
  const hasStyle = isMindmap && mmHasSeenExample
  const OVERLAP_POSITIONS = Array.from({ length: 9 }, (_, i) => ({
    left: `calc(75% + ${(i % 3 - 1) * 6}px)`,
    top: `calc(50% + ${(Math.floor(i / 3) - 1) * 6}px)`,
  }))
  const RADIAL_LAYOUT_POS = [
    { left: '50%', top: '18%' }, { left: '71%', top: '25%' }, { left: '83%', top: '45%' },
    { left: '79%', top: '67%' }, { left: '61%', top: '81%' }, { left: '39%', top: '81%' },
    { left: '21%', top: '67%' }, { left: '17%', top: '45%' }, { left: '29%', top: '25%' },
  ]
  const RADIAL_SVG = hasAutoLayout
    ? [[50, 18], [71, 25], [83, 45], [79, 67], [61, 81], [39, 81], [21, 67], [17, 45], [29, 25]]
    : Array.from({ length: 9 }, (_, i) => [75 + (i % 3 - 1) * 2, 50 + (Math.floor(i / 3) - 1) * 2] as [number, number])
  const clutter = (label: string) => <div key={label} className={CLUTTER_CLASS}>{label}</div>
  if (isMindmap) {
    return (
      <div className="absolute inset-0 flex flex-col text-[10px] sm:text-xs min-h-0 overflow-hidden">
        <div className="h-6 sm:h-8 md:h-9 bg-[#2e2e2e] border-b border-white/15 flex items-center px-1 sm:px-2 md:px-4 gap-1 sm:gap-2 md:gap-4 shrink-0">
          <span className="text-white/80 text-xs sm:text-sm">Frame</span>
          <span className="text-white/80 text-xs sm:text-sm">Component</span>
          <span className="text-white/80 text-xs sm:text-sm">Prototype</span>
        </div>
        <div className="min-h-6 sm:min-h-7 md:min-h-8 bg-[#252525] border-b border-white/10 flex items-center px-1 sm:px-2 md:px-3 gap-0.5 sm:gap-1 shrink-0 flex-wrap">
          {['Move', 'Frame', 'Component', 'Pen', 'Text', 'Rect', 'Line', 'Hand', 'Zoom', 'Fill'].map(clutter)}
        </div>
        <div className="flex flex-1 min-h-0">
          <div className="w-16 min-w-14 sm:w-28 sm:min-w-[5.5rem] bg-[#323232] border-r border-white/10 p-1.5 sm:p-2 shrink-0 flex flex-col gap-1 sm:gap-1.5 overflow-y-auto min-h-0">
            <div className="text-white/50 text-xs font-medium shrink-0">Layers</div>
            {hasCentralFrame && (
              <>
                <div className="h-6 px-1.5 rounded bg-[#34c759]/15 text-[#34c759] text-[10px] flex items-center">Project</div>
                {instanceCount > 0 && Array.from({ length: instanceCount }).map((_, i) => (
                  <div key={i} className="h-5 pl-3 pr-1.5 rounded bg-white/5 text-white/50 text-[10px] flex items-center">Idea {String.fromCharCode(65 + i)}</div>
                ))}
              </>
            )}
            {!hasCentralFrame && ['Page 1', 'Frame', 'Group'].map((l) => <div key={l} className="h-6 px-1.5 rounded bg-white/5 text-white/45 text-[10px] flex items-center">{l}</div>)}
            <div className="text-white/50 text-[10px] font-medium mt-1">Pages</div>
            {['Cover', 'Flow', 'Components'].map((p) => <div key={p} className="h-5 px-1.5 rounded bg-white/5 text-white/40 text-[10px] flex items-center">{p}</div>)}
          </div>
          <HotspotButton id="fig-canvas" currentHotspotId={currentHotspotId} onStepComplete={onStepComplete} {...(onWrongTap != null && { onWrongTap })} showHighlight={showHighlight} className="flex-1 min-w-0 flex flex-col min-h-0">
            <div className="flex-1 p-4 bg-[#404040] min-w-0 min-h-0 flex items-center justify-center overflow-hidden">
              <div className="relative w-full h-full min-h-[200px] border-2 border-dashed rounded-lg border-white/20 flex items-center justify-center">
                {hasConnectors && !hasStyle && connectorCount > 0 && (
                  <svg className="absolute inset-0 w-full h-full pointer-events-none z-0" viewBox="0 0 100 100" preserveAspectRatio="none">
                    {RADIAL_SVG.slice(0, connectorCount).map(([x2, y2], i) => (
                      <line key={i} x1="50" y1="50" x2={x2} y2={y2} stroke="rgba(255,255,255,0.4)" strokeWidth="0.5" />
                    ))}
                  </svg>
                )}
                {hasCentralFrame && !hasStyle && (
                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-10">
                    <HotspotButton id="fig-text" currentHotspotId={currentHotspotId} onStepComplete={onStepComplete} {...(onWrongTap != null && { onWrongTap })} showHighlight={showHighlight}>
                      <div className={`rounded-full px-6 py-3 ${hasStyle ? 'px-16 py-8 text-xl' : 'px-6 py-3 text-base'} ${hasComponent && !hasFill ? `border-2 border-[#8b5cf6] ${hasAutoLayout ? 'bg-[#4c1d95]' : 'bg-[#8b5cf6]/20'}` : !hasFill ? `border border-white/30 ${hasAutoLayout ? 'bg-[#4a4a4a]' : 'bg-white/10'}` : ''} ${currentHotspotId === 'fig-text' ? 'ring-2 ring-[#34c759]/50' : ''}`} style={hasFill && mmFillOuter ? { backgroundColor: MM_FILL_COLORS.find((c) => c.id === mmFillOuter)?.bg ?? '#4c1d95', border: `2px solid ${MM_FILL_COLORS.find((c) => c.id === mmFillOuter)?.border ?? '#7c3aed'}` } : undefined}>
                        {hasText && <span className="text-white font-medium">Topic</span>}
                        {!hasText && <span className="text-white/40">Frame</span>}
                      </div>
                    </HotspotButton>
                  </div>
                )}
                {instanceCount > 0 && !hasStyle && (() => {
                  const labels = ['Node 1', 'Node 2', 'Node 3', 'Node 4', 'Node 5', 'Node 6', 'Node 7', 'Node 8', 'Node 9']
                  const fillColor = hasFill && mmFillOuter ? MM_FILL_COLORS.find((c) => c.id === mmFillOuter) : null
                  return (
                    <>
                      {Array.from({ length: instanceCount }).map((_, i) => {
                        const p = hasInstanceLayout ? RADIAL_LAYOUT_POS[i]! : OVERLAP_POSITIONS[i]!
                        const bubbleBg = !fillColor ? (hasInstanceLayout ? 'bg-[#4a4a4a]' : 'bg-white/10') : ''
                        return (
                          <div key={i} className={`absolute rounded-full px-5 py-2.5 text-sm border border-white/25 whitespace-nowrap -translate-x-1/2 -translate-y-1/2 z-10 ${bubbleBg}`} style={{ left: p.left, top: p.top, ...(fillColor ? { backgroundColor: fillColor.bg, border: `2px solid ${fillColor.border}` } : {}) }}>{labels[i]}</div>
                        )
                      })}
                    </>
                  )
                })()}
                {hasStyle && (() => {
                  const pmLabels = ['OKR', 'KPI', 'MVP', 'ROI', 'PRD', 'GTM', 'Agile', 'Roadmap', 'Jira']
                  const fill = MM_FILL_COLORS.find((c) => c.id === mmFillOuter) ?? MM_FILL_COLORS[0]!
                  const fillStyle = { backgroundColor: fill.bg, border: '2px solid ' + fill.border }
                  return (
                    <>
                      <svg className="absolute inset-0 w-full h-full pointer-events-none z-0" viewBox="0 0 100 100" preserveAspectRatio="none">
                        {RADIAL_SVG.map(([x2, y2], i) => (
                          <line key={i} x1="50" y1="50" x2={x2} y2={y2} stroke="rgba(255,255,255,0.35)" strokeWidth="0.5" />
                        ))}
                      </svg>
                      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-10">
                        <div className="rounded-full px-6 py-3 text-base text-white font-medium" style={fillStyle}>Product Mgmt</div>
                      </div>
                      {pmLabels.map((t, i) => (
                        <div key={t} className="absolute rounded-full px-5 py-2.5 text-sm font-medium text-white whitespace-nowrap -translate-x-1/2 -translate-y-1/2 z-10" style={{ left: RADIAL_LAYOUT_POS[i]!.left, top: RADIAL_LAYOUT_POS[i]!.top, ...fillStyle }}>{t}</div>
                      ))}
                    </>
                  )
                })()}
                {!hasCentralFrame && !hasStyle && <span className="text-white/40 text-sm">Canvas</span>}
              </div>
            </div>
          </HotspotButton>
          <div className="w-28 min-w-20 sm:w-40 sm:min-w-[7rem] bg-[#383838] border-l border-white/15 p-1.5 sm:p-3 shrink-0 flex flex-col gap-1.5 sm:gap-2 overflow-y-auto min-h-0">
            <div className="text-white/50 text-xs font-medium shrink-0">Design</div>
            {['Fill', 'Stroke', 'Effects', 'Corner', 'Padding', 'Gap'].map(clutter)}
            <HotspotButton id="fig-component-tab" currentHotspotId={currentHotspotId} onStepComplete={onStepComplete} {...(onWrongTap != null && { onWrongTap })} showHighlight={showHighlight}>
              <div className={`${HOTSPOT_BTN} ${currentHotspotId === 'fig-component-tab' ? HOTSPOT_ACTIVE : HOTSPOT_INACTIVE}`}>Create component</div>
            </HotspotButton>
            {['Constraints', 'Resize', 'Opacity', 'Blend'].map(clutter)}
            <HotspotButton id="fig-instance" currentHotspotId={currentHotspotId} onStepComplete={stepIdx === 4 ? () => { if (mmInstanceCount < 8) setMmInstanceCount((c) => c + 1); else { setMmInstanceCount(9); onStepComplete(); } } : onStepComplete} {...(onWrongTap != null && { onWrongTap })} showHighlight={showHighlight}>
              <div className={`${HOTSPOT_BTN} ${currentHotspotId === 'fig-instance' ? HOTSPOT_ACTIVE : HOTSPOT_INACTIVE}`}>Instance {stepIdx === 4 && mmInstanceCount > 0 ? `(${1 + mmInstanceCount}/9)` : ''}</div>
            </HotspotButton>
            <HotspotButton id="fig-autolayout" currentHotspotId={currentHotspotId} onStepComplete={onStepComplete} {...(onWrongTap != null && { onWrongTap })} showHighlight={showHighlight}>
              <div className={`${HOTSPOT_BTN} ${currentHotspotId === 'fig-autolayout' ? HOTSPOT_ACTIVE : HOTSPOT_INACTIVE}`}>Auto layout</div>
            </HotspotButton>
            <HotspotButton id="fig-connector" currentHotspotId={currentHotspotId} onStepComplete={stepIdx === 6 ? () => { if (mmConnectorCount < 8) setMmConnectorCount((c) => c + 1); else { setMmConnectorCount(9); onStepComplete(); } } : onStepComplete} {...(onWrongTap != null && { onWrongTap })} showHighlight={showHighlight}>
              <div className={`${HOTSPOT_BTN} ${currentHotspotId === 'fig-connector' ? HOTSPOT_ACTIVE : HOTSPOT_INACTIVE}`}>Connector {stepIdx === 6 && mmConnectorCount > 0 ? `(${mmConnectorCount}/9)` : ''}</div>
            </HotspotButton>
            <div className="relative">
              <HotspotButton id="fig-fill" currentHotspotId={currentHotspotId} onStepComplete={() => setMmFillOuterOpen(true)} {...(onWrongTap != null && { onWrongTap })} showHighlight={showHighlight} className="w-full block">
                <div className={`${HOTSPOT_BTN} justify-between ${currentHotspotId === 'fig-fill' ? HOTSPOT_ACTIVE : HOTSPOT_INACTIVE}`}>Fill <span className="text-xs">▼</span></div>
              </HotspotButton>
              {mmFillOuterOpen && (
                <div className="absolute top-full left-0 right-0 mt-1 p-2 rounded-lg bg-[#454545] border border-white/10 shadow-lg z-30 space-y-1">
                  {MM_FILL_COLORS.map((c) => (
                    <button key={c.id} type="button" onClick={() => { setMmFillOuter(c.id); setMmFillOuterOpen(false); if (stepIdx === 8) onStepComplete(); }} className="w-full flex items-center gap-2 px-3 py-2 rounded text-left text-sm text-white/90 hover:bg-white/10">
                      <div className="w-6 h-6 rounded border shrink-0" style={{ background: c.bg, borderColor: c.border }} />
                      <span>{c.label}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <HotspotButton id="fig-style" currentHotspotId={currentHotspotId} onStepComplete={() => { setMmHasSeenExample(true); onStepComplete(); }} {...(onWrongTap != null && { onWrongTap })} showHighlight={showHighlight}>
              <div className={`${HOTSPOT_BTN} ${currentHotspotId === 'fig-style' ? HOTSPOT_ACTIVE : HOTSPOT_INACTIVE}`}>See example</div>
            </HotspotButton>
          </div>
        </div>
      </div>
    )
  }
  if (isBusinessCard) {
    const bgStyle = FILL_COLORS.find((c) => c.id === bcFillBg)?.bg ?? 'linear-gradient(135deg, #0f172a, #1e293b)'
    const accentStyle = ACCENT_COLORS.find((c) => c.id === bcFillAccent)?.bg ?? 'linear-gradient(180deg, #fbbf24, #d97706)'
    const handleTemplatePick = (id: string) => { setBcTemplate(id); setBcTemplateOpen(false); if (stepIdx === 0) onStepComplete() }
    const handleFillBgPick = (id: string) => { setBcFillBg(id); setBcFillBgOpen(false); if (stepIdx === 1) onStepComplete() }
    const handleFillAccentPick = (id: string) => { setBcFillAccent(id); setBcFillAccentOpen(false); if (stepIdx === 2) onStepComplete() }
    const handleTextOpen = () => {
      if (stepIdx === 3) setBcTextInput('name')
      else if (stepIdx === 4) setBcTextInput('role')
      else if (stepIdx === 5) setBcTextInput('email')
    }
    const handleTextDone = () => {
      if (bcTextInput === 'name') setBcName(bcTextDraft)
      else if (bcTextInput === 'role') setBcRole(bcTextDraft)
      else setBcEmail(bcTextDraft)
      setBcTextInput(null)
      setBcTextDraft('')
      if (stepIdx === 3 || stepIdx === 4 || stepIdx === 5) onStepComplete()
    }
    return (
      <div className="absolute inset-0 flex flex-col text-[10px] sm:text-xs min-h-0 overflow-hidden">
        <div className="h-8 sm:h-9 bg-[#2e2e2e] border-b border-white/15 flex items-center px-2 sm:px-4 gap-2 shrink-0">
          <div className="relative shrink-0 overflow-visible">
            <HotspotButton id="fig-bc-export" currentHotspotId={currentHotspotId} onStepComplete={() => { setBcExportMenuOpen(true); onStepComplete(); }} {...(onWrongTap != null && { onWrongTap })} showHighlight={showHighlight}>
              <span className={`px-3 py-1.5 rounded ${currentHotspotId === 'fig-bc-export' ? 'ring-2 ring-[#34c759]/50' : ''} text-white/80`}>⚙</span>
            </HotspotButton>
            {bcExportMenuOpen && bcInExportStep && (
              <div className="absolute top-full left-0 mt-1 p-2 rounded-lg bg-[#454545] border border-white/10 shadow-lg z-30 min-w-[160px] space-y-1">
                <div className="text-white/50 text-sm mb-2">Share — Save to computer</div>
                {(['png', 'jpeg'] as const).map((fmt) => (
                  <HotspotButton key={fmt} id="fig-bc-export-format" currentHotspotId={currentHotspotId} onStepComplete={() => handleBcExport(fmt)} {...(onWrongTap != null && { onWrongTap })} showHighlight={showHighlight} className="w-full block min-h-[44px]">
                    <div className={`w-full px-3 py-2 min-h-[44px] flex items-center rounded text-sm ${currentHotspotId === 'fig-bc-export-format' ? 'bg-[#34c759]/30 text-[#34c759]' : 'text-white/90 hover:bg-white/10'}`}>{fmt.toUpperCase()}</div>
                  </HotspotButton>
                ))}
              </div>
            )}
          </div>
          <span className="text-white/80 text-xs sm:text-sm">Frame</span>
          <span className="text-white/80 text-xs sm:text-sm">Design</span>
        </div>
        <div className="min-h-7 sm:min-h-8 bg-[#252525] border-b border-white/10 flex items-center px-2 gap-1 shrink-0 flex-wrap">
          {['Move', 'Frame', 'Pen', 'Text', 'Rect', 'Hand', 'Fill'].map(clutter)}
        </div>
        <div className="flex flex-1 min-h-0">
          <div className="w-20 min-w-16 sm:w-28 bg-[#323232] border-r border-white/10 p-1 sm:p-1.5 shrink-0 flex flex-col gap-1 overflow-y-auto min-h-0 pointer-events-none">
            <div className="text-white/50 text-xs font-medium">Layers</div>
            {hasCard && <div className="h-6 px-1.5 rounded bg-[#34c759]/15 text-[#34c759] text-[10px] flex items-center">Card</div>}
            {hasName && <div className="h-5 pl-3 rounded bg-white/5 text-white/50 text-[10px] flex items-center">Name</div>}
            {hasRole && <div className="h-5 pl-3 rounded bg-white/5 text-white/50 text-[10px] flex items-center">Role</div>}
            {hasEmail && <div className="h-5 pl-3 rounded bg-white/5 text-white/50 text-[10px] flex items-center">Email</div>}
            {hasAccent && <div className="h-5 pl-3 rounded bg-white/5 text-white/50 text-[10px] flex items-center">Accent</div>}
            {!hasCard && ['Page 1', 'Frame'].map((l) => <div key={l} className="h-6 px-1.5 rounded bg-white/5 text-white/45 text-[10px] flex items-center">{l}</div>)}
            <div className="text-white/50 text-[10px] font-medium mt-1">Pages</div>
            {['Cover', 'Flow'].map((p) => <div key={p} className="h-5 px-1.5 rounded bg-white/5 text-white/40 text-[10px] flex items-center">{p}</div>)}
          </div>
          <div className="flex-1 p-4 bg-[#404040] min-w-0 min-h-0 flex items-center justify-center relative">
            <div ref={bcCardRef} className={`relative w-full max-w-sm aspect-[3.5/2] rounded-lg overflow-hidden transition-all duration-300 ${hasCard ? '' : 'border-2 border-dashed border-white/25'}`}
              style={hasCard ? { background: bgStyle } : undefined}>
              {!hasCard && stepIdx === 0 && (
                <span className="absolute inset-0 flex items-center justify-center text-white/40 text-sm">Choose a template to begin</span>
              )}
              {hasCard && (
                <div className="absolute inset-0 p-5 sm:p-6 flex flex-col justify-between">
                  {hasAccent && bcTemplate !== 'minimal' && (
                    <div
                      className={`absolute ${bcTemplate === 'modern' ? 'top-0 left-0 right-0 h-1' : 'top-0 left-0 w-1 h-full'}`}
                      style={{ background: accentStyle }}
                    />
                  )}
                  <div className={hasAccent ? 'pl-4' : ''}>
                    {hasName && <div className="text-white font-bold text-lg sm:text-xl tracking-tight">{bcName || (isVariantB ? 'Dr. Theresa Johnson (She/Her)' : 'Your name')}</div>}
                    {hasRole && <div className="text-white/80 text-sm sm:text-base mt-0.5">{bcRole || (isVariantB ? 'Global Head of Product, Roblox' : 'Your role')}</div>}
                    {hasEmail && <div className="text-white/60 text-xs sm:text-sm mt-2">{bcEmail || (isVariantB ? 'theresa.johnson@stanford.edu' : 'you@example.com')}</div>}
                  </div>
                  {!hasName && !hasRole && !hasEmail && hasCard && <span className="text-white/40 text-xs">Tap Text to add fields</span>}
                </div>
              )}
            </div>
            {bcTextInput && (
              <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center p-4 z-50" onClick={(e) => e.target === e.currentTarget && setBcTextInput(null)}>
                <div className="bg-[#383838] rounded-xl p-4 w-full max-w-xs border border-white/20 shadow-xl" onClick={(e) => e.stopPropagation()}>
                  <label className="block text-white/90 text-sm font-medium mb-2">
                    {bcTextInput === 'name' && 'Type your name'}
                    {bcTextInput === 'role' && 'Type your role or title'}
                    {bcTextInput === 'email' && 'Type your email or phone'}
                  </label>
                  <input
                    type="text"
                    value={bcTextDraft}
                    onChange={(e) => setBcTextDraft(e.target.value)}
                    placeholder={bcTextInput === 'name' ? 'e.g. Alex Chen' : bcTextInput === 'role' ? 'e.g. Product Designer' : 'e.g. alex@studio.co'}
                    className="w-full px-3 py-2 rounded-lg bg-white/10 border border-white/20 text-white text-sm placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-[#34c759]/50"
                    autoFocus
                  />
                  <div className="flex gap-2 mt-3">
                    <button type="button" onClick={() => { setBcTextInput(null); setBcTextDraft('') }} className="flex-1 py-2 rounded-lg bg-white/10 text-white/80 text-sm">Cancel</button>
                    <button type="button" onClick={handleTextDone} className="flex-1 py-2 rounded-lg bg-[#34c759]/30 text-[#34c759] font-medium text-sm">Done</button>
                  </div>
                </div>
              </div>
            )}
          </div>
          <div className="w-28 min-w-24 sm:w-40 bg-[#383838] border-l border-white/15 p-1.5 sm:p-3 shrink-0 flex flex-col gap-1 sm:gap-1.5 overflow-y-auto min-h-0">
            <div className="text-white/50 text-xs font-medium shrink-0">Design</div>
            {['Layout', 'Stroke', 'Effects', 'Corner'].map(clutter)}
            <div className="relative">
              <HotspotButton id="fig-template" currentHotspotId={currentHotspotId} onStepComplete={() => setBcTemplateOpen(true)} {...(onWrongTap != null && { onWrongTap })} showHighlight={showHighlight} className="w-full block">
                <div className={`${HOTSPOT_BTN} justify-between ${currentHotspotId === 'fig-template' ? HOTSPOT_ACTIVE : HOTSPOT_INACTIVE}`}>Template <span className="text-xs">▼</span></div>
              </HotspotButton>
              {bcTemplateOpen && (
                <div className="absolute top-full left-0 right-0 mt-1 p-2 rounded-lg bg-[#454545] border border-white/10 shadow-lg z-30 space-y-1">
                  {CARD_TEMPLATES.map((t) => (
                    <button key={t.id} type="button" onClick={() => handleTemplatePick(t.id)} className="w-full px-3 py-2.5 rounded text-left text-sm text-white/90 hover:bg-white/10 block">
                      {t.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="relative">
              <HotspotButton id="fig-fill-bg" currentHotspotId={currentHotspotId} onStepComplete={() => setBcFillBgOpen(true)} {...(onWrongTap != null && { onWrongTap })} showHighlight={showHighlight} className="w-full block">
                <div className={`${HOTSPOT_BTN} justify-between ${currentHotspotId === 'fig-fill-bg' ? HOTSPOT_ACTIVE : HOTSPOT_INACTIVE}`}>Background <span className="text-xs">▼</span></div>
              </HotspotButton>
              {bcFillBgOpen && (
                <div className="absolute top-full left-0 right-0 mt-1 p-2 rounded-lg bg-[#454545] border border-white/10 shadow-lg z-30 space-y-1">
                  {FILL_COLORS.map((c) => (
                    <button key={c.id} type="button" onClick={() => handleFillBgPick(c.id)} className="w-full flex items-center gap-2 px-3 py-2 rounded text-left text-sm text-white/90 hover:bg-white/10">
                      <div className="w-6 h-6 rounded border border-white/20 shrink-0" style={{ background: c.bg }} />
                      <span>{c.label}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="relative">
              <HotspotButton id="fig-fill-accent" currentHotspotId={currentHotspotId} onStepComplete={() => setBcFillAccentOpen(true)} {...(onWrongTap != null && { onWrongTap })} showHighlight={showHighlight} className="w-full block">
                <div className={`${HOTSPOT_BTN} justify-between ${currentHotspotId === 'fig-fill-accent' ? HOTSPOT_ACTIVE : HOTSPOT_INACTIVE}`}>Accent <span className="text-xs">▼</span></div>
              </HotspotButton>
              {bcFillAccentOpen && (
                <div className="absolute top-full left-0 right-0 mt-1 p-2 rounded-lg bg-[#454545] border border-white/10 shadow-lg z-30 space-y-1">
                  {ACCENT_COLORS.map((c) => (
                    <button key={c.id} type="button" onClick={() => handleFillAccentPick(c.id)} className="w-full flex items-center gap-2 px-3 py-2 rounded text-left text-sm text-white/90 hover:bg-white/10">
                      <div className="w-6 h-6 rounded border border-white/20 shrink-0" style={{ background: c.bg }} />
                      <span>{c.label}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            {!bcTextInput && (
              <HotspotButton id="fig-text" currentHotspotId={currentHotspotId} onStepComplete={handleTextOpen} {...(onWrongTap != null && { onWrongTap })} showHighlight={showHighlight}>
                <div className={`${HOTSPOT_BTN} ${currentHotspotId === 'fig-text' ? HOTSPOT_ACTIVE : HOTSPOT_INACTIVE}`}>Text</div>
              </HotspotButton>
            )}
            {currentHotspotId === 'fig-text' && !bcTextInput && (stepIdx === 3 || stepIdx === 4 || stepIdx === 5) && (
              <div className="p-2 rounded bg-[#454545] border border-white/10 shrink-0 text-[10px] text-white/70">
                {stepIdx === 3 ? 'Add name' : stepIdx === 4 ? 'Add role' : 'Add email'}
              </div>
            )}
            <HotspotButton id="fig-accent" currentHotspotId={currentHotspotId} onStepComplete={() => { if (stepIdx === 6) onStepComplete(); }} {...(onWrongTap != null && { onWrongTap })} showHighlight={showHighlight}>
              <div className={`${HOTSPOT_BTN} ${currentHotspotId === 'fig-accent' ? HOTSPOT_ACTIVE : HOTSPOT_INACTIVE}`}>Rectangle</div>
            </HotspotButton>
          </div>
        </div>
      </div>
    )
  }
  return null
}

type BlendMode = 'normal' | 'multiply' | 'overlay' | 'screen'

function ProcreateMock({ currentHotspotId, onStepComplete, onWrongTap, showHighlight, stepIdx = 0, isVariantB }: MockProps) {
  const [brushColor, setBrushColor] = useState<'blue' | 'yellow'>('blue')
  const [blendMode, setBlendMode] = useState<BlendMode>('normal')
  const [exportMenuOpen, setExportMenuOpen] = useState(false)
  const canvasRef = useRef<SkyPaintCanvasHandle>(null)

  const inExportStep = stepIdx === 14 || stepIdx === 15
  useEffect(() => {
    if (!inExportStep) setExportMenuOpen(false)
  }, [inExportStep])

  const handleExport = useCallback(async (format: 'png' | 'jpeg') => {
    const blob = await canvasRef.current?.exportAs(format)
    if (blob) {
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = `pear-painting.${format === 'jpeg' ? 'jpg' : 'png'}`
      a.click()
      URL.revokeObjectURL(a.href)
    }
    onStepComplete()
  }, [onStepComplete])
  const brushActive = stepIdx >= 1
  const hasNewBrush = stepIdx >= 2
  const inBrushStudio = stepIdx >= 2
  const shapeDone = stepIdx >= 4
  const dynamicsDone = stepIdx >= 6
  const hasColor = stepIdx >= 7
  const hasLayer = stepIdx >= 8
  const hasStroke = stepIdx >= 11
  const blendMenuOpen = stepIdx === 13
  const shapeMenuOpen = stepIdx === 3
  const dynamicsMenuOpen = stepIdx === 5
  const canPaint = hasLayer && (stepIdx === 9 || stepIdx >= 11)
  const paintPhase = stepIdx === 9 ? 'blue' as const : stepIdx === 11 ? 'yellow' as const : undefined
  const canvasVisible = hasLayer && stepIdx >= 9
  const procClutter = (label: string) => <div key={label} className={CLUTTER_CLASS}>{label}</div>
  return (
    <div className="absolute inset-0 flex flex-col text-[10px] sm:text-xs min-h-0 overflow-hidden">
      <div className="min-h-8 sm:min-h-9 bg-[#2e2e2e] border-b border-white/15 flex items-center justify-center gap-1.5 sm:gap-2 px-2 sm:px-3 shrink-0 flex-wrap py-1 sm:py-1.5">
        <div className="relative shrink-0 overflow-visible">
            <HotspotButton id="proc-export" currentHotspotId={currentHotspotId} onStepComplete={() => { setExportMenuOpen(true); onStepComplete(); }} {...(onWrongTap != null && { onWrongTap })} showHighlight={showHighlight}>
              <span className={`px-3 py-1.5 rounded ${currentHotspotId === 'proc-export' ? 'ring-2 ring-[#34c759]/50' : ''} text-white/80`}>⚙</span>
            </HotspotButton>
            {exportMenuOpen && inExportStep && (
              <div className="absolute top-full left-0 mt-1 p-2 rounded-lg bg-[#454545] border border-white/10 shadow-lg z-30 min-w-[160px] space-y-1">
                <div className="text-white/50 text-sm mb-2">Share — Save to computer</div>
                {(['png', 'jpeg'] as const).map((fmt) => (
                  <HotspotButton key={fmt} id="proc-export-format" currentHotspotId={currentHotspotId} onStepComplete={() => handleExport(fmt)} {...(onWrongTap != null && { onWrongTap })} showHighlight={showHighlight} className="w-full block min-h-[44px]">
                    <div className={`w-full px-3 py-2 min-h-[44px] flex items-center rounded text-sm ${currentHotspotId === 'proc-export-format' ? 'bg-[#34c759]/30 text-[#34c759]' : 'text-white/90 hover:bg-white/10'}`}>{fmt.toUpperCase()}</div>
                  </HotspotButton>
                ))}
              </div>
            )}
          </div>
        {['Undo', 'Redo', 'Adjustments', 'Filters', 'Selection', 'Transform'].map(procClutter)}
        <HotspotButton id="proc-color" currentHotspotId={currentHotspotId} onStepComplete={onStepComplete} {...(onWrongTap != null && { onWrongTap })} showHighlight={showHighlight}>
            <div className={`w-9 h-9 rounded-full border-2 ${hasColor ? 'border-[#34c759] bg-[#60a5fa]/80' : 'border-white/40 bg-[#60a5fa]/50'} ${currentHotspotId === 'proc-color' ? 'ring-2 ring-[#34c759]/50' : ''}`} />
          </HotspotButton>
        <span className="text-white/80">Actions</span>
        <HotspotButton id="proc-brush" currentHotspotId={currentHotspotId} onStepComplete={onStepComplete} {...(onWrongTap != null && { onWrongTap })} showHighlight={showHighlight}>
          <span className={`px-3 py-1.5 rounded ${currentHotspotId === 'proc-brush' ? 'ring-2 ring-[#34c759]/50' : ''} ${brushActive ? 'text-[#34c759] font-medium' : 'text-white/80'}`}>Brush</span>
        </HotspotButton>
        <span className="text-white/80">Eraser</span>
        <span className="text-white/80">Smudge</span>
        <span className="text-white/80">Layers</span>
        {['Canvas', 'Share', 'Gallery'].map(procClutter)}
      </div>
      {currentHotspotId === 'proc-brush' && (
        <div className="bg-[#454545] border-b border-white/10 px-2 py-1.5 flex gap-2 shrink-0">
          <span className="text-white/60 text-xs">Brush Library:</span>
          <div className="flex gap-1 rounded bg-white/10 p-1">
            <div className="w-10 h-10 rounded-full bg-[#34c759]/40 border border-[#34c759]/60" />
            <div className="w-10 h-10 rounded-full bg-white/20" />
            <div className="w-10 h-10 rounded-full bg-white/20" />
          </div>
        </div>
      )}
      <div className="flex flex-1 min-h-0">
        <div className="w-20 min-w-16 sm:w-28 bg-[#383838] border-r border-white/15 p-1 sm:p-2 shrink-0 flex flex-col gap-0.5 sm:gap-1 overflow-y-auto min-h-0">
          <div className="flex gap-0.5 sm:gap-1 pointer-events-none shrink-0">
            {['Import', 'Organize', 'Search'].map(procClutter)}
          </div>
          <HotspotButton id="proc-new" currentHotspotId={currentHotspotId} onStepComplete={onStepComplete} {...(onWrongTap != null && { onWrongTap })} showHighlight={showHighlight} className="w-full">
            <div className={`w-full ${HOTSPOT_BTN} justify-center ${currentHotspotId === 'proc-new' ? HOTSPOT_ACTIVE : HOTSPOT_INACTIVE}`}>+ New</div>
          </HotspotButton>
          {currentHotspotId === 'proc-new' && (
            <div className="p-2 rounded bg-[#454545] border border-white/10 shrink-0">
              <div className="text-[#34c759] text-[10px]">✓ Create new brush</div>
            </div>
          )}
          <div className="text-white/50 text-[10px] pointer-events-none shrink-0">Brush sets</div>
          <div className={`w-full h-8 rounded flex items-center justify-center text-[10px] shrink-0 ${hasNewBrush ? 'bg-white/15 text-[#34c759]/80' : 'bg-white/10 text-white/40'}`}>{hasNewBrush ? '✓ Custom' : 'Brush 1'}</div>
          <div className="w-full h-8 bg-white/10 rounded flex items-center justify-center text-[10px] text-white/40 shrink-0">Brush 2</div>
          {['Inking', 'Sketching', 'Painting'].map((s) => <div key={s} className="w-full h-6 bg-white/5 rounded flex items-center px-1.5 text-white/40 text-[10px] pointer-events-none shrink-0">{s}</div>)}
          <>
            <div className="text-white/50 mt-1 text-[10px] shrink-0">Layers</div>
              <HotspotButton id="proc-layer" currentHotspotId={currentHotspotId} onStepComplete={onStepComplete} {...(onWrongTap != null && { onWrongTap })} showHighlight={showHighlight} className="w-full shrink-0">
                <div className={`w-full ${HOTSPOT_BTN} justify-center ${currentHotspotId === 'proc-layer' ? HOTSPOT_ACTIVE : HOTSPOT_INACTIVE}`}>+ Layer</div>
              </HotspotButton>
              {hasLayer && <div className="w-full h-10 rounded bg-white/10 flex items-center px-1.5 gap-1 shrink-0"><div className="w-8 h-8 rounded bg-[#60a5fa]/40 flex items-center justify-center text-[9px] text-white/60">{blendMode !== 'normal' ? blendMode.charAt(0).toUpperCase() : ''}</div><span className="text-[10px] text-white/70">Layer{blendMode !== 'normal' ? ` (${blendMode.charAt(0).toUpperCase() + blendMode.slice(1)})` : ''}</span></div>}
              {hasLayer && <div className="w-full h-8 rounded bg-white/5 flex items-center px-1.5 text-[10px] text-white/40 shrink-0">Background</div>}
          </>
        </div>
        <div className={`flex-1 p-2 min-w-0 transition-all ${brushActive ? 'bg-[#404040]' : 'bg-[#404040]'}`}>
          <HotspotButton id="proc-canvas" currentHotspotId={currentHotspotId} onStepComplete={onStepComplete} {...(onWrongTap != null && { onWrongTap })} showHighlight={showHighlight} className="w-full h-full">
            <div className={`w-full h-full border-2 rounded-lg flex flex-col items-center justify-center gap-3 text-base transition-all relative overflow-hidden ${(hasStroke || hasLayer) ? 'border-none' : 'border-dashed'} ${(currentHotspotId === 'proc-canvas' || currentHotspotId === 'proc-yellow') && showHighlight && canPaint ? '!border-red-500 ring-4 ring-red-500/60' : 'border-white/20'} ${!canPaint && brushActive ? 'border-white/30' : ''}`}>
              <SkyPaintCanvas
                ref={canvasRef}
                enabled={canPaint}
                canvasVisible={canvasVisible}
                brushColor={brushColor}
                blendMode={blendMode}
                {...(paintPhase != null && { paintPhase })}
                {...((stepIdx === 9 || stepIdx === 11) && { onFirstStroke: onStepComplete })}
                className="z-10"
              />
              {isVariantB && canPaint && (
                <svg className="absolute inset-0 w-full h-full pointer-events-none z-20" viewBox="0 0 100 100" preserveAspectRatio="none">
                  <path d="M 15 60 Q 35 45 55 55 T 95 50" stroke={BRUSH_BLUE} strokeWidth="4" fill="none" strokeLinecap="round" strokeLinejoin="round" opacity="0.9" />
                  <path d="M 20 75 Q 45 65 70 80 T 85 70" stroke={BRUSH_BLUE} strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round" opacity="0.85" />
                  {stepIdx >= 11 && (
                    <>
                      <path d="M 25 40 Q 50 55 75 35 T 90 45" stroke={BRUSH_YELLOW} strokeWidth="4" fill="none" strokeLinecap="round" strokeLinejoin="round" opacity="0.9" />
                      <path d="M 30 65 Q 55 50 80 70" stroke={BRUSH_YELLOW} strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round" opacity="0.85" />
                    </>
                  )}
                </svg>
              )}
              {brushActive && !hasStroke && !canPaint && <div className="absolute top-4 right-4 w-10 h-10 rounded-full border-2 border-[#34c759] bg-[#34c759]/30" title="Brush cursor" />}
              {canPaint && <div className="absolute top-4 right-4 w-10 h-10 rounded-full border-2 border-white/60 pointer-events-none z-30" style={{ backgroundColor: brushColor === 'blue' ? BRUSH_BLUE : BRUSH_YELLOW }} title="Brush" />}
              {hasNewBrush && !hasStroke && !canPaint && <div className="w-12 h-12 rounded-full bg-[#34c759]/40 border-2 border-[#34c759]/60" />}
              {inBrushStudio && !hasStroke && !canPaint && <span className="text-white/50 text-xs">Brush Studio</span>}
              {!hasNewBrush && !hasStroke && !canPaint && <span className="text-white/40">Canvas</span>}
              {canPaint && stepIdx === 9 && (
                <div className="relative z-30 pointer-events-none text-center">
                  <span className="block text-white font-semibold drop-shadow">Paint 1 stroke with blue</span>
                  <span className="block mt-1 text-white/80 text-xs drop-shadow">Mix with yellow next to see blending</span>
                </div>
              )}
              {canPaint && stepIdx === 11 && (
                <div className="relative z-30 pointer-events-none text-center">
                  <span className="block text-[#fbbf24] font-semibold drop-shadow">Paint 1+ strokes with yellow</span>
                  <span className="block mt-1 text-white/80 text-xs drop-shadow">Overlap with blue to mix and see blending</span>
                </div>
              )}
              {stepIdx >= 12 && <span className="relative text-white/90 text-sm drop-shadow z-30 pointer-events-none">Blended</span>}
            </div>
          </HotspotButton>
        </div>
        <div className="w-24 min-w-[5.5rem] sm:w-28 bg-[#383838] border-l border-white/15 p-1.5 sm:p-2 shrink-0 flex flex-col gap-1 sm:gap-1 overflow-y-auto min-h-0">
          <div className="text-white/50 text-xs shrink-0">Brush Studio</div>
          {hasColor && (
            <div className="flex gap-1.5 mb-1 shrink-0">
              <button type="button" onClick={() => setBrushColor('blue')} className={`w-9 h-9 rounded-full border-2 shrink-0 ${brushColor === 'blue' ? 'border-[#34c759] ring-2 ring-[#34c759]/50' : 'border-white/30'}`} style={{ backgroundColor: BRUSH_BLUE }} title="Blue brush" />
              {stepIdx === 10 ? (
                <HotspotButton id="proc-yellow" currentHotspotId={currentHotspotId} onStepComplete={() => { setBrushColor('yellow'); onStepComplete(); }} {...(onWrongTap != null && { onWrongTap })} showHighlight={showHighlight}>
                  <div className={`w-9 h-9 rounded-full border-2 shrink-0 ${brushColor === 'yellow' ? 'border-[#34c759] ring-2 ring-[#34c759]/50' : 'border-white/30'} ${currentHotspotId === 'proc-yellow' ? 'ring-2 ring-red-500' : ''}`} style={{ backgroundColor: BRUSH_YELLOW }} title="Yellow brush" />
                </HotspotButton>
              ) : (
                <button type="button" onClick={() => setBrushColor('yellow')} className={`w-9 h-9 rounded-full border-2 shrink-0 ${brushColor === 'yellow' ? 'border-[#34c759] ring-2 ring-[#34c759]/50' : 'border-white/30'}`} style={{ backgroundColor: BRUSH_YELLOW }} title="Yellow brush" />
              )}
            </div>
          )}
          {['Stamping', 'Smudge', 'Stabilization'].map(procClutter)}
          <HotspotButton id="proc-shape" currentHotspotId={currentHotspotId} onStepComplete={onStepComplete} {...(onWrongTap != null && { onWrongTap })} showHighlight={showHighlight} className="w-full relative">
            <div className={`w-full ${HOTSPOT_BTN} justify-between ${(currentHotspotId === 'proc-shape' || currentHotspotId === 'proc-shape-grain') ? HOTSPOT_ACTIVE : HOTSPOT_INACTIVE} ${shapeDone ? 'border border-[#34c759]/40' : ''}`}>Shape {shapeDone && '✓'} ▼</div>
            {shapeMenuOpen && (
              <div className="absolute top-full left-0 right-0 mt-1 p-2 rounded-lg bg-[#454545] border border-white/10 shadow-lg z-30 space-y-1">
                {['Circle', 'Grain', 'Texture'].map((o) => (
                  <HotspotButton key={o} id="proc-shape-grain" currentHotspotId={currentHotspotId} onStepComplete={onStepComplete} {...(onWrongTap != null && { onWrongTap })} showHighlight={showHighlight} className="w-full block min-h-[44px]">
                    <div className={`w-full px-3 py-2.5 min-h-[44px] flex items-center rounded text-left text-sm ${currentHotspotId === 'proc-shape-grain' ? 'bg-[#34c759]/30 text-[#34c759]' : 'bg-white/5 text-white/80 hover:bg-white/10'}`}>{o}</div>
                  </HotspotButton>
                ))}
              </div>
            )}
          </HotspotButton>
          <HotspotButton id="proc-dynamics" currentHotspotId={currentHotspotId} onStepComplete={onStepComplete} {...(onWrongTap != null && { onWrongTap })} showHighlight={showHighlight} className="w-full relative">
            <div className={`w-full ${HOTSPOT_BTN} justify-between ${(currentHotspotId === 'proc-dynamics' || currentHotspotId === 'proc-dynamics-apply') ? HOTSPOT_ACTIVE : HOTSPOT_INACTIVE} ${dynamicsDone ? 'border border-[#34c759]/40' : ''}`}>Dynamics {dynamicsDone && '✓'} ▼</div>
            {dynamicsMenuOpen && (
              <div className="absolute top-full left-0 right-0 mt-1 p-2 rounded-lg bg-[#454545] border border-white/10 shadow-lg z-30 space-y-1">
                <div className="flex justify-between text-[10px] text-white/40 px-2"><span>Size</span><span>80%</span></div>
                <div className="h-0.5 bg-white/20 rounded-full mx-2" />
                <div className="flex justify-between text-[10px] text-white/40 px-2"><span>Opacity</span><span>100%</span></div>
                <div className="h-0.5 bg-white/20 rounded-full mx-2" />
                <HotspotButton id="proc-dynamics-apply" currentHotspotId={currentHotspotId} onStepComplete={onStepComplete} {...(onWrongTap != null && { onWrongTap })} showHighlight={showHighlight} className="w-full block mt-1 min-h-[44px]">
                  <div className={`w-full px-3 py-2.5 min-h-[44px] flex items-center justify-center rounded text-center text-sm ${currentHotspotId === 'proc-dynamics-apply' ? 'bg-[#34c759]/30 text-[#34c759]' : 'bg-white/5 text-white/80 hover:bg-white/10'}`}>Apply</div>
                </HotspotButton>
              </div>
            )}
          </HotspotButton>
          <HotspotButton id="proc-done" currentHotspotId={currentHotspotId} onStepComplete={onStepComplete} {...(onWrongTap != null && { onWrongTap })} showHighlight={showHighlight} className="w-full">
            <div className={`w-full ${HOTSPOT_BTN} justify-center ${currentHotspotId === 'proc-done' ? HOTSPOT_ACTIVE : HOTSPOT_INACTIVE}`}>Done</div>
          </HotspotButton>
          {['Pressure', 'Tilt'].map(procClutter)}
          <>
            <div className="text-white/50 mt-2 text-sm">Blend</div>
              <HotspotButton id="proc-blend" currentHotspotId={currentHotspotId} onStepComplete={onStepComplete} {...(onWrongTap != null && { onWrongTap })} showHighlight={showHighlight} className="w-full relative">
                <div className={`w-full ${HOTSPOT_BTN} justify-between ${(currentHotspotId === 'proc-blend' || currentHotspotId === 'proc-blend-overlay') ? HOTSPOT_ACTIVE : HOTSPOT_INACTIVE} ${stepIdx >= 14 ? 'border border-[#34c759]/40' : ''}`}>{blendMode.charAt(0).toUpperCase() + blendMode.slice(1)} {stepIdx >= 14 && '✓'} ▼</div>
                {blendMenuOpen && (
                  <div className="absolute top-full left-0 right-0 mt-1 p-2 rounded-lg bg-[#454545] border border-white/10 shadow-lg z-30 space-y-1">
                    {(['multiply', 'overlay', 'screen'] as const).map((m) => (
                      <HotspotButton key={m} id="proc-blend-overlay" currentHotspotId={currentHotspotId} onStepComplete={() => { setBlendMode(m); onStepComplete(); }} {...(onWrongTap != null && { onWrongTap })} showHighlight={showHighlight} className="w-full block min-h-[44px]">
                        <div className={`w-full px-3 py-2.5 min-h-[44px] flex items-center rounded text-left text-sm capitalize ${currentHotspotId === 'proc-blend-overlay' ? 'bg-[#34c759]/30 text-[#34c759]' : 'bg-white/5 text-white/80 hover:bg-white/10'}`}>{m}</div>
                      </HotspotButton>
                    ))}
                  </div>
                )}
              </HotspotButton>
          </>
        </div>
      </div>
    </div>
  )
}

const MOCK_COMPONENTS: Record<string, (props: MockProps) => React.ReactNode> = {
  figma: FigmaMock,
  procreate: ProcreateMock,
}

/** Wrapper that lets the mock fill the container; mock uses flex so it adapts to any size */
function MockFillWrapper({ children }: { children: React.ReactNode }) {
  return <div className="absolute inset-0 min-w-0 min-h-0 flex flex-col overflow-hidden">{children}</div>
}

type ABVariant = 'a' | 'b'
type FeedbackRating = 'meh' | 'good' | 'great'

export default function PearNavigator() {
  const [phase, setPhase] = useState<'task' | 'steps' | 'done'>('task')
  const [taskId, setTaskId] = useState<string | null>(null)
  const [stepIdx, setStepIdx] = useState(0)
  const [showHighlight, setShowHighlight] = useState(false)
  const [wrongTapToast, setWrongTapToast] = useState(false)
  const [variant, setVariant] = useState<ABVariant | null>(null)
  const [feedbackRating, setFeedbackRating] = useState<FeedbackRating | null>(null)
  const [showFeedbackOverlay, setShowFeedbackOverlay] = useState(false)
  const taskStartTimeRef = useRef<number>(0)
  const stepStartTimeRef = useRef<number>(0)
  const sessionIdRef = useRef<string | null>(null)
  const stepTimesRef = useRef<number[]>([])
  const variantRef = useRef<ABVariant | null>(null)

  const task = taskId ? TASKS[taskId] : null
  const step = task ? task.steps[stepIdx] : null
  const isLastStep = task && stepIdx === task.steps.length - 1
  const isFirstStep = stepIdx === 0
  const isVariantB = variant === 'b'

  useEffect(() => {
    if (!wrongTapToast) return
    const t = setTimeout(() => setWrongTapToast(false), 2000)
    return () => clearTimeout(t)
  }, [wrongTapToast])

  useEffect(() => {
    if (phase !== 'done') return
    const t = setTimeout(() => setShowFeedbackOverlay(true), 1000)
    return () => clearTimeout(t)
  }, [phase])

  const sendProgress = useCallback((opts: { completed?: boolean; rating?: FeedbackRating }) => {
    const sid = sessionIdRef.current
    const v = variantRef.current ?? variant
    if (!sid || !v || !taskId || !task) return
    const stepTimes = [...stepTimesRef.current]
    const body = {
      sessionId: sid,
      variant: v,
      taskId,
      stepReached: opts.completed ? task.steps.length - 1 : stepIdx,
      stepTimes,
      completed: opts.completed ?? false,
      rating: opts.rating,
      totalSec: opts.completed ? Math.round((Date.now() - taskStartTimeRef.current) / 1000) : undefined,
      stepsCount: opts.completed ? task.steps.length : undefined,
    }
    const url = '/api/pear-navigator/sessions'
    if (opts.completed && navigator.sendBeacon) {
      navigator.sendBeacon(url, new Blob([JSON.stringify(body)], { type: 'application/json' }))
    } else {
      fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).catch(() => {})
    }
  }, [variant, taskId, task, stepIdx])

  useEffect(() => {
    if (phase === 'steps' && stepIdx === 0 && sessionIdRef.current && variant && taskId && task) {
      sendProgress({ completed: false })
    }
  }, [phase, stepIdx, variant, taskId, task, sendProgress])

  const handleStart = useCallback(() => {
    if (!taskId) return
    const v: ABVariant = variant ?? (Math.random() < 0.5 ? 'a' : 'b')
    if (variant == null) setVariant(v)
    variantRef.current = v
    sessionIdRef.current = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `s-${Date.now()}-${Math.random().toString(36).slice(2)}`
    stepTimesRef.current = []
    setPhase('steps')
    setStepIdx(0)
    setShowHighlight(true)
    const now = Date.now()
    taskStartTimeRef.current = now
    stepStartTimeRef.current = now
  }, [taskId, variant])

  const handleNext = useCallback(() => {
    if (!task) return
    const now = Date.now()
    const stepDur = Math.round((now - stepStartTimeRef.current) / 1000)
    stepTimesRef.current.push(stepDur)
    stepStartTimeRef.current = now
    if (isLastStep) {
      setPhase('done')
      setShowHighlight(false)
    } else {
      sendProgress({ completed: false })
      setStepIdx((i) => i + 1)
      setShowHighlight(true)
    }
  }, [task, isLastStep, sendProgress])

  const handlePrev = useCallback(() => {
    if (stepIdx > 0) setStepIdx((i) => i - 1)
  }, [stepIdx])

  const handleWrongTap = useCallback(() => setWrongTapToast(true), [])

  const handleFeedback = useCallback((rating: FeedbackRating) => {
    const now = Date.now()
    const stepDur = Math.round((now - stepStartTimeRef.current) / 1000)
    stepTimesRef.current.push(stepDur)
    setFeedbackRating(rating)
    if (variant && taskId && task) {
      sendProgress({ completed: true, rating })
    }
  }, [variant, taskId, task, sendProgress])

  const handleReset = useCallback(() => {
    sessionIdRef.current = null
    variantRef.current = null
    setPhase('task')
    setTaskId(null)
    setStepIdx(0)
    setShowHighlight(false)
    setShowFeedbackOverlay(false)
    setVariant(null)
    setFeedbackRating(null)
  }, [])

  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.visibilityState !== 'hidden') return
      const v = variantRef.current ?? variant
      if (phase !== 'steps' || !sessionIdRef.current || !v || !taskId || !task) return
      const partial = Math.round((Date.now() - stepStartTimeRef.current) / 1000)
      const stepTimes = [...stepTimesRef.current, partial]
      const body = {
        sessionId: sessionIdRef.current,
        variant: v,
        taskId,
        stepReached: stepIdx,
        stepTimes,
        completed: false,
      }
      navigator.sendBeacon?.('/api/pear-navigator/sessions', new Blob([JSON.stringify(body)], { type: 'application/json' }))
    }
    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => document.removeEventListener('visibilitychange', onVisibilityChange)
  }, [phase, variant, taskId, task, stepIdx])

  const MockComponent = task ? MOCK_COMPONENTS[task.mock] : null

  return (
    <div className="w-full flex-1 min-h-0 flex flex-col overflow-hidden bg-gradient-to-br from-[#0d0d0d] via-[#1a1a1a] to-[#0d0d0d]">
      <div className="flex-none flex items-center justify-between px-2.5 sm:px-4 py-1 sm:py-2">
          <span className="w-20" />
          <button
            type="button"
            onClick={handleReset}
            className="text-base sm:text-xl font-semibold text-white hover:opacity-90 transition-opacity cursor-pointer"
          >
            Pear<span className="text-[#34c759]">Navigator</span>
          </button>
          <Link href="/games/pear-navigator/results" className="text-xs sm:text-sm text-gray-500 hover:text-white/80 transition-colors">Results</Link>
      </div>

      <div className="flex-1 flex flex-col lg:flex-row gap-1.5 sm:gap-3 px-1.5 sm:px-3 pb-1.5 sm:pb-3 min-h-0 overflow-hidden">
        {/* Guide panel — mobile: compact so simulator dominates; lg+: side panel full height */}
        <div className="flex-none w-full lg:w-80 xl:w-96 2xl:w-[28rem] lg:min-w-[20rem] min-w-0 flex flex-col min-h-[80px] h-[16vh] sm:h-[20vh] md:h-[24vh] lg:h-auto lg:max-h-none bg-white/5 backdrop-blur-sm rounded-xl border border-white/10 shrink-0 self-stretch overflow-hidden">
            <div className="flex flex-col flex-1 min-h-0 p-1 sm:p-2 lg:p-6 overflow-y-auto scrollbar-needed">
              {phase === 'task' && (
                <>
                  <p className="text-[9px] sm:text-[10px] lg:text-xs font-semibold text-[#34c759] uppercase tracking-wider mb-0.5 shrink-0">
                    What do you want to do?
                  </p>
                  <h2 className="text-[10px] sm:text-xs lg:text-xl font-semibold text-white mb-0.5 shrink-0">Tell Pear Navigator your goal</h2>
                  <p className="text-gray-400 text-[9px] sm:text-[10px] mb-0.5 sm:mb-1 shrink-0">
                    Step-by-step guidance—tap the simulator to advance.
                  </p>
                  <div className="flex-1 min-h-0 overflow-y-auto scrollbar-needed space-y-0.5 sm:space-y-1 mb-0.5 sm:mb-2">
                    {TASK_ORDER.map((id) => {
                      const t = TASKS[id]
                      if (!t) return null
                      return (
                      <button
                        key={id}
                        type="button"
                        onClick={() => { setTaskId(id); setVariant(Math.random() < 0.5 ? 'a' : 'b'); }}
                        className={`w-full text-left px-1.5 sm:px-3 py-1 sm:py-2 min-h-[28px] sm:min-h-[36px] rounded-md lg:rounded-lg border transition-all text-[10px] sm:text-xs lg:text-base flex items-center justify-between gap-0.5 touch-manipulation ${
                          taskId === id
                            ? 'border-[#34c759] bg-[#34c759]/15 text-white'
                            : 'border-white/10 bg-white/5 text-gray-300 hover:border-[#34c759]/50'
                        }`}
                      >
                        <span className="min-w-0 truncate" title={`${t.app}: ${TASK_LABELS[id]}`}>{t.app}: {TASK_LABELS[id]}</span>
                        <span className="text-[9px] sm:text-xs text-white/50 shrink-0">{t.steps.length} steps</span>
                      </button>
                    )})}
                  </div>
                  <button
                    onClick={handleStart}
                    disabled={!taskId}
                    className="w-full py-1 sm:py-2 lg:py-3 min-h-[28px] sm:min-h-[36px] lg:min-h-[48px] rounded-md lg:rounded-lg bg-[#34c759] text-black font-semibold text-[10px] sm:text-xs lg:text-base disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90 transition-opacity touch-manipulation"
                  >
                    Start guide
                  </button>
                </>
              )}

              {phase === 'steps' && task && step && (
                <>
                  <p className="text-[9px] sm:text-[10px] font-semibold text-[#34c759] uppercase tracking-wider mb-0.5 shrink-0">
                    Step {stepIdx + 1} of {task.steps.length}
                  </p>
                  <h2 className="text-[10px] sm:text-xs lg:text-xl font-semibold text-white mb-0.5 shrink-0 leading-tight">{step.title}</h2>
                  <p className="text-gray-400 text-[9px] sm:text-[10px] mb-0.5 sm:mb-1">{step.desc}</p>
                  {step.hint && (
                    <div className="mb-0.5 sm:mb-1 p-1 sm:p-1.5 rounded bg-[#34c759]/15 border border-[#34c759]/30 text-[#34c759] text-[9px] sm:text-[10px]">
                      {step.hint}
                    </div>
                  )}
                  <p className="mb-0.5 sm:mb-1 text-[9px] sm:text-[10px] text-[#34c759]/90 font-medium shrink-0">
                    {isVariantB ? 'Do the action in the mock, then tap Next step ↓' : 'Tap the highlighted element to continue'}
                  </p>
                  <div className="flex gap-0.5 sm:gap-1 flex-wrap">
                    <button
                      onClick={() => setShowHighlight((h) => !h)}
                      className="flex-1 min-w-[60px] min-h-[26px] sm:min-h-[32px] py-1 sm:py-1.5 rounded border border-white/20 bg-white/5 text-white font-medium text-[9px] sm:text-[10px] hover:bg-white/10 transition-colors touch-manipulation"
                    >
                      {showHighlight ? 'Hide' : 'Show'} highlight
                    </button>
                    {!isFirstStep && (
                      <button
                        onClick={handlePrev}
                        className="min-h-[26px] sm:min-h-[32px] py-1 sm:py-1.5 px-1.5 sm:px-3 rounded border border-white/20 bg-white/5 text-white font-medium text-[9px] sm:text-[10px] hover:bg-white/10 transition-colors touch-manipulation"
                        aria-label="Previous step"
                      >
                        ← Prev
                      </button>
                    )}
                  </div>
                  {isVariantB && (
                    <button
                      onClick={handleNext}
                      className="w-full mt-1 sm:mt-2 py-2 sm:py-3 min-h-[40px] sm:min-h-[48px] rounded-lg bg-[#34c759] text-black font-semibold text-sm sm:text-base hover:opacity-90 transition-opacity touch-manipulation relative ring-4 ring-red-500 ring-offset-2 ring-offset-[#1a1a1a] shadow-[0_0_0_2px_rgba(239,68,68,0.9)]"
                      aria-label="Next step - tap to advance"
                    >
                      {isLastStep ? 'Finish' : 'Next step'}
                    </button>
                  )}
                </>
              )}

              {phase === 'done' && (
                <div className="flex flex-col gap-2 sm:gap-3 py-4 sm:py-6">
                  <div className="text-center">
                    <div className="text-3xl sm:text-4xl text-[#34c759] mb-2">✓</div>
                    <p className="text-white font-medium text-sm sm:text-base">
                      {feedbackRating != null ? `Thanks! You rated it "${feedbackRating}"` : 'Task complete'}
                    </p>
                    <p className="text-white/50 text-[10px] sm:text-xs mt-1">
                      View your work in the simulator →
                    </p>
                  </div>
                  {feedbackRating != null && (
                    <div className="flex flex-col sm:flex-row gap-2">
                      <button
                        onClick={handleReset}
                        className="flex-1 min-h-[40px] py-2 rounded-lg bg-[#34c759] text-black font-semibold text-sm hover:opacity-90 transition-opacity touch-manipulation"
                      >
                        Start over
                      </button>
                      <Link
                        href="/"
                        className="flex-1 min-h-[40px] py-2 rounded-lg border border-white/20 bg-white/5 text-white font-medium text-sm hover:bg-white/10 transition-colors touch-manipulation text-center flex items-center justify-center"
                      >
                        Go home
                      </Link>
                    </div>
                  )}
                </div>
              )}
            </div>
        </div>

        {/* Wrong-tap toast — safe-area aware for iPhone home indicator */}
        {wrongTapToast && (
          <div className="fixed bottom-safe left-1/2 -translate-x-1/2 z-50 px-6 py-3 rounded-xl bg-red-500/90 text-white font-medium text-sm shadow-lg transition-opacity duration-300 max-w-[calc(100vw-2rem)] mx-auto">
            {isVariantB ? 'Do the action in the mock, then tap Next step' : 'Tap the highlighted element to advance'}
          </div>
        )}

        {/* Feedback overlay — shows 1s after task done, closes when user answers */}
        {phase === 'done' && showFeedbackOverlay && feedbackRating == null && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <div className="text-center max-w-md w-full">
              <div className="text-5xl sm:text-6xl text-[#34c759] mb-4 sm:mb-6 pear-success">✓</div>
              <h2 className="text-xl sm:text-3xl font-bold text-white mb-2 sm:mb-4">Task complete</h2>
              <p className="text-gray-300 text-sm sm:text-lg mb-4 sm:mb-6">
                How useful was the guide?
              </p>
              <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 justify-center mb-4 sm:mb-6">
                {(['meh', 'good', 'great'] as const).map((r) => (
                  <button
                    key={r}
                    onClick={() => handleFeedback(r)}
                    className="min-h-[44px] sm:min-h-[48px] px-4 sm:px-6 py-2 sm:py-3 rounded-lg border border-white/20 bg-white/10 text-white font-medium text-sm sm:text-base hover:bg-white/20 transition-colors touch-manipulation capitalize"
                  >
                    {r}
                  </button>
                ))}
              </div>
              <p className="text-[10px] sm:text-xs text-white/50">
                Total: {Math.round((Date.now() - taskStartTimeRef.current) / 1000)}s · Avg: {task ? Math.round((Date.now() - taskStartTimeRef.current) / 1000 / task.steps.length) : 0}s/step
              </p>
            </div>
          </div>
        )}

        {/* Mock app preview — mobile: simulator dominates; lg+: flex fills; scrollbar visible when overflow */}
        <div className="flex-1 min-w-0 min-h-0 flex flex-col overflow-auto overscroll-contain scrollbar-needed">
          <div className="flex-1 min-h-0 flex items-center justify-center p-0 sm:p-1.5 overflow-hidden">
            <div className="relative w-full h-full max-w-7xl max-h-full rounded-lg sm:rounded-2xl md:rounded-3xl bg-[#1a1a1a] border sm:border-4 md:border-6 lg:border-8 border-[#2a2a2a] shadow-[inset_0_0_30px_rgba(0,0,0,0.5)] overflow-hidden">
              <div className="absolute inset-0 sm:inset-1 md:inset-2 lg:inset-3 rounded-[0.45rem] sm:rounded-xl md:rounded-2xl bg-[#3a3a3a] overflow-auto scrollbar-needed">
                {MockComponent ? (
                  <MockFillWrapper>
                    <MockComponent {...(phase === 'steps' && step?.hotspotId ? { currentHotspotId: step.hotspotId } : {})} onStepComplete={isVariantB ? () => {} : handleNext} {...(phase === 'steps' && !isVariantB && { onWrongTap: handleWrongTap })} showHighlight={phase === 'steps' && showHighlight} stepIdx={phase === 'steps' ? stepIdx : (task ? task.steps.length - 1 : 0)} {...(taskId ? { taskId } : {})} isVariantB={isVariantB} />
                  </MockFillWrapper>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
