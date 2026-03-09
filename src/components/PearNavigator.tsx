'use client'

import Link from 'next/link'
import React, { useState, useCallback, useRef, useEffect } from 'react'

const BRUSH_BLUE = '#60a5fa'
const BRUSH_YELLOW = '#fbbf24'

function SkyPaintCanvas({
  enabled,
  brushColor,
  hasBlend,
  onFirstStroke,
  className,
}: {
  enabled: boolean
  brushColor: 'blue' | 'yellow'
  hasBlend?: boolean
  onFirstStroke?: () => void
  className?: string
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const blueRef = useRef<HTMLCanvasElement>(null)
  const yellowRef = useRef<HTMLCanvasElement>(null)
  const isDrawingRef = useRef(false)
  const strokeCountRef = useRef(0)
  const hasAdvancedRef = useRef(false)
  const strokeColorRef = useRef<'blue' | 'yellow'>('blue')
  const STROKES_NEEDED = 3

  const setupCanvas = useCallback((canvas: HTMLCanvasElement | null) => {
    if (!enabled || !containerRef.current || !canvas) return
    const container = containerRef.current
    const resize = () => {
      const rect = container.getBoundingClientRect()
      const dpr = window.devicePixelRatio || 1
      canvas.width = rect.width * dpr
      canvas.height = rect.height * dpr
      canvas.style.width = `${rect.width}px`
      canvas.style.height = `${rect.height}px`
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      ctx.scale(dpr, dpr)
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
      ctx.lineWidth = 24
    }
    resize()
  }, [enabled])

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
  }, [enabled, setupCanvas])

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
        strokeCountRef.current += 1
        if (strokeCountRef.current >= STROKES_NEEDED && !hasAdvancedRef.current) {
          hasAdvancedRef.current = true
          onFirstStroke?.()
        }
      }
      isDrawingRef.current = false
    },
    [enabled, onFirstStroke]
  )

  if (!enabled) return null
  return (
    <div ref={containerRef} className={`absolute inset-0 ${className ?? ''}`}>
      <canvas ref={blueRef} className="absolute inset-0 w-full h-full pointer-events-none" />
      <div className="absolute inset-0 w-full h-full" style={hasBlend ? { mixBlendMode: 'overlay' } : undefined}>
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
}

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
  mock: 'figma' | 'procreate' | 'notion'
}

const TASKS: Record<string, Task> = {
  procreateBrush: {
    app: 'Procreate (PearPad)',
    mock: 'procreate',
    steps: [
      { title: 'Open Brush Library', desc: 'Tap the brush icon to open the Brush Library.', hint: 'Swipe left on a brush to duplicate', highlight: { x: 280, y: 14, w: 80, h: 36 }, hotspotId: 'proc-brush' },
      { title: 'Create new brush', desc: 'Tap + in the Brush Library. Select "Create new brush" to enter Brush Studio.', hint: 'Duplicate an existing brush first for a baseline', highlight: { x: 24, y: 70, w: 60, h: 36 }, hotspotId: 'proc-new' },
      { title: 'Adjust shape', desc: 'In Brush Studio, tap Shape. Choose a brush tip shape (round, square, etc.).', hint: 'Shape defines the brush footprint', highlight: { x: 520, y: 100, w: 80, h: 32 }, hotspotId: 'proc-shape' },
      { title: 'Adjust grain', desc: 'Tap Grain. Import or pick a texture for the brush.', hint: 'Import custom grain images for texture', highlight: { x: 520, y: 100, w: 80, h: 32 }, hotspotId: 'proc-shape' },
      { title: 'Set dynamics', desc: 'Tap Dynamics. Adjust Size, Opacity, Flow for pressure response.', hint: '14 attributes total; Dynamics controls stroke behavior', highlight: { x: 520, y: 160, w: 80, h: 32 }, hotspotId: 'proc-dynamics' },
      { title: 'Set size and opacity', desc: 'In Dynamics, set Size Jitter and Opacity Jitter for variation.', hint: 'Pressure and tilt affect the stroke', highlight: { x: 520, y: 160, w: 80, h: 32 }, hotspotId: 'proc-dynamics' },
      { title: 'Save brush', desc: 'Tap Done to exit Brush Studio and save your brush.', hint: 'Brush appears in your library', highlight: { x: 300, y: 320, w: 100, h: 36 }, hotspotId: 'proc-done' },
      { title: 'Name your brush', desc: 'In the Brush Library, tap your new brush to rename it.', hint: 'Organize brushes into sets', highlight: { x: 24, y: 120, w: 80, h: 36 }, hotspotId: 'proc-name-brush' },
      { title: 'Test your brush', desc: 'Tap the canvas to draw a stroke and see your custom brush in action.', hint: 'Pressure and tilt affect the stroke', highlight: { x: 120, y: 80, w: 280, h: 200 }, hotspotId: 'proc-canvas' },
    ],
  },
  procreateSky: {
    app: 'Procreate (PearPad)',
    mock: 'procreate',
    steps: [
      { title: 'Open Brush Library', desc: 'Tap the brush icon to open the Brush Library.', hint: 'Brush Library shows your brush sets', highlight: { x: 280, y: 14, w: 80, h: 36 }, hotspotId: 'proc-brush' },
      { title: 'Create new brush', desc: 'Tap + in the Brush Library to create a new brush.', hint: 'Creates a custom brush in Brush Studio', highlight: { x: 24, y: 70, w: 60, h: 36 }, hotspotId: 'proc-new' },
      { title: 'Adjust shape and grain', desc: 'In Brush Studio, tap Shape and Grain to customize the brush tip for texture.', hint: 'Import custom grain images for texture', highlight: { x: 520, y: 100, w: 80, h: 32 }, hotspotId: 'proc-shape' },
      { title: 'Set dynamics', desc: 'Tap Dynamics. Adjust Size, Opacity, Flow for pressure response.', hint: 'Apple Pencil pressure controls stroke variation', highlight: { x: 520, y: 160, w: 80, h: 32 }, hotspotId: 'proc-dynamics' },
      { title: 'Save brush', desc: 'Tap Done to exit Brush Studio and save your brush.', hint: 'Organize brushes into sets', highlight: { x: 300, y: 320, w: 100, h: 36 }, hotspotId: 'proc-done' },
      { title: 'Pick sky color', desc: 'Tap the color disc. Choose a soft blue for the base sky.', hint: 'HSV wheel or hex input', highlight: { x: 260, y: 14, w: 48, h: 36 }, hotspotId: 'proc-color' },
      { title: 'Add new layer', desc: 'Tap + in the Layers panel to add a new layer for the sky.', hint: 'Layers stack; sky above background', highlight: { x: 24, y: 120, w: 60, h: 36 }, hotspotId: 'proc-layer' },
      { title: 'Pick accent color', desc: 'Tap the color disc again. Choose yellow or orange for accent strokes.', hint: 'Overlap blue and yellow for gradient blend', highlight: { x: 260, y: 14, w: 48, h: 36 }, hotspotId: 'proc-color' },
      { title: 'Paint the sky', desc: 'Paint on the canvas. Make 3+ strokes with blue and yellow for a textured gradient.', hint: 'Paint blue first, then yellow—overlap for blend', highlight: { x: 120, y: 80, w: 280, h: 200 }, hotspotId: 'proc-canvas' },
      { title: 'Set blend mode', desc: 'Select the layer and tap N. Choose Overlay or Multiply for depth.', hint: 'Overlay adds contrast; Multiply darkens', highlight: { x: 520, y: 60, w: 80, h: 28 }, hotspotId: 'proc-blend' },
      { title: 'Set layer opacity', desc: 'In the layer panel, adjust opacity (e.g. 80%) for a softer sky.', hint: 'Opacity affects blending with layers below', highlight: { x: 520, y: 60, w: 80, h: 28 }, hotspotId: 'proc-blend' },
      { title: 'Open export menu', desc: 'Tap the wrench icon to open Actions. Tap Share.', hint: 'Share exports your artwork', highlight: { x: 24, y: 14, w: 48, h: 36 }, hotspotId: 'proc-export' },
      { title: 'Choose export format', desc: 'Select PNG, PSD, or Procreate to save your textured sky.', hint: 'PNG for web; PSD for editing', highlight: { x: 24, y: 14, w: 48, h: 36 }, hotspotId: 'proc-export-format' },
    ],
  },
  notionDb: {
    app: 'Notion (PearPad)',
    mock: 'notion',
    steps: [
      { title: 'Create new page', desc: 'Tap + in the sidebar to create a new page.', hint: 'Use templates for quick start', highlight: { x: 24, y: 60, w: 90, h: 36 }, hotspotId: 'notion-new' },
      { title: 'Add database block', desc: 'Type /table or /database and select Table – Inline.', hint: 'Database can be full-page or inline', highlight: { x: 180, y: 120, w: 120, h: 32 }, hotspotId: 'notion-db' },
      { title: 'Add Status property', desc: 'Tap + Add in Properties. Add a Status column (To do, In progress, Done).', hint: 'Status is essential for PM workflows', highlight: { x: 480, y: 80, w: 100, h: 28 }, hotspotId: 'notion-props' },
      { title: 'Add Date property', desc: 'Tap + Add again. Add a Date column for due dates.', hint: 'Date supports reminders and sorting', highlight: { x: 480, y: 80, w: 100, h: 28 }, hotspotId: 'notion-props' },
      { title: 'Add first row', desc: 'Tap + New in the table to add your first task row.', hint: 'Rows are your database entries', highlight: { x: 180, y: 180, w: 100, h: 32 }, hotspotId: 'notion-add-row' },
      { title: 'Add second row', desc: 'Add another row. Build out your task list.', hint: 'Each row = one item', highlight: { x: 180, y: 220, w: 100, h: 32 }, hotspotId: 'notion-add-row' },
      { title: 'Create linked view', desc: 'Tap + Add a View. Choose New linked view.', hint: 'Same data, different layouts', highlight: { x: 520, y: 140, w: 80, h: 32 }, hotspotId: 'notion-linked' },
      { title: 'Switch to Board view', desc: 'In the view switcher, select Board to see cards by Status.', hint: 'Board = Kanban-style columns', highlight: { x: 520, y: 140, w: 80, h: 32 }, hotspotId: 'notion-linked' },
      { title: 'Add filter', desc: 'Tap Filter. Add a condition (e.g. Status = In progress).', hint: 'Filters apply to current view only', highlight: { x: 520, y: 200, w: 70, h: 28 }, hotspotId: 'notion-filter' },
      { title: 'Apply filter', desc: 'Confirm the filter. Your view now shows only matching rows.', hint: 'Focus on what matters', highlight: { x: 520, y: 200, w: 70, h: 28 }, hotspotId: 'notion-filter' },
    ],
  },
  figmaVariants: {
    app: 'Figma (PearPad)',
    mock: 'figma',
    steps: [
      { title: 'Select layers', desc: 'Select the frame or group you want to turn into a component.', hint: 'Components are reusable', highlight: { x: 180, y: 100, w: 180, h: 80 }, hotspotId: 'fig-canvas' },
      { title: 'Create component', desc: 'Click "Create component" in the right sidebar (or Cmd+Alt+K).', hint: 'Component icon appears in Layers', highlight: { x: 520, y: 60, w: 100, h: 36 }, hotspotId: 'fig-component-tab' },
      { title: 'Add property', desc: 'Under Component, tap + to add a property. Name it State, type Variant.', hint: 'Variant = one property, multiple values', highlight: { x: 520, y: 100, w: 80, h: 32 }, hotspotId: 'fig-component-add' },
      { title: 'Add Default variant', desc: 'Tap Add variant. The first value is Default.', hint: 'Each value = one variant', highlight: { x: 500, y: 160, w: 100, h: 40 }, hotspotId: 'fig-variants' },
      { title: 'Add Hover variant', desc: 'Tap Add variant again. Add Hover for mouse-over state.', hint: 'Hover = interactive feedback', highlight: { x: 500, y: 160, w: 100, h: 40 }, hotspotId: 'fig-variants' },
      { title: 'Add Pressed variant', desc: 'Tap Add variant again. Add Pressed for click state.', hint: 'Pressed = active/clicked', highlight: { x: 500, y: 160, w: 100, h: 40 }, hotspotId: 'fig-variants' },
      { title: 'Swap to Default', desc: 'Select an instance. Use the property dropdown to set State = Default.', hint: 'Instances inherit component changes', highlight: { x: 510, y: 240, w: 90, h: 36 }, hotspotId: 'fig-swap' },
      { title: 'Swap to Hover', desc: 'Swap the instance to Hover. See the visual change on canvas.', hint: 'Preview each variant', highlight: { x: 510, y: 240, w: 90, h: 36 }, hotspotId: 'fig-swap' },
      { title: 'Swap to Pressed', desc: 'Swap to Pressed. You can now use all three variants in designs.', hint: 'Done—variants ready', highlight: { x: 510, y: 240, w: 90, h: 36 }, hotspotId: 'fig-swap' },
    ],
  },
  figmaMindmap: {
    app: 'Figma (PearPad)',
    mock: 'figma',
    steps: [
      { title: 'Create central frame', desc: 'Select the Frame tool and draw a frame for your central idea.', hint: 'Tap the canvas area to place the frame', highlight: { x: 180, y: 100, w: 120, h: 60 }, hotspotId: 'fig-canvas' },
      { title: 'Add text to frame', desc: 'Double-tap the frame and type your central topic (e.g. "Project").', hint: 'The frame becomes editable when selected', highlight: { x: 200, y: 110, w: 80, h: 40 }, hotspotId: 'fig-text' },
      { title: 'Create component', desc: 'Select the frame and tap Create component to make it reusable.', hint: 'Components let you add instances for branches', highlight: { x: 520, y: 60, w: 100, h: 36 }, hotspotId: 'fig-component-tab' },
      { title: 'Add first instance', desc: 'Tap Instance to add your first branch idea.', hint: 'Instances are copies linked to the main component', highlight: { x: 180, y: 180, w: 100, h: 50 }, hotspotId: 'fig-instance' },
      { title: 'Add instance', desc: 'Tap + Instance to add another idea (Idea A).', hint: 'Each instance is a branch node', highlight: { x: 520, y: 100, w: 90, h: 45 }, hotspotId: 'fig-instance2' },
      { title: 'Add instance', desc: 'Tap + Instance for Idea B.', hint: 'Build out your mindmap branches', highlight: { x: 520, y: 100, w: 90, h: 45 }, hotspotId: 'fig-instance2' },
      { title: 'Add instance', desc: 'Tap + Instance for Idea C.', hint: 'Keep adding until you have 9 nodes', highlight: { x: 520, y: 100, w: 90, h: 45 }, hotspotId: 'fig-instance2' },
      { title: 'Add instance', desc: 'Tap + Instance for Idea D.', hint: 'Instances link to the main component', highlight: { x: 520, y: 100, w: 90, h: 45 }, hotspotId: 'fig-instance2' },
      { title: 'Add instance', desc: 'Tap + Instance for Idea E.', hint: 'Edit one; all instances update', highlight: { x: 520, y: 100, w: 90, h: 45 }, hotspotId: 'fig-instance2' },
      { title: 'Add instance', desc: 'Tap + Instance for Idea F.', hint: 'Almost there—a few more nodes', highlight: { x: 520, y: 100, w: 90, h: 45 }, hotspotId: 'fig-instance2' },
      { title: 'Add instance', desc: 'Tap + Instance for Idea G.', hint: 'Two more to go', highlight: { x: 520, y: 100, w: 90, h: 45 }, hotspotId: 'fig-instance2' },
      { title: 'Add instance', desc: 'Tap + Instance for Idea H.', hint: 'One more node', highlight: { x: 520, y: 100, w: 90, h: 45 }, hotspotId: 'fig-instance2' },
      { title: 'Add instance', desc: 'Tap + Instance for Idea I.', hint: 'Last branch—then connectors', highlight: { x: 520, y: 100, w: 90, h: 45 }, hotspotId: 'fig-instance2' },
      { title: 'Add connectors', desc: 'Tap Connector to draw lines linking the central node to each branch.', hint: 'Connectors show relationships between ideas', highlight: { x: 520, y: 140, w: 80, h: 32 }, hotspotId: 'fig-connector' },
      { title: 'Style connectors', desc: 'Select connectors. Set stroke weight and color for clarity.', hint: 'Thicker lines for emphasis', highlight: { x: 520, y: 140, w: 80, h: 32 }, hotspotId: 'fig-connector' },
      { title: 'Auto layout', desc: 'Tap Auto layout for consistent spacing between nodes.', hint: 'Keeps the mindmap tidy and readable', highlight: { x: 520, y: 180, w: 90, h: 32 }, hotspotId: 'fig-autolayout' },
      { title: 'Adjust spacing', desc: 'In Auto layout, adjust gap and padding between nodes.', hint: 'Fine-tune the layout', highlight: { x: 520, y: 180, w: 90, h: 32 }, hotspotId: 'fig-autolayout' },
      { title: 'Fill with example', desc: 'Tap Fill example to populate with a Product Management example.', hint: 'OKR, KPI, Agile, Roadmap, Jira, etc.', highlight: { x: 520, y: 220, w: 100, h: 36 }, hotspotId: 'fig-style' },
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
  return (
    <button
      type="button"
      onClick={() => {
        if (isTarget) onStepComplete()
        else if (showHighlight && currentHotspotId) onWrongTap?.()
      }}
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

const TASK_LABELS: Record<string, string> = {
  procreateBrush: 'Create custom brush',
  procreateSky: 'Paint a textured sky',
  notionDb: 'Create linked database view',
  figmaVariants: 'Create component variants',
  figmaMindmap: 'Create a mindmap',
}

const CLUTTER_CLASS = 'px-2 py-1 rounded bg-white/5 text-white/45 text-xs pointer-events-none shrink-0'
const HOTSPOT_BTN = 'min-h-[44px] rounded-lg flex items-center px-3 text-sm font-medium'
const HOTSPOT_INACTIVE = 'bg-[#34c759]/20 text-[#34c759]'
const HOTSPOT_ACTIVE = 'bg-[#34c759]/30 text-[#34c759] ring-2 ring-[#34c759]/50'

function FigmaMock({ currentHotspotId, onStepComplete, onWrongTap, showHighlight, stepIdx = 0, taskId }: MockProps) {
  const [swapVariant, setSwapVariant] = useState<'Default' | 'Hover' | 'Pressed'>('Default')
  const isMindmap = taskId === 'figmaMindmap'
  const hasSelection = stepIdx >= 1
  const isComponent = stepIdx >= 2
  const hasVariants = stepIdx >= 4
  const hasCentralFrame = isMindmap && stepIdx >= 1
  const hasText = isMindmap && stepIdx >= 2
  const hasComponent = isMindmap && stepIdx >= 3
  const instanceCount = isMindmap && stepIdx >= 4 ? Math.min(stepIdx - 3, 9) : 0
  const hasConnectors = isMindmap && stepIdx >= 15
  const hasAutoLayout = isMindmap && stepIdx >= 16
  const hasStyle = isMindmap && stepIdx >= 18
  // Stacked (before Auto layout): nodes offset like fanned deck; Radial (after): spread out
  const STACKED_POS = [
    { left: '48%', top: '47%' }, { left: '50%', top: '49%' }, { left: '52%', top: '48%' },
    { left: '49%', top: '51%' }, { left: '51%', top: '50%' }, { left: '48%', top: '52%' },
    { left: '50%', top: '48%' }, { left: '52%', top: '51%' }, { left: '49%', top: '50%' },
  ]
  const RADIAL_POS = hasAutoLayout
    ? [
        { left: '50%', top: '18%' }, { left: '71%', top: '25%' }, { left: '83%', top: '45%' },
        { left: '79%', top: '67%' }, { left: '61%', top: '81%' }, { left: '39%', top: '81%' },
        { left: '21%', top: '67%' }, { left: '17%', top: '45%' }, { left: '29%', top: '25%' },
      ]
    : STACKED_POS
  const RADIAL_SVG = hasAutoLayout
    ? [[50, 18], [71, 25], [83, 45], [79, 67], [61, 81], [39, 81], [21, 67], [17, 45], [29, 25]]
    : [[48, 47], [50, 49], [52, 48], [49, 51], [51, 50], [48, 52], [50, 48], [52, 51], [49, 50]]
  const clutter = (label: string) => <div key={label} className={CLUTTER_CLASS}>{label}</div>
  if (isMindmap) {
    return (
      <div className="absolute inset-0 flex flex-col text-sm">
        <div className="h-12 bg-[#2e2e2e] border-b border-white/15 flex items-center px-6 gap-6 shrink-0">
          <span className="text-white/80">Frame</span>
          <span className="text-white/80">Component</span>
          <span className="text-white/80">Prototype</span>
        </div>
        <div className="h-10 bg-[#252525] border-b border-white/10 flex items-center px-4 gap-2 shrink-0 flex-wrap overflow-hidden">
          {['Move', 'Frame', 'Component', 'Pen', 'Text', 'Rectangle', 'Line', 'Hand', 'Comment', 'Zoom', 'Align L', 'Align C', 'Align R', 'Distribute', 'Constraints', 'Fill', 'Stroke', 'Effects', 'Mask', 'Boolean'].map(clutter)}
        </div>
        <div className="flex flex-1 min-h-0">
          <div className="w-36 bg-[#323232] border-r border-white/10 p-3 shrink-0 flex flex-col gap-2 overflow-y-auto">
            <div className="text-white/50 text-xs font-medium">Layers</div>
            {hasCentralFrame && (
              <>
                <div className="h-7 px-2 rounded bg-[#34c759]/15 text-[#34c759] text-xs flex items-center">Project</div>
                {instanceCount > 0 && Array.from({ length: instanceCount }).map((_, i) => (
                  <div key={i} className="h-6 pl-4 pr-2 rounded bg-white/5 text-white/50 text-xs flex items-center">Idea {String.fromCharCode(65 + i)}</div>
                ))}
              </>
            )}
            {!hasCentralFrame && ['Page 1', 'Frame', 'Group'].map((l) => <div key={l} className="h-7 px-2 rounded bg-white/5 text-white/45 text-xs flex items-center">{l}</div>)}
            <div className="text-white/50 text-xs font-medium mt-2">Pages</div>
            {['Cover', 'Flow', 'Components'].map((p) => <div key={p} className="h-6 px-2 rounded bg-white/5 text-white/40 text-xs flex items-center">{p}</div>)}
          </div>
          <HotspotButton id="fig-canvas" currentHotspotId={currentHotspotId} onStepComplete={onStepComplete} {...(onWrongTap != null && { onWrongTap })} showHighlight={showHighlight} className="flex-1 min-w-0 flex flex-col min-h-0">
            <div className="flex-1 p-6 bg-[#404040] min-w-0 min-h-0 flex items-center justify-center overflow-auto">
              <div className="relative w-full h-full min-h-[200px] border-2 border-dashed rounded-lg border-white/20 flex items-center justify-center">
                {hasConnectors && !hasStyle && instanceCount > 0 && (
                  <svg className="absolute inset-0 w-full h-full pointer-events-none z-0" viewBox="0 0 100 100" preserveAspectRatio="none">
                    {RADIAL_SVG.slice(0, instanceCount).map(([x2, y2], i) => (
                      <line key={i} x1="50" y1="50" x2={x2} y2={y2} stroke="rgba(255,255,255,0.4)" strokeWidth="0.5" />
                    ))}
                  </svg>
                )}
                {hasCentralFrame && !hasStyle && (
                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-10">
                    <HotspotButton id="fig-text" currentHotspotId={currentHotspotId} onStepComplete={onStepComplete} {...(onWrongTap != null && { onWrongTap })} showHighlight={showHighlight}>
                      <div className={`rounded-full px-6 py-3 ${hasStyle ? 'px-16 py-8 text-xl' : 'px-6 py-3 text-base'} ${hasComponent ? `border-2 border-[#8b5cf6] ${hasAutoLayout ? 'bg-[#4c1d95]' : 'bg-[#8b5cf6]/20'}` : `border border-white/30 ${hasAutoLayout ? 'bg-[#4a4a4a]' : 'bg-white/10'}`} ${hasStyle ? 'bg-[#1a5c2e] border-2 border-[#34c759]/60' : ''} ${currentHotspotId === 'fig-text' ? 'ring-2 ring-[#34c759]/50' : ''}`}>
                        {hasText && <span className="text-white font-medium">{hasStyle ? 'Product Mgmt' : 'Project'}</span>}
                        {!hasText && <span className="text-white/40">Frame</span>}
                      </div>
                    </HotspotButton>
                  </div>
                )}
                {instanceCount > 0 && !hasStyle && (() => {
                  const labels = ['Idea A', 'Idea B', 'Idea C', 'Idea D', 'Idea E', 'Idea F', 'Idea G', 'Idea H', 'Idea I']
                  const bubbleBg = hasAutoLayout ? 'bg-[#4a4a4a]' : 'bg-white/10'
                  return (
                    <>
                      {Array.from({ length: instanceCount }).map((_, i) => (
                        <div key={i} className={`absolute rounded-full px-5 py-2.5 text-sm ${bubbleBg} border border-white/25 whitespace-nowrap -translate-x-1/2 -translate-y-1/2 z-10`} style={{ left: RADIAL_POS[i]!.left, top: RADIAL_POS[i]!.top }}>{labels[i]}</div>
                      ))}
                    </>
                  )
                })()}
                {hasStyle && (() => {
                  const pmLabels = ['OKR', 'KPI', 'MVP', 'ROI', 'PRD', 'GTM', 'Agile', 'Roadmap', 'Jira']
                  const pmStyles = [
                    { bg: 'rgba(59,130,246,0.95)', border: 'rgba(96,165,250,0.8)' },
                    { bg: 'rgba(59,130,246,0.95)', border: 'rgba(96,165,250,0.8)' },
                    { bg: 'rgba(59,130,246,0.95)', border: 'rgba(96,165,250,0.8)' },
                    { bg: 'rgba(59,130,246,0.95)', border: 'rgba(96,165,250,0.8)' },
                    { bg: 'rgba(59,130,246,0.95)', border: 'rgba(96,165,250,0.8)' },
                    { bg: 'rgba(59,130,246,0.95)', border: 'rgba(96,165,250,0.8)' },
                    { bg: 'rgba(219,39,119,0.95)', border: 'rgba(244,114,182,0.8)' },
                    { bg: 'rgba(20,184,166,0.95)', border: 'rgba(52,211,153,0.8)' },
                    { bg: 'rgba(217,119,6,0.95)', border: 'rgba(251,191,36,0.8)' },
                  ]
                  return (
                    <>
                      <svg className="absolute inset-0 w-full h-full pointer-events-none z-0" viewBox="0 0 100 100" preserveAspectRatio="none">
                        {RADIAL_SVG.map(([x2, y2], i) => (
                          <line key={i} x1="50" y1="50" x2={x2} y2={y2} stroke="rgba(255,255,255,0.35)" strokeWidth="0.5" />
                        ))}
                      </svg>
                      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-10">
                        <div className="rounded-full px-8 py-4 bg-[#1a5c2e] border-2 border-[#34c759]/60 text-white font-bold text-xl">Product Mgmt</div>
                      </div>
                      {pmLabels.map((t, i) => (
                        <div key={t} className="absolute rounded-full px-5 py-2.5 text-sm font-medium text-white whitespace-nowrap -translate-x-1/2 -translate-y-1/2 z-10" style={{ left: RADIAL_POS[i]!.left, top: RADIAL_POS[i]!.top }}>
                          <span className="rounded-full px-4 py-2" style={{ backgroundColor: pmStyles[i]!.bg, border: `2px solid ${pmStyles[i]!.border}` }}>{t}</span>
                        </div>
                      ))}
                    </>
                  )
                })()}
                {!hasCentralFrame && !hasStyle && <span className="text-white/40 text-sm">Canvas</span>}
              </div>
            </div>
          </HotspotButton>
          <div className="w-52 bg-[#383838] border-l border-white/15 p-5 shrink-0 flex flex-col gap-3 overflow-y-auto">
            <div className="text-white/50 text-xs font-medium">Design</div>
            {['Layout', 'Fill', 'Stroke', 'Effects', 'Corner', 'Padding', 'Gap'].map(clutter)}
            <HotspotButton id="fig-component-tab" currentHotspotId={currentHotspotId} onStepComplete={onStepComplete} {...(onWrongTap != null && { onWrongTap })} showHighlight={showHighlight}>
              <div className={`${HOTSPOT_BTN} ${currentHotspotId === 'fig-component-tab' ? HOTSPOT_ACTIVE : HOTSPOT_INACTIVE}`}>Create component</div>
            </HotspotButton>
            {['Constraints', 'Resize', 'Opacity', 'Blend'].map(clutter)}
            <HotspotButton id="fig-instance" currentHotspotId={currentHotspotId} onStepComplete={onStepComplete} {...(onWrongTap != null && { onWrongTap })} showHighlight={showHighlight}>
              <div className={`${HOTSPOT_BTN} ${currentHotspotId === 'fig-instance' ? HOTSPOT_ACTIVE : HOTSPOT_INACTIVE}`}>Instance</div>
            </HotspotButton>
            <HotspotButton id="fig-instance2" currentHotspotId={currentHotspotId} onStepComplete={onStepComplete} {...(onWrongTap != null && { onWrongTap })} showHighlight={showHighlight}>
              <div className={`${HOTSPOT_BTN} ${currentHotspotId === 'fig-instance2' ? HOTSPOT_ACTIVE : HOTSPOT_INACTIVE}`}>+ Instance</div>
            </HotspotButton>
            <HotspotButton id="fig-connector" currentHotspotId={currentHotspotId} onStepComplete={onStepComplete} {...(onWrongTap != null && { onWrongTap })} showHighlight={showHighlight}>
              <div className={`${HOTSPOT_BTN} ${currentHotspotId === 'fig-connector' ? HOTSPOT_ACTIVE : HOTSPOT_INACTIVE}`}>Connector</div>
            </HotspotButton>
            <HotspotButton id="fig-autolayout" currentHotspotId={currentHotspotId} onStepComplete={onStepComplete} {...(onWrongTap != null && { onWrongTap })} showHighlight={showHighlight}>
              <div className={`${HOTSPOT_BTN} ${currentHotspotId === 'fig-autolayout' ? HOTSPOT_ACTIVE : HOTSPOT_INACTIVE}`}>Auto layout</div>
            </HotspotButton>
            <HotspotButton id="fig-style" currentHotspotId={currentHotspotId} onStepComplete={onStepComplete} {...(onWrongTap != null && { onWrongTap })} showHighlight={showHighlight}>
              <div className={`${HOTSPOT_BTN} ${currentHotspotId === 'fig-style' ? HOTSPOT_ACTIVE : HOTSPOT_INACTIVE}`}>Fill example</div>
            </HotspotButton>
          </div>
        </div>
      </div>
    )
  }
  return (
    <div className="absolute inset-0 flex flex-col text-sm">
      <div className="h-12 bg-[#2e2e2e] border-b border-white/15 flex items-center px-6 gap-6 shrink-0">
        <span className="text-white/80">Frame</span>
        <span className="text-white/80">Component</span>
        <span className="text-white/80">Prototype</span>
      </div>
      <div className="h-10 bg-[#252525] border-b border-white/10 flex items-center px-4 gap-2 shrink-0 flex-wrap overflow-hidden">
        {['Move', 'Frame', 'Component', 'Pen', 'Text', 'Rectangle', 'Line', 'Hand', 'Comment', 'Zoom', 'Align L', 'Align C', 'Distribute', 'Constraints', 'Fill', 'Stroke', 'Effects', 'Mask'].map(clutter)}
      </div>
      <div className="flex flex-1 min-h-0">
        <div className="w-36 bg-[#323232] border-r border-white/10 p-3 shrink-0 flex flex-col gap-2 overflow-y-auto pointer-events-none">
          <div className="text-white/50 text-xs font-medium">Layers</div>
          {['Frame', 'Group', 'Rectangle', 'Text', 'Component'].map((l) => <div key={l} className="h-7 px-2 rounded bg-white/5 text-white/45 text-xs flex items-center pointer-events-none">{l}</div>)}
          <div className="text-white/50 text-xs font-medium mt-2">Pages</div>
          {['Cover', 'Flow', 'Components'].map((p) => <div key={p} className="h-6 px-2 rounded bg-white/5 text-white/40 text-xs flex items-center">{p}</div>)}
          <div className="text-white/50 text-xs font-medium mt-2">Assets</div>
          <div className="h-6 px-2 rounded bg-white/5 text-white/40 text-xs flex items-center">Search...</div>
        </div>
        <HotspotButton id="fig-canvas" currentHotspotId={currentHotspotId} onStepComplete={onStepComplete} {...(onWrongTap != null && { onWrongTap })} showHighlight={showHighlight} className="flex-1 min-w-0 flex flex-col min-h-0">
          <div className="flex-1 p-6 bg-[#404040] min-w-0 min-h-0 flex items-center justify-center">
            <div className={`relative w-full max-w-md aspect-video rounded-xl flex flex-col items-center justify-center gap-3 transition-all duration-200 ${hasSelection ? 'border-2 border-[#8b5cf6] bg-[#8b5cf6]/10' : 'border-2 border-dashed border-white/25'} ${currentHotspotId === 'fig-canvas' ? 'ring-2 ring-[#34c759]/50' : ''}`}>
              {!hasSelection && <span className="text-white/40 text-sm">Tap to select frame</span>}
              {hasSelection && (
                <>
                  <div className={`w-32 h-20 rounded-lg flex items-center justify-center text-sm font-medium transition-all duration-200 ${isComponent ? 'border-2 border-[#8b5cf6] text-white' : 'bg-white/20 text-white/90'} ${hasVariants ? swapVariant === 'Hover' ? 'bg-[#8b5cf6]/50 scale-105' : swapVariant === 'Pressed' ? 'bg-[#6d28d9] scale-95' : 'bg-[#8b5cf6]/30' : 'bg-[#8b5cf6]/30'}`}>
                    Button
                  </div>
                  {isComponent && <span className="text-[#8b5cf6] text-xs font-medium">Main component</span>}
                  {hasVariants && (
                    <div className="flex gap-2 mt-1">
                      {(['Default', 'Hover', 'Pressed'] as const).map((v) => (
                        <span key={v} className={`px-2.5 py-1 rounded text-xs ${swapVariant === v ? 'bg-[#34c759]/30 text-[#34c759] font-medium' : 'bg-[#34c759]/20 text-[#34c759]'}`}>{v}</span>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </HotspotButton>
        <div className="w-44 bg-[#383838] border-l border-white/15 p-4 shrink-0 flex flex-col gap-2 overflow-y-auto">
          <div className="text-white/50 text-xs font-medium">Design</div>
          {['Layout', 'Fill', 'Stroke', 'Effects', 'Corner', 'Padding', 'Gap', 'Constraints'].map(clutter)}
          <HotspotButton id="fig-component-tab" currentHotspotId={currentHotspotId} onStepComplete={onStepComplete} {...(onWrongTap != null && { onWrongTap })} showHighlight={showHighlight}>
            <div className={`${HOTSPOT_BTN} ${currentHotspotId === 'fig-component-tab' ? HOTSPOT_ACTIVE : HOTSPOT_INACTIVE}`}>Create component</div>
          </HotspotButton>
          {currentHotspotId === 'fig-component-tab' && (
            <div className="p-3 rounded-lg bg-[#454545] border border-white/10 text-xs text-white/70">Creates main component</div>
          )}
          <div className="text-white/50 text-xs font-medium mt-1">Component</div>
          <HotspotButton id="fig-component-add" currentHotspotId={currentHotspotId} onStepComplete={onStepComplete} {...(onWrongTap != null && { onWrongTap })} showHighlight={showHighlight}>
            <div className={`${HOTSPOT_BTN} ${currentHotspotId === 'fig-component-add' ? HOTSPOT_ACTIVE : HOTSPOT_INACTIVE}`}>+ Property</div>
          </HotspotButton>
          {currentHotspotId === 'fig-component-add' && (
            <div className="p-3 rounded-lg bg-[#454545] border border-white/10 space-y-1">
              <div className="text-white/70 text-xs">Add property:</div>
              <div className="flex gap-1"><div className="px-3 py-1.5 rounded bg-[#34c759]/20 text-[#34c759] text-xs">State</div><div className="px-3 py-1.5 rounded bg-white/10 text-white/50 text-xs">Size</div></div>
            </div>
          )}
          <HotspotButton id="fig-variants" currentHotspotId={currentHotspotId} onStepComplete={onStepComplete} {...(onWrongTap != null && { onWrongTap })} showHighlight={showHighlight}>
            <div className={`${HOTSPOT_BTN} ${currentHotspotId === 'fig-variants' ? HOTSPOT_ACTIVE : HOTSPOT_INACTIVE}`}>Variants</div>
          </HotspotButton>
          {currentHotspotId === 'fig-variants' && (
            <div className="p-3 rounded-lg bg-[#454545] border border-white/10 space-y-1">
              <div className="text-white/70 text-xs">Values:</div>
              <div className="flex flex-wrap gap-1"><span className="px-2.5 py-1 rounded bg-[#34c759]/20 text-[#34c759] text-xs">Default</span><span className="px-2.5 py-1 rounded bg-white/10 text-xs">Hover</span><span className="px-2.5 py-1 rounded bg-white/10 text-xs">Pressed</span></div>
            </div>
          )}
          <HotspotButton id="fig-swap" currentHotspotId={currentHotspotId} onStepComplete={hasVariants ? () => { setSwapVariant((v) => (v === 'Default' ? 'Hover' : v === 'Hover' ? 'Pressed' : 'Default')); setTimeout(onStepComplete, 500); } : onStepComplete} {...(onWrongTap != null && { onWrongTap })} showHighlight={showHighlight}>
            <div className={`${HOTSPOT_BTN} justify-between mt-1 ${currentHotspotId === 'fig-swap' ? HOTSPOT_ACTIVE : HOTSPOT_INACTIVE}`}>Swap variant <span className="text-xs">▼</span></div>
          </HotspotButton>
          {currentHotspotId === 'fig-swap' && hasVariants && (
            <div className="p-3 rounded-lg bg-[#454545] border border-white/10 space-y-1">
              <div className="text-xs text-white/70">Instance: Button</div>
              <div className="flex flex-col gap-1 mt-2">
                {['Default', 'Hover', 'Pressed'].map((v) => (
                  <div key={v} className="px-2 py-1.5 rounded bg-white/5 text-white/80 text-xs hover:bg-white/10 cursor-pointer">{v}</div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function ProcreateMock({ currentHotspotId, onStepComplete, onWrongTap, showHighlight, stepIdx = 0, taskId }: MockProps) {
  const [brushColor, setBrushColor] = useState<'blue' | 'yellow'>('blue')
  const [testStrokeShown, setTestStrokeShown] = useState(false)
  const isSky = taskId === 'procreateSky'
  const brushActive = stepIdx >= 1
  const hasNewBrush = stepIdx >= 2
  const inBrushStudio = stepIdx >= 2
  const shapeDone = stepIdx >= 3
  const dynamicsDone = stepIdx >= 4
  const brushSaved = stepIdx >= 5
  const canTestBrush = !isSky && stepIdx >= 5
  const hasColor = isSky && stepIdx >= 5
  const hasLayer = isSky && stepIdx >= 6
  const hasStroke = isSky && stepIdx >= 8
  const hasBlend = isSky && stepIdx >= 9
  const hasOpacity = isSky && stepIdx >= 10
  const canPaint = isSky && hasLayer && stepIdx >= 8
  const procClutter = (label: string) => <div key={label} className={CLUTTER_CLASS}>{label}</div>
  return (
    <div className="absolute inset-0 flex flex-col text-sm">
      <div className="h-12 bg-[#2e2e2e] border-b border-white/15 flex items-center justify-center gap-4 px-4 shrink-0 flex-wrap">
        {isSky && (
          <div className="relative">
            <HotspotButton id="proc-export" currentHotspotId={currentHotspotId} onStepComplete={onStepComplete} {...(onWrongTap != null && { onWrongTap })} showHighlight={showHighlight}>
              <span className={`px-3 py-1.5 rounded ${currentHotspotId === 'proc-export' ? 'ring-2 ring-[#34c759]/50' : ''} text-white/80`}>⚙</span>
            </HotspotButton>
            {(currentHotspotId === 'proc-export' || currentHotspotId === 'proc-export-format') && (
              <div className="absolute top-full left-0 mt-1 p-2 rounded-lg bg-[#454545] border border-white/10 shadow-lg z-20 min-w-[120px]">
                <div className="text-white/50 text-xs mb-1">Share</div>
                <HotspotButton id="proc-export-format" currentHotspotId={currentHotspotId} onStepComplete={onStepComplete} {...(onWrongTap != null && { onWrongTap })} showHighlight={showHighlight}>
                  <div className={`text-[#34c759] text-xs cursor-pointer ${currentHotspotId === 'proc-export-format' ? 'ring-1 ring-[#34c759]/50 rounded px-1' : ''}`}>PNG · PSD · Procreate</div>
                </HotspotButton>
              </div>
            )}
          </div>
        )}
        {['Undo', 'Redo', 'Adjustments', 'Filters', 'Liquify', 'Selection', 'Crop', 'Transform'].map(procClutter)}
        {isSky && (
          <HotspotButton id="proc-color" currentHotspotId={currentHotspotId} onStepComplete={onStepComplete} {...(onWrongTap != null && { onWrongTap })} showHighlight={showHighlight}>
            <div className={`w-10 h-10 rounded-full border-2 ${hasColor ? 'border-[#34c759] bg-[#60a5fa]/80' : 'border-white/40 bg-[#60a5fa]/50'} ${currentHotspotId === 'proc-color' ? 'ring-2 ring-[#34c759]/50' : ''}`} />
          </HotspotButton>
        )}
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
        <div className="bg-[#454545] border-b border-white/10 px-3 py-2 flex gap-4 shrink-0">
          <span className="text-white/60 text-xs">Brush Library:</span>
          <div className="flex gap-1 rounded bg-white/10 p-1">
            <div className="w-10 h-10 rounded-full bg-[#34c759]/40 border border-[#34c759]/60" />
            <div className="w-10 h-10 rounded-full bg-white/20" />
            <div className="w-10 h-10 rounded-full bg-white/20" />
          </div>
        </div>
      )}
      <div className="flex flex-1 min-h-0">
        <div className="w-32 bg-[#383838] border-r border-white/15 p-4 shrink-0 flex flex-col gap-2 overflow-y-auto">
          <div className="flex gap-1 mb-1 pointer-events-none">
            {['Import', 'Organize', 'Search'].map(procClutter)}
          </div>
          <HotspotButton id="proc-new" currentHotspotId={currentHotspotId} onStepComplete={onStepComplete} {...(onWrongTap != null && { onWrongTap })} showHighlight={showHighlight} className="w-full">
            <div className={`w-full ${HOTSPOT_BTN} justify-center ${currentHotspotId === 'proc-new' ? HOTSPOT_ACTIVE : HOTSPOT_INACTIVE}`}>+ New</div>
          </HotspotButton>
          {currentHotspotId === 'proc-new' && (
            <div className="p-3 rounded-lg bg-[#454545] border border-white/10">
              <div className="text-[#34c759] text-xs">✓ Create new brush</div>
            </div>
          )}
          <div className="text-white/50 text-xs pointer-events-none">Brush sets</div>
          {!isSky && hasNewBrush && brushSaved ? (
            <HotspotButton id="proc-name-brush" currentHotspotId={currentHotspotId} onStepComplete={onStepComplete} {...(onWrongTap != null && { onWrongTap })} showHighlight={showHighlight} className="w-full">
              <div className={`w-full h-10 rounded flex items-center justify-center text-xs ${currentHotspotId === 'proc-name-brush' ? HOTSPOT_ACTIVE : ''} bg-white/15 text-[#34c759]/80`}>✓ Custom</div>
            </HotspotButton>
          ) : (
            <div className={`w-full h-10 rounded flex items-center justify-center text-xs ${hasNewBrush ? 'bg-white/15 text-[#34c759]/80' : 'bg-white/10 text-white/40'}`}>{hasNewBrush ? '✓ Custom' : 'Brush 1'}</div>
          )}
          <div className="w-full h-10 bg-white/10 rounded flex items-center justify-center text-xs text-white/40">Brush 2</div>
          {['Inking', 'Sketching', 'Painting', 'Textures', 'Charcoal'].map((s) => <div key={s} className="w-full h-8 bg-white/5 rounded flex items-center px-2 text-white/40 text-xs pointer-events-none">{s}</div>)}
          {isSky && (
            <>
              <div className="text-white/50 mt-2 text-xs">Layers</div>
              <HotspotButton id="proc-layer" currentHotspotId={currentHotspotId} onStepComplete={onStepComplete} {...(onWrongTap != null && { onWrongTap })} showHighlight={showHighlight} className="w-full">
                <div className={`w-full ${HOTSPOT_BTN} justify-center ${currentHotspotId === 'proc-layer' ? HOTSPOT_ACTIVE : HOTSPOT_INACTIVE}`}>+ Layer</div>
              </HotspotButton>
              {hasLayer && <div className="w-full h-12 rounded bg-white/10 flex items-center px-2 gap-1"><div className="w-10 h-10 rounded bg-[#60a5fa]/40 flex items-center justify-center text-[10px] text-white/60">{hasBlend ? 'N' : ''}</div><span className="text-xs text-white/70">Sky{hasBlend ? ' (Overlay)' : ''}{hasOpacity ? ' 80%' : ''}</span></div>}
              {hasLayer && <div className="w-full h-10 rounded bg-white/5 flex items-center px-2 text-xs text-white/40">Background</div>}
            </>
          )}
        </div>
        <div className={`flex-1 p-4 min-w-0 transition-all ${brushActive ? 'bg-[#404040]' : 'bg-[#404040]'}`}>
          <HotspotButton id="proc-canvas" currentHotspotId={currentHotspotId} onStepComplete={canTestBrush ? () => { setTestStrokeShown(true); setTimeout(() => onStepComplete(), 400); } : onStepComplete} {...(onWrongTap != null && { onWrongTap })} showHighlight={showHighlight} className={`w-full h-full ${!isSky && !canTestBrush ? 'pointer-events-none' : ''}`}>
            <div className={`w-full h-full border-2 border-dashed rounded-lg flex flex-col items-center justify-center gap-3 text-base transition-all relative overflow-hidden ${brushActive || canTestBrush ? 'border-white/30' : 'border-white/20'} ${isSky && (hasStroke || hasLayer) ? 'border-none' : ''}`}>
              {isSky && hasLayer && !hasStroke && (
                <div className="absolute inset-0 bg-gradient-to-b from-[#60a5fa]/30 via-[#93c5fd]/20 to-[#fbbf24]/25 pointer-events-none z-0" aria-hidden />
              )}
              <SkyPaintCanvas
                enabled={canPaint}
                brushColor={brushColor}
                hasBlend={hasBlend}
                {...(stepIdx === 8 && { onFirstStroke: onStepComplete })}
                className="z-10"
              />
              {brushActive && !hasStroke && !canPaint && <div className="absolute top-4 right-4 w-10 h-10 rounded-full border-2 border-[#34c759] bg-[#34c759]/30" title="Brush cursor" />}
              {canPaint && <div className="absolute top-4 right-4 w-10 h-10 rounded-full border-2 border-white/60 pointer-events-none z-30" style={{ backgroundColor: brushColor === 'blue' ? BRUSH_BLUE : BRUSH_YELLOW }} title="Brush" />}
              {hasNewBrush && !hasStroke && !canPaint && !brushSaved && <div className="w-12 h-12 rounded-full bg-[#34c759]/40 border-2 border-[#34c759]/60" />}
              {inBrushStudio && !hasStroke && !canPaint && !brushSaved && <span className="text-white/50 text-xs">Brush Studio</span>}
              {brushSaved && !hasStroke && !canPaint && (
                <>
                  <svg className="absolute inset-0 w-full h-full pointer-events-none z-0" viewBox="0 0 200 120">
                    <path d="M 20 60 Q 60 40 100 60 T 180 80" stroke="#34c759" strokeWidth={testStrokeShown ? 6 : 4} fill="none" strokeLinecap="round" strokeLinejoin="round" opacity={testStrokeShown ? 0.9 : 0.6} className="transition-all duration-300" />
                  </svg>
                  <span className="relative text-[#34c759] text-sm font-medium z-10">{testStrokeShown ? '✓ Brush works!' : canTestBrush ? 'Tap to test your brush' : '✓ Custom brush saved'}</span>
                </>
              )}
              {!hasNewBrush && !brushSaved && !hasStroke && !canPaint && <span className="text-white/40">Canvas</span>}
              {canPaint && stepIdx < 9 && <span className="relative text-white/90 text-sm drop-shadow z-30 pointer-events-none">Paint 3+ strokes (blue, then yellow)</span>}
              {isSky && stepIdx >= 9 && <span className="relative text-white/90 text-sm drop-shadow z-30 pointer-events-none">Blended sky</span>}
            </div>
          </HotspotButton>
        </div>
        <div className="w-32 bg-[#383838] border-l border-white/15 p-4 shrink-0 flex flex-col gap-2 overflow-y-auto">
          <div className="text-white/50 text-xs">Brush Studio</div>
          {isSky && hasColor && (
            <div className="flex gap-2 mb-1">
              <button type="button" onClick={() => setBrushColor('blue')} className={`w-10 h-10 rounded-full border-2 flex-shrink-0 ${brushColor === 'blue' ? 'border-[#34c759] ring-2 ring-[#34c759]/50' : 'border-white/30'}`} style={{ backgroundColor: BRUSH_BLUE }} title="Blue brush" />
              <button type="button" onClick={() => setBrushColor('yellow')} className={`w-10 h-10 rounded-full border-2 flex-shrink-0 ${brushColor === 'yellow' ? 'border-[#34c759] ring-2 ring-[#34c759]/50' : 'border-white/30'}`} style={{ backgroundColor: BRUSH_YELLOW }} title="Yellow brush" />
            </div>
          )}
          {['Stamping', 'Smudge', 'Stabilization', 'Wet Mix'].map(procClutter)}
          <HotspotButton id="proc-shape" currentHotspotId={currentHotspotId} onStepComplete={onStepComplete} {...(onWrongTap != null && { onWrongTap })} showHighlight={showHighlight} className="w-full">
            <div className={`w-full ${HOTSPOT_BTN} justify-between ${currentHotspotId === 'proc-shape' ? HOTSPOT_ACTIVE : HOTSPOT_INACTIVE} ${shapeDone ? 'border border-[#34c759]/40' : ''}`}>Shape {shapeDone && '✓'}</div>
          </HotspotButton>
          {currentHotspotId === 'proc-shape' && (
            <div className="p-3 rounded-lg bg-[#454545] border border-white/10 space-y-1">
              <div className="text-white/70 text-xs">Grain</div>
              <div className="h-6 bg-white/10 rounded" />
            </div>
          )}
          <HotspotButton id="proc-dynamics" className="w-full" currentHotspotId={currentHotspotId} onStepComplete={onStepComplete} {...(onWrongTap != null && { onWrongTap })} showHighlight={showHighlight}>
            <div className={`w-full ${HOTSPOT_BTN} justify-between ${currentHotspotId === 'proc-dynamics' ? HOTSPOT_ACTIVE : HOTSPOT_INACTIVE} ${dynamicsDone ? 'border border-[#34c759]/40' : ''}`}>Dynamics {dynamicsDone && '✓'}</div>
          </HotspotButton>
          {currentHotspotId === 'proc-dynamics' && (
            <div className="p-3 rounded-lg bg-[#454545] border border-white/10 space-y-1">
              <div className="flex justify-between text-xs text-white/40"><span>Size</span><span>80%</span></div>
              <div className="h-1 bg-white/20 rounded-full" />
              <div className="flex justify-between text-xs text-white/40"><span>Opacity</span><span>100%</span></div>
              <div className="h-1 bg-white/20 rounded-full" />
            </div>
          )}
          <HotspotButton id="proc-done" currentHotspotId={currentHotspotId} onStepComplete={onStepComplete} {...(onWrongTap != null && { onWrongTap })} showHighlight={showHighlight} className="w-full">
            <div className={`w-full ${HOTSPOT_BTN} justify-center ${currentHotspotId === 'proc-done' ? HOTSPOT_ACTIVE : HOTSPOT_INACTIVE}`}>Done</div>
          </HotspotButton>
          {['Apple Pencil', 'Pressure', 'Tilt', 'Azimuth'].map(procClutter)}
          {isSky && (
            <>
              <div className="text-white/50 mt-2 text-xs">Blend</div>
              <HotspotButton id="proc-blend" currentHotspotId={currentHotspotId} onStepComplete={onStepComplete} {...(onWrongTap != null && { onWrongTap })} showHighlight={showHighlight} className="w-full">
                <div className={`w-full ${HOTSPOT_BTN} justify-between ${currentHotspotId === 'proc-blend' ? HOTSPOT_ACTIVE : HOTSPOT_INACTIVE} ${hasBlend ? 'border border-[#34c759]/40' : ''}`}>Normal {hasBlend && '✓'} ▼</div>
              </HotspotButton>
              {currentHotspotId === 'proc-blend' && (
                <div className="p-3 rounded-lg bg-[#454545] border border-white/10 space-y-1">
                  <div className="text-xs text-white/50">Multiply · Overlay · Screen</div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function NotionMock({ currentHotspotId, onStepComplete, onWrongTap, showHighlight, stepIdx = 0 }: MockProps) {
  const hasPage = stepIdx >= 1
  const hasDb = stepIdx >= 2
  const hasStatus = stepIdx >= 3
  const hasDate = stepIdx >= 4
  const hasProps = hasStatus || hasDate
  const hasLinked = stepIdx >= 6
  const isBoardView = stepIdx >= 7
  const hasFilter = stepIdx >= 8
  const notionClutter = (label: string) => <div key={label} className={CLUTTER_CLASS}>{label}</div>
  const rowCount = 2 + (stepIdx >= 5 ? 1 : 0) + (stepIdx >= 6 ? 1 : 0)
  const ROWS = [
    { name: 'Sprint planning', status: 'Done', date: 'Mar 1' },
    { name: 'User research', status: 'In progress', date: 'Mar 5' },
    { name: 'Design review', status: 'To do', date: 'Mar 8' },
    { name: 'Ship v1', status: 'To do', date: 'Mar 15' },
  ]
  const filteredRows = hasFilter ? ROWS.filter((r) => r.status === 'In progress') : ROWS
  const displayRows = filteredRows.slice(0, rowCount)
  return (
    <div className="absolute inset-0 flex flex-col text-sm">
      <div className="h-12 bg-[#2e2e2e] border-b border-white/15 flex items-center px-3 gap-3 shrink-0 flex-wrap">
        <HotspotButton id="notion-new" currentHotspotId={currentHotspotId} onStepComplete={onStepComplete} {...(onWrongTap != null && { onWrongTap })} showHighlight={showHighlight}>
          <span className={`px-3 py-1.5 rounded transition-colors ${hasPage ? 'bg-[#34c759]/20 text-[#34c759] font-medium' : 'text-white/80'}`}>+ New page</span>
        </HotspotButton>
        {hasPage && <span className="text-white/60 text-sm">My Project</span>}
        {['Templates', 'Import', 'Search', 'Settings', 'Share'].map(notionClutter)}
      </div>
      <div className="flex flex-1 min-h-0">
        <div className="w-36 bg-[#383838] border-r border-white/15 p-4 shrink-0 flex flex-col gap-2 overflow-y-auto">
          <HotspotButton id="notion-new" currentHotspotId={currentHotspotId} onStepComplete={onStepComplete} {...(onWrongTap != null && { onWrongTap })} showHighlight={showHighlight}>
            <div className={`${HOTSPOT_BTN} mb-2 ${currentHotspotId === 'notion-new' ? HOTSPOT_ACTIVE : HOTSPOT_INACTIVE}`}>+ Add</div>
          </HotspotButton>
          {currentHotspotId === 'notion-new' && (
            <div className="mb-3 p-3 rounded-lg bg-[#454545] border border-white/10 space-y-1">
              <div className="text-[#34c759] text-xs font-medium">New page</div>
              <div className="text-white/50 text-xs">Page · Database</div>
            </div>
          )}
          <div className="text-white/50 text-xs pointer-events-none">Workspace</div>
          {['Favorites', 'Private', 'Shared'].map((s) => <div key={s} className="h-8 px-2 rounded bg-white/5 text-white/40 text-xs flex items-center pointer-events-none">{s}</div>)}
          {hasPage && <div className="h-8 px-2 rounded bg-[#34c759]/15 text-[#34c759] text-xs flex items-center font-medium">✓ My Project</div>}
        </div>
        <div className="flex-1 p-6 bg-[#404040] min-w-0 overflow-auto">
          {!hasDb ? (
            <>
              <HotspotButton id="notion-db" currentHotspotId={currentHotspotId} onStepComplete={onStepComplete} {...(onWrongTap != null && { onWrongTap })} showHighlight={showHighlight}>
                <div className={`${HOTSPOT_BTN} mb-4 w-40 ${currentHotspotId === 'notion-db' ? HOTSPOT_ACTIVE : HOTSPOT_INACTIVE}`}>
                  <span className="text-white/40 text-sm">Type /table or /database</span>
                </div>
              </HotspotButton>
              {currentHotspotId === 'notion-db' && (
                <div className="mb-4 p-3 rounded-lg bg-[#454545] border border-white/10 space-y-1">
                  <div className="text-white/70 text-xs">Table – Inline</div>
                  <div className="text-white/50 text-xs">Linked database</div>
                </div>
              )}
              <div className="flex flex-wrap gap-2 pointer-events-none">
                {['/heading', '/todo', '/bulleted', '/numbered', '/toggle', '/quote', '/callout', '/code'].map(notionClutter)}
              </div>
            </>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <span className="text-white/80 font-medium">Tasks</span>
                {hasLinked && <span className="px-2 py-0.5 rounded bg-[#34c759]/20 text-[#34c759] text-xs">Board view</span>}
                {hasFilter && <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-400 text-xs">Filtered</span>}
              </div>
              {isBoardView ? (
                <div className="grid grid-cols-3 gap-3">
                  {['To do', 'In progress', 'Done'].map((col) => (
                    <div key={col} className="rounded-lg bg-white/5 border border-white/10 p-3 min-h-[120px]">
                      <div className="text-white/60 text-xs font-medium mb-2">{col}</div>
                      {displayRows.filter((r) => r.status === col).map((r) => (
                        <div key={r.name} className="mb-2 p-2 rounded bg-white/10 text-white/90 text-sm">{r.name}</div>
                      ))}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-lg border border-white/15 overflow-hidden">
                  <div className="flex bg-white/10 border-b border-white/10">
                    <div className="flex-1 px-3 py-2 text-white/60 text-xs font-medium">Name</div>
                    {hasStatus && <div className="w-24 px-3 py-2 text-white/60 text-xs font-medium border-l border-white/10">Status</div>}
                    {hasDate && <div className="w-20 px-3 py-2 text-white/60 text-xs font-medium border-l border-white/10">Date</div>}
                  </div>
                  {displayRows.map((r) => (
                    <div key={r.name} className="flex border-b border-white/5 last:border-0">
                      <div className="flex-1 px-3 py-2 text-white/90 text-sm">{r.name}</div>
                      {hasStatus && <div className="w-24 px-3 py-2 text-white/70 text-xs border-l border-white/10">{r.status}</div>}
                      {hasDate && <div className="w-20 px-3 py-2 text-white/50 text-xs border-l border-white/10">{r.date}</div>}
                    </div>
                  ))}
                  {hasDb && hasProps && stepIdx >= 4 && stepIdx < 6 && (
                    <HotspotButton id="notion-add-row" currentHotspotId={currentHotspotId} onStepComplete={onStepComplete} {...(onWrongTap != null && { onWrongTap })} showHighlight={showHighlight}>
                      <div className={`flex items-center gap-2 px-3 py-2 border-t border-white/10 ${currentHotspotId === 'notion-add-row' ? HOTSPOT_ACTIVE : HOTSPOT_INACTIVE}`}>+ New</div>
                    </HotspotButton>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
        <div className="w-48 bg-[#383838] border-l border-white/15 p-4 shrink-0 flex flex-col gap-3 overflow-y-auto">
          <div className="text-white/50 text-xs pointer-events-none">Database</div>
          {['Sort', 'Group', 'Search'].map(notionClutter)}
          <div>
            <div className="text-white/50 mb-2 text-xs">Properties</div>
            <HotspotButton id="notion-props" currentHotspotId={currentHotspotId} onStepComplete={onStepComplete} {...(onWrongTap != null && { onWrongTap })} showHighlight={showHighlight}>
              <div className={`${HOTSPOT_BTN} justify-between ${currentHotspotId === 'notion-props' ? HOTSPOT_ACTIVE : HOTSPOT_INACTIVE} ${hasProps ? 'border border-[#34c759]/40' : ''}`}>+ Add {hasProps && '✓'}</div>
            </HotspotButton>
            {currentHotspotId === 'notion-props' && (
              <div className="mt-2 p-3 rounded-lg bg-[#454545] border border-white/10 space-y-1">
                <div className="text-white/70 text-xs">Status · Date · Person</div>
              </div>
            )}
            {hasProps && (
              <div className="mt-2 space-y-1">
                {['Name', 'Status', 'Date'].map((p) => <div key={p} className="h-7 px-2 rounded bg-white/5 text-white/60 text-xs flex items-center">{p}</div>)}
              </div>
            )}
          </div>
          <div className="flex flex-col gap-2">
            <div className="text-white/50 text-xs">View</div>
            <HotspotButton id="notion-linked" currentHotspotId={currentHotspotId} onStepComplete={onStepComplete} {...(onWrongTap != null && { onWrongTap })} showHighlight={showHighlight}>
              <div className={`${HOTSPOT_BTN} justify-between ${currentHotspotId === 'notion-linked' ? HOTSPOT_ACTIVE : HOTSPOT_INACTIVE} ${hasLinked ? 'border border-[#34c759]/40' : ''}`}>Linked {hasLinked && '✓'}</div>
            </HotspotButton>
            {currentHotspotId === 'notion-linked' && (
              <div className="p-3 rounded-lg bg-[#454545] border border-white/10 space-y-1">
                <div className="text-white/70 text-xs">Board · Calendar · Table</div>
              </div>
            )}
            <HotspotButton id="notion-filter" currentHotspotId={currentHotspotId} onStepComplete={onStepComplete} {...(onWrongTap != null && { onWrongTap })} showHighlight={showHighlight}>
              <div className={`${HOTSPOT_BTN} justify-between ${currentHotspotId === 'notion-filter' ? HOTSPOT_ACTIVE : HOTSPOT_INACTIVE} ${hasFilter ? 'border border-[#34c759]/40' : ''}`}>Filter {hasFilter && '✓'}</div>
            </HotspotButton>
            {currentHotspotId === 'notion-filter' && (
              <div className="p-3 rounded-lg bg-[#454545] border border-white/10 space-y-1">
                <div className="text-white/70 text-xs">Status = In progress</div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

const MOCK_COMPONENTS: Record<string, (props: MockProps) => React.ReactNode> = {
  figma: FigmaMock,
  procreate: ProcreateMock,
  notion: NotionMock,
}

export default function PearNavigator() {
  const [phase, setPhase] = useState<'task' | 'steps' | 'done'>('task')
  const [taskId, setTaskId] = useState<string | null>(null)
  const [stepIdx, setStepIdx] = useState(0)
  const [showHighlight, setShowHighlight] = useState(false)
  const [wrongTapToast, setWrongTapToast] = useState(false)

  const task = taskId ? TASKS[taskId] : null
  const step = task ? task.steps[stepIdx] : null
  const isLastStep = task && stepIdx === task.steps.length - 1
  const isFirstStep = stepIdx === 0

  useEffect(() => {
    if (!wrongTapToast) return
    const t = setTimeout(() => setWrongTapToast(false), 2000)
    return () => clearTimeout(t)
  }, [wrongTapToast])

  const handleStart = useCallback(() => {
    if (!taskId) return
    setPhase('steps')
    setStepIdx(0)
    setShowHighlight(true)
  }, [taskId])

  const handleNext = useCallback(() => {
    if (!task) return
    if (isLastStep) {
      setPhase('done')
      setShowHighlight(false)
    } else {
      setStepIdx((i) => i + 1)
      setShowHighlight(true)
    }
  }, [task, isLastStep])

  const handlePrev = useCallback(() => {
    if (stepIdx > 0) setStepIdx((i) => i - 1)
  }, [stepIdx])

  const handleWrongTap = useCallback(() => setWrongTapToast(true), [])

  const handleReset = useCallback(() => {
    setPhase('task')
    setTaskId(null)
    setStepIdx(0)
    setShowHighlight(false)
  }, [])

  const MockComponent = task ? MOCK_COMPONENTS[task.mock] : null

  return (
    <div className="h-screen w-screen overflow-hidden bg-gradient-to-br from-[#0d0d0d] via-[#1a1a1a] to-[#0d0d0d] flex flex-col">
      <div className="flex-none flex items-center justify-between px-6 py-5">
          <Link href="/" className="text-white hover:text-gray-300 text-3xl font-bold">
            ← Home
          </Link>
          <span className="text-xl font-semibold text-white">
            Pear<span className="text-[#34c759]">Navigator</span>
          </span>
          <span className="text-sm text-gray-500">PearPad</span>
      </div>

      <div className="flex-1 flex flex-col lg:flex-row gap-4 px-4 pb-4 min-h-0 overflow-hidden">
        {/* Guide panel */}
        <div className="flex-none lg:w-80 xl:w-96 min-w-0 flex flex-col min-h-0 bg-white/5 backdrop-blur-sm rounded-xl border border-white/10 shrink-0 self-stretch">
            <div className="flex flex-col flex-1 min-h-0 p-8">
              {phase === 'task' && (
                <>
                  <p className="text-sm font-semibold text-[#34c759] uppercase tracking-wider mb-3 shrink-0">
                    What do you want to do?
                  </p>
                  <h2 className="text-2xl font-semibold text-white mb-3 shrink-0">Tell Pear Navigator your goal</h2>
                  <p className="text-gray-400 text-base mb-5 shrink-0">
                    Step-by-step guidance with highlights—tap the simulator to advance.
                  </p>
                  <div className="flex-1 min-h-0 overflow-y-auto space-y-3 mb-8">
                    {Object.entries(TASKS).map(([id, t]) => (
                      <button
                        key={id}
                        onClick={() => setTaskId(id)}
                        className={`w-full text-left px-5 py-4 rounded-xl border transition-all text-base flex items-center justify-between gap-3 ${
                          taskId === id
                            ? 'border-[#34c759] bg-[#34c759]/15 text-white'
                            : 'border-white/10 bg-white/5 text-gray-300 hover:border-[#34c759]/50'
                        }`}
                      >
                        <span>{t.app}: {TASK_LABELS[id]}</span>
                        <span className="text-xs text-white/50 shrink-0">{t.steps.length} steps</span>
                      </button>
                    ))}
                  </div>
                  <button
                    onClick={handleStart}
                    disabled={!taskId}
                    className="w-full py-5 rounded-xl bg-[#34c759] text-black font-semibold text-lg disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90 transition-opacity"
                  >
                    Start guide
                  </button>
                </>
              )}

              {phase === 'steps' && task && step && (
                <>
                  <p className="text-sm font-semibold text-[#34c759] uppercase tracking-wider mb-3">
                    Step {stepIdx + 1} of {task.steps.length}
                  </p>
                  <h2 className="text-2xl font-semibold text-white mb-3">{step.title}</h2>
                  <p className="text-gray-400 text-base mb-5">{step.desc}</p>
                  {step.hint && (
                    <div className="mb-5 p-4 rounded-lg bg-[#34c759]/15 border border-[#34c759]/30 text-[#34c759] text-base">
                      {step.hint}
                    </div>
                  )}
                  <p className="mb-4 text-base text-[#34c759]/90 font-medium">
                    Tap the highlighted element in the simulator to continue
                  </p>
                  <div className="flex gap-3">
                    <button
                      onClick={() => setShowHighlight((h) => !h)}
                      className="flex-1 py-4 rounded-xl border border-white/20 bg-white/5 text-white font-medium text-base hover:bg-white/10 transition-colors"
                    >
                      {showHighlight ? 'Hide highlight' : 'Show highlight'}
                    </button>
                    {!isFirstStep && (
                      <button
                        onClick={handlePrev}
                        className="py-4 px-6 rounded-xl border border-white/20 bg-white/5 text-white font-medium text-base hover:bg-white/10 transition-colors"
                        aria-label="Previous step"
                      >
                        ← Previous
                      </button>
                    )}
                  </div>
                  <div className="mt-3 flex items-center justify-between">
                    <button
                      onClick={handleNext}
                      className="text-sm text-white/50 hover:text-white/70 underline underline-offset-2"
                    >
                      {isLastStep ? 'Skip to done' : 'Skip step'}
                    </button>
                  </div>
                </>
              )}

              {phase === 'done' && (
                <div className="text-center py-10">
                  <div className="text-6xl text-[#34c759] mb-6 pear-success">✓</div>
                  <h2 className="text-3xl font-bold text-white mb-4">Task complete</h2>
                  <p className="text-gray-400 text-lg mb-8">
                    You&apos;ve finished the guide. Try another task or refine your result.
                  </p>
                  <button
                    onClick={handleReset}
                    className="px-10 py-4 rounded-xl bg-[#34c759] text-black font-semibold text-lg hover:opacity-90 transition-opacity"
                  >
                    Start over
                  </button>
                </div>
              )}
            </div>
        </div>

        {/* Wrong-tap toast */}
        {wrongTapToast && (
          <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 px-6 py-3 rounded-xl bg-red-500/90 text-white font-medium text-sm shadow-lg transition-opacity duration-300">
            Tap the highlighted element to advance
          </div>
        )}

        {/* Mock app preview - fills remaining space */}
        <div className="flex-1 min-w-0 min-h-0 flex flex-col overflow-hidden">
          <div className="flex-1 min-h-0 flex items-center justify-center p-4 md:p-6">
            <div className="relative w-full h-full max-w-4xl rounded-[2rem] bg-[#1a1a1a] border-[10px] border-[#2a2a2a] shadow-[inset_0_0_30px_rgba(0,0,0,0.5),0_20px_50px_rgba(0,0,0,0.4)] overflow-hidden">
              <div className="absolute inset-4 md:inset-6 rounded-[1.25rem] bg-[#3a3a3a] overflow-hidden">
                {MockComponent && <MockComponent {...(phase === 'steps' && step?.hotspotId ? { currentHotspotId: step.hotspotId } : {})} onStepComplete={handleNext} {...(phase === 'steps' && { onWrongTap: handleWrongTap })} showHighlight={phase === 'steps' && showHighlight} stepIdx={phase === 'steps' ? stepIdx : (task?.steps.length ?? 0)} {...(taskId ? { taskId } : {})} />}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
