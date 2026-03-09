'use client'

import Link from 'next/link'
import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react'

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
  const hasStrokedRef = useRef(false)
  const strokeColorRef = useRef<'blue' | 'yellow'>('blue')

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
      if (isDrawingRef.current && !hasStrokedRef.current) {
        hasStrokedRef.current = true
        onFirstStroke?.()
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
      {
        title: 'Open Brush Library',
        desc: 'Tap the brush icon (Paint/Smudge/Erase) in the top toolbar to open the Brush Library.',
        hint: 'Swipe left on a brush to duplicate',
        highlight: { x: 280, y: 14, w: 80, h: 36 },
        hotspotId: 'proc-brush',
      },
      {
        title: 'Create new brush',
        desc: 'Tap the + icon in the top right of the Brush Library. Select "Create new brush" to enter Brush Studio.',
        hint: 'Duplicate an existing brush first for a baseline',
        highlight: { x: 24, y: 70, w: 60, h: 36 },
        hotspotId: 'proc-new',
      },
      {
        title: 'Adjust shape and grain',
        desc: 'In Brush Studio, tap Shape and Grain in the left Attributes menu to customize the brush tip.',
        hint: 'Import custom grain images for texture',
        highlight: { x: 520, y: 100, w: 80, h: 32 },
        hotspotId: 'proc-shape',
      },
      {
        title: 'Set dynamics',
        desc: 'Tap Dynamics in the Attributes menu. Adjust Size, Opacity, Flow for Apple Pencil pressure/speed response.',
        hint: '14 attributes total; Dynamics controls stroke behavior',
        highlight: { x: 520, y: 160, w: 80, h: 32 },
        hotspotId: 'proc-dynamics',
      },
      {
        title: 'Save and name',
        desc: 'Tap Done to exit Brush Studio. Name your brush in the Brush Library.',
        hint: 'Organize brushes into sets',
        highlight: { x: 300, y: 320, w: 100, h: 36 },
        hotspotId: 'proc-done',
      },
    ],
  },
  procreateSky: {
    app: 'Procreate (PearPad)',
    mock: 'procreate',
    steps: [
      { title: 'Open Brush Library', desc: 'Tap the brush icon to open the Brush Library.', hint: 'Brush Library shows your brush sets', highlight: { x: 280, y: 14, w: 80, h: 36 }, hotspotId: 'proc-brush' },
      { title: 'Create new brush', desc: 'Tap + in the Brush Library to create a new brush.', highlight: { x: 24, y: 70, w: 60, h: 36 }, hotspotId: 'proc-new' },
      { title: 'Adjust shape and grain', desc: 'In Brush Studio, tap Shape and Grain to customize the brush tip for texture.', highlight: { x: 520, y: 100, w: 80, h: 32 }, hotspotId: 'proc-shape' },
      { title: 'Set dynamics', desc: 'Tap Dynamics. Adjust Size, Opacity, Flow for pressure response.', highlight: { x: 520, y: 160, w: 80, h: 32 }, hotspotId: 'proc-dynamics' },
      { title: 'Save brush', desc: 'Tap Done to exit Brush Studio and save your brush.', highlight: { x: 300, y: 320, w: 100, h: 36 }, hotspotId: 'proc-done' },
      { title: 'Pick sky color', desc: 'Tap the color disc to open the color picker. Choose a soft blue or orange for the sky.', highlight: { x: 260, y: 14, w: 48, h: 36 }, hotspotId: 'proc-color' },
      { title: 'Add new layer', desc: 'Tap + in the Layers panel to add a new layer for the sky.', highlight: { x: 24, y: 120, w: 60, h: 36 }, hotspotId: 'proc-layer' },
      { title: 'Paint the sky', desc: 'Tap the canvas to paint. Your textured brush creates a gradient sky.', highlight: { x: 120, y: 80, w: 280, h: 200 }, hotspotId: 'proc-canvas' },
      { title: 'Set blend mode', desc: 'Select the layer and tap N to open blend modes. Try Multiply or Overlay for depth.', highlight: { x: 520, y: 60, w: 80, h: 28 }, hotspotId: 'proc-blend' },
      { title: 'Export artwork', desc: 'Tap the wrench, then Share to export your textured sky.', highlight: { x: 24, y: 14, w: 48, h: 36 }, hotspotId: 'proc-export' },
    ],
  },
  notionDb: {
    app: 'Notion (PearPad)',
    mock: 'notion',
    steps: [
      {
        title: 'Create new page',
        desc: 'Tap + in the sidebar or use the + New page button to create a new page.',
        hint: 'Use templates for quick start',
        highlight: { x: 24, y: 60, w: 90, h: 36 },
        hotspotId: 'notion-new',
      },
      {
        title: 'Add database block',
        desc: 'Type /table or /database and select Table – Inline. Or type /linked database to link an existing one.',
        hint: 'Database can be full-page or inline',
        highlight: { x: 180, y: 120, w: 120, h: 32 },
        hotspotId: 'notion-db',
      },
      {
        title: 'Add properties',
        desc: 'In the database header or right panel, tap + Add to add columns: Status, Date, Person, etc.',
        hint: 'Status is useful for PM workflows',
        highlight: { x: 480, y: 80, w: 100, h: 28 },
        hotspotId: 'notion-props',
      },
      {
        title: 'Create linked view',
        desc: 'Open the view switcher (⋯) or "+ Add a View". Choose New linked view or New empty view. Pick board or calendar.',
        hint: 'Same data, different views',
        highlight: { x: 520, y: 140, w: 80, h: 32 },
        hotspotId: 'notion-linked',
      },
      {
        title: 'Add filters',
        desc: 'Tap Filter in the view toolbar. Add conditions (e.g. Status = In progress).',
        hint: 'Filters apply to current view only',
        highlight: { x: 520, y: 200, w: 70, h: 28 },
        hotspotId: 'notion-filter',
      },
    ],
  },
  figmaVariants: {
    app: 'Figma (PearPad)',
    mock: 'figma',
    steps: [
      {
        title: 'Select layers',
        desc: 'Select the frame or group you want to turn into a component on the canvas.',
        hint: 'Components are reusable; main components show a purple bounding box',
        highlight: { x: 180, y: 100, w: 180, h: 80 },
        hotspotId: 'fig-canvas',
      },
      {
        title: 'Create component',
        desc: 'In the right sidebar, click "Create component" (or Cmd+Alt+K). The selection becomes a main component.',
        hint: 'Component icon appears in the Layers panel',
        highlight: { x: 520, y: 60, w: 100, h: 36 },
        hotspotId: 'fig-component-tab',
      },
      {
        title: 'Add property',
        desc: 'Under Component in the right panel, tap + to add a property. Name it (e.g. State) and set type to Variant.',
        hint: 'Variant = one property with multiple values',
        highlight: { x: 520, y: 100, w: 80, h: 32 },
        hotspotId: 'fig-component-add',
      },
      {
        title: 'Create variants',
        desc: 'Add values (Default, Hover, Pressed). Figma creates a variant set. Click Add variant.',
        hint: 'Each value = one variant in the set',
        highlight: { x: 500, y: 160, w: 100, h: 40 },
        hotspotId: 'fig-variants',
      },
      {
        title: 'Swap instances',
        desc: 'Select an instance. In the right panel, use the property dropdown to swap variants.',
        hint: 'Instances inherit component changes',
        highlight: { x: 510, y: 240, w: 90, h: 36 },
        hotspotId: 'fig-swap',
      },
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
      { title: 'Add instance', desc: 'Tap + Instance to add another idea (Idea A).', highlight: { x: 520, y: 100, w: 90, h: 45 }, hotspotId: 'fig-instance2' },
      { title: 'Add instance', desc: 'Tap + Instance for Idea B.', highlight: { x: 520, y: 100, w: 90, h: 45 }, hotspotId: 'fig-instance2' },
      { title: 'Add instance', desc: 'Tap + Instance for Idea C.', highlight: { x: 520, y: 100, w: 90, h: 45 }, hotspotId: 'fig-instance2' },
      { title: 'Add instance', desc: 'Tap + Instance for Idea D.', highlight: { x: 520, y: 100, w: 90, h: 45 }, hotspotId: 'fig-instance2' },
      { title: 'Add instance', desc: 'Tap + Instance for Idea E.', highlight: { x: 520, y: 100, w: 90, h: 45 }, hotspotId: 'fig-instance2' },
      { title: 'Add instance', desc: 'Tap + Instance for Idea F.', highlight: { x: 520, y: 100, w: 90, h: 45 }, hotspotId: 'fig-instance2' },
      { title: 'Add instance', desc: 'Tap + Instance for Idea G.', highlight: { x: 520, y: 100, w: 90, h: 45 }, hotspotId: 'fig-instance2' },
      { title: 'Add instance', desc: 'Tap + Instance for Idea H.', highlight: { x: 520, y: 100, w: 90, h: 45 }, hotspotId: 'fig-instance2' },
      { title: 'Add instance', desc: 'Tap + Instance for Idea I.', highlight: { x: 520, y: 100, w: 90, h: 45 }, hotspotId: 'fig-instance2' },
      { title: 'Add connectors', desc: 'Tap Connector to draw lines linking the central node to each branch.', hint: 'Connectors show relationships between ideas', highlight: { x: 520, y: 140, w: 80, h: 32 }, hotspotId: 'fig-connector' },
      { title: 'Auto layout', desc: 'Tap Auto layout for consistent spacing between nodes.', hint: 'Keeps the mindmap tidy and readable', highlight: { x: 520, y: 180, w: 90, h: 32 }, hotspotId: 'fig-autolayout' },
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
  const isMindmap = taskId === 'figmaMindmap'
  const hasSelection = stepIdx >= 1
  const isComponent = stepIdx >= 2
  const hasVariants = stepIdx >= 4
  const hasCentralFrame = isMindmap && stepIdx >= 1
  const hasText = isMindmap && stepIdx >= 2
  const hasComponent = isMindmap && stepIdx >= 3
  const instanceCount = isMindmap && stepIdx >= 4 ? Math.min(stepIdx - 3, 9) : 0
  const hasConnectors = isMindmap && stepIdx >= 14
  const hasAutoLayout = isMindmap && stepIdx >= 15
  const hasStyle = isMindmap && stepIdx >= 16
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
          <div className="w-36 bg-[#323232] border-r border-white/10 p-3 shrink-0 flex flex-col gap-2 overflow-y-auto pointer-events-none">
            <div className="text-white/50 text-xs font-medium">Layers</div>
            {['Page 1', 'Frame', 'Group', 'Rectangle', 'Text'].map((l) => <div key={l} className="h-7 px-2 rounded bg-white/5 text-white/45 text-xs flex items-center pointer-events-none">{l}</div>)}
            <div className="text-white/50 text-xs font-medium mt-2">Pages</div>
            {['Cover', 'Flow', 'Components'].map((p) => <div key={p} className="h-6 px-2 rounded bg-white/5 text-white/40 text-xs flex items-center">{p}</div>)}
            <div className="text-white/50 text-xs font-medium mt-2">Assets</div>
            <div className="h-6 px-2 rounded bg-white/5 text-white/40 text-xs flex items-center">Search...</div>
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
          <div className="flex-1 p-6 bg-[#404040] min-w-0 min-h-0">
            <div className={`w-full h-full border-2 border-dashed rounded-lg flex flex-col items-center justify-center gap-3 text-base transition-colors ${hasSelection ? 'border-[#8b5cf6]/60 bg-[#8b5cf6]/5' : ''} ${currentHotspotId === 'fig-canvas' ? 'border-[#34c759]/60 text-[#34c759]' : 'border-white/25 text-white/40'}`}>
              {hasSelection && <div className="w-24 h-16 rounded bg-white/20" />}
              <span>{isComponent ? 'Component' : 'Canvas'}</span>
              {hasVariants && <span className="text-xs text-[#34c759]/80">Default · Hover · Pressed</span>}
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
          <HotspotButton id="fig-swap" currentHotspotId={currentHotspotId} onStepComplete={onStepComplete} {...(onWrongTap != null && { onWrongTap })} showHighlight={showHighlight}>
            <div className={`${HOTSPOT_BTN} justify-between mt-1 ${currentHotspotId === 'fig-swap' ? HOTSPOT_ACTIVE : HOTSPOT_INACTIVE}`}>Swap <span className="text-xs">▼</span></div>
          </HotspotButton>
          {['Resize', 'Opacity', 'Blend', 'Inspect'].map(clutter)}
          {currentHotspotId === 'fig-swap' && (
            <div className="p-3 rounded-lg bg-[#454545] border border-white/10">
              <div className="text-xs text-white/70">State: Default ▼</div>
              <div className="mt-1 text-xs text-white/50">Hover · Pressed</div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function ProcreateMock({ currentHotspotId, onStepComplete, onWrongTap, showHighlight, stepIdx = 0, taskId }: MockProps) {
  const [brushColor, setBrushColor] = useState<'blue' | 'yellow'>('blue')
  const isSky = taskId === 'procreateSky'
  const brushActive = stepIdx >= 1
  const hasNewBrush = stepIdx >= 2
  const inBrushStudio = stepIdx >= 2
  const shapeDone = stepIdx >= 3
  const dynamicsDone = stepIdx >= 4
  const brushSaved = stepIdx >= 5
  const hasColor = isSky && stepIdx >= 6
  const hasLayer = isSky && stepIdx >= 7
  const hasStroke = isSky && stepIdx >= 8
  const hasBlend = isSky && stepIdx >= 9
  const canPaint = isSky && hasLayer && stepIdx >= 8
  const procClutter = (label: string) => <div key={label} className={CLUTTER_CLASS}>{label}</div>
  return (
    <div className="absolute inset-0 flex flex-col text-sm">
      <div className="h-12 bg-[#2e2e2e] border-b border-white/15 flex items-center justify-center gap-4 px-4 shrink-0 flex-wrap">
        {isSky && (
          <HotspotButton id="proc-export" currentHotspotId={currentHotspotId} onStepComplete={onStepComplete} {...(onWrongTap != null && { onWrongTap })} showHighlight={showHighlight}>
            <span className={`px-3 py-1.5 rounded ${currentHotspotId === 'proc-export' ? 'ring-2 ring-[#34c759]/50' : ''} text-white/80`}>⚙</span>
          </HotspotButton>
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
          <div className={`w-full h-10 rounded flex items-center justify-center text-xs ${hasNewBrush ? 'bg-white/15 text-[#34c759]/80' : 'bg-white/10 text-white/40'}`}>{hasNewBrush ? '✓ Custom' : 'Brush 1'}</div>
          <div className="w-full h-10 bg-white/10 rounded flex items-center justify-center text-xs text-white/40">Brush 2</div>
          {['Inking', 'Sketching', 'Painting', 'Textures', 'Charcoal'].map((s) => <div key={s} className="w-full h-8 bg-white/5 rounded flex items-center px-2 text-white/40 text-xs pointer-events-none">{s}</div>)}
          {isSky && (
            <>
              <div className="text-white/50 mt-2 text-xs">Layers</div>
              <HotspotButton id="proc-layer" currentHotspotId={currentHotspotId} onStepComplete={onStepComplete} {...(onWrongTap != null && { onWrongTap })} showHighlight={showHighlight} className="w-full">
                <div className={`w-full ${HOTSPOT_BTN} justify-center ${currentHotspotId === 'proc-layer' ? HOTSPOT_ACTIVE : HOTSPOT_INACTIVE}`}>+ Layer</div>
              </HotspotButton>
              {hasLayer && <div className="w-full h-12 rounded bg-white/10 flex items-center px-2 gap-1"><div className="w-10 h-10 rounded bg-[#60a5fa]/40" /><span className="text-xs text-white/70">Sky</span></div>}
              {hasLayer && <div className="w-full h-10 rounded bg-white/5 flex items-center px-2 text-xs text-white/40">Background</div>}
            </>
          )}
        </div>
        <div className={`flex-1 p-4 min-w-0 transition-all ${brushActive ? 'bg-[#404040]' : 'bg-[#404040]'}`}>
          <HotspotButton id="proc-canvas" currentHotspotId={currentHotspotId} onStepComplete={onStepComplete} {...(onWrongTap != null && { onWrongTap })} showHighlight={showHighlight} className={`w-full h-full ${!isSky ? 'pointer-events-none' : ''}`}>
            <div className={`w-full h-full border-2 border-dashed rounded-lg flex flex-col items-center justify-center gap-3 text-base transition-all relative overflow-hidden ${brushActive ? 'border-white/30' : 'border-white/20'} ${isSky && (hasStroke || hasLayer) ? 'border-none' : ''}`}>
              <SkyPaintCanvas
                enabled={canPaint}
                brushColor={brushColor}
                hasBlend={hasBlend}
                {...(stepIdx === 8 && { onFirstStroke: onStepComplete })}
                className="z-10"
              />
              {brushActive && !hasStroke && !canPaint && <div className="absolute top-4 right-4 w-10 h-10 rounded-full border-2 border-[#34c759] bg-[#34c759]/30" title="Brush cursor" />}
              {canPaint && <div className="absolute top-4 right-4 w-10 h-10 rounded-full border-2 border-white/60 pointer-events-none z-30" style={{ backgroundColor: brushColor === 'blue' ? BRUSH_BLUE : BRUSH_YELLOW }} title="Brush" />}
              {hasNewBrush && !hasStroke && !canPaint && <div className="w-12 h-12 rounded-full bg-[#34c759]/40 border-2 border-[#34c759]/60" />}
              {inBrushStudio && !hasStroke && !canPaint && <span className="text-white/50 text-xs">Brush Studio</span>}
              {brushSaved && !hasStroke && !canPaint && <span className="text-[#34c759] text-sm">✓ Saved</span>}
              {!hasNewBrush && !brushSaved && !hasStroke && !canPaint && <span className="text-white/40">Canvas</span>}
              {canPaint && stepIdx < 9 && <span className="relative text-white/90 text-sm drop-shadow z-30 pointer-events-none">Paint blue, then yellow</span>}
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
  const hasProps = stepIdx >= 3
  const hasLinked = stepIdx >= 4
  const hasFilter = stepIdx >= 5
  const notionClutter = (label: string) => <div key={label} className={CLUTTER_CLASS}>{label}</div>
  return (
    <div className="absolute inset-0 flex flex-col text-sm">
      <div className="h-12 bg-[#2e2e2e] border-b border-white/15 flex items-center px-3 gap-3 shrink-0 flex-wrap">
        <HotspotButton id="notion-new" currentHotspotId={currentHotspotId} onStepComplete={onStepComplete} {...(onWrongTap != null && { onWrongTap })} showHighlight={showHighlight}>
          <span className={hasPage ? 'text-[#34c759] font-medium' : 'text-white/80'}>+ New page</span>
        </HotspotButton>
        {['Templates', 'Import', 'Search', 'Settings', 'Share', 'Updates', 'Favorites'].map(notionClutter)}
      </div>
      <div className="flex flex-1 min-h-0">
        <div className="w-32 bg-[#383838] border-r border-white/15 p-4 shrink-0 flex flex-col gap-2 overflow-y-auto">
          <HotspotButton id="notion-new" currentHotspotId={currentHotspotId} onStepComplete={onStepComplete} {...(onWrongTap != null && { onWrongTap })} showHighlight={showHighlight}>
            <div className={`${HOTSPOT_BTN} mb-2 ${currentHotspotId === 'notion-new' ? HOTSPOT_ACTIVE : HOTSPOT_INACTIVE}`}>+ Add</div>
          </HotspotButton>
          {currentHotspotId === 'notion-new' && (
            <div className="mb-3 p-3 rounded-lg bg-[#454545] border border-white/10 space-y-1">
              <div className="text-[#34c759] text-xs">New page</div>
              <div className="text-white/50 text-xs">Page · Database</div>
            </div>
          )}
          <div className="text-white/50 text-xs pointer-events-none">Workspace</div>
          {['Favorites', 'Private', 'Shared', 'Trash', 'Settings', 'Upgrade'].map((s) => <div key={s} className="h-8 px-2 rounded bg-white/5 text-white/40 text-xs flex items-center pointer-events-none">{s}</div>)}
          <div className="h-8 bg-white/10 rounded" />
          <div className="h-8 bg-white/10 rounded" />
        </div>
        <div className="flex-1 p-6 bg-[#404040] min-w-0">
          <HotspotButton id="notion-db" currentHotspotId={currentHotspotId} onStepComplete={onStepComplete} {...(onWrongTap != null && { onWrongTap })} showHighlight={showHighlight}>
            <div className={`${HOTSPOT_BTN} mb-2 w-36 ${currentHotspotId === 'notion-db' ? HOTSPOT_ACTIVE : HOTSPOT_INACTIVE}`}>
              {hasDb ? <span className="text-[#34c759] text-xs">✓ Table</span> : <span className="text-white/40 text-xs">/table</span>}
            </div>
          </HotspotButton>
          {currentHotspotId === 'notion-db' && (
            <div className="mb-3 p-3 rounded-lg bg-[#454545] border border-white/10 space-y-1">
              <div className="text-white/70 text-xs">Table – Inline</div>
              <div className="text-white/50 text-xs">Linked database</div>
            </div>
          )}
          {hasDb && <div className="h-20 bg-white/10 rounded mb-2 flex gap-3 p-3"><div className="flex-1 h-4 bg-white/20 rounded" /><div className="flex-1 h-4 bg-white/20 rounded" /></div>}
          <div className="text-white/50 text-xs">/table or /database</div>
          <div className="mt-4 flex flex-wrap gap-2 pointer-events-none">
            {['/heading', '/todo', '/bulleted', '/numbered', '/toggle', '/quote', '/callout', '/code', '/divider'].map(notionClutter)}
          </div>
        </div>
        <div className="w-44 bg-[#383838] border-l border-white/15 p-4 shrink-0 flex flex-col gap-3 overflow-y-auto">
          <div className="text-white/50 text-xs pointer-events-none">Database</div>
          {['Sort', 'Group', 'Search DB', 'Lock', 'Duplicate'].map(notionClutter)}
          <div>
            <div className="text-white/50 mb-2">Properties</div>
            <HotspotButton id="notion-props" currentHotspotId={currentHotspotId} onStepComplete={onStepComplete} {...(onWrongTap != null && { onWrongTap })} showHighlight={showHighlight}>
              <div className={`${HOTSPOT_BTN} justify-between ${currentHotspotId === 'notion-props' ? HOTSPOT_ACTIVE : HOTSPOT_INACTIVE} ${hasProps ? 'border border-[#34c759]/40' : ''}`}>+ Add {hasProps && '✓'}</div>
            </HotspotButton>
            {currentHotspotId === 'notion-props' && (
              <div className="mt-2 p-3 rounded-lg bg-[#454545] border border-white/10 space-y-1">
                <div className="text-white/70 text-xs">Property type:</div>
                <div className="flex flex-wrap gap-1"><span className="px-2.5 py-1 rounded bg-[#34c759]/20 text-[#34c759] text-xs">Status</span><span className="px-2.5 py-1 rounded bg-white/10 text-xs">Date</span><span className="px-2.5 py-1 rounded bg-white/10 text-xs">Person</span></div>
              </div>
            )}
          </div>
          <div className="flex flex-col gap-2">
            <div className="text-white/50">View</div>
            <HotspotButton id="notion-linked" currentHotspotId={currentHotspotId} onStepComplete={onStepComplete} {...(onWrongTap != null && { onWrongTap })} showHighlight={showHighlight}>
              <div className={`${HOTSPOT_BTN} justify-between ${currentHotspotId === 'notion-linked' ? HOTSPOT_ACTIVE : HOTSPOT_INACTIVE} ${hasLinked ? 'border border-[#34c759]/40' : ''}`}>Linked {hasLinked && '✓'}</div>
            </HotspotButton>
            {currentHotspotId === 'notion-linked' && (
              <div className="p-3 rounded-lg bg-[#454545] border border-white/10 space-y-1">
                <div className="text-white/70 text-xs">View type:</div>
                <div className="flex gap-1"><span className="px-2.5 py-1 rounded bg-[#34c759]/20 text-[#34c759] text-xs">Board</span><span className="px-2.5 py-1 rounded bg-white/10 text-xs">Calendar</span></div>
              </div>
            )}
            <HotspotButton id="notion-filter" currentHotspotId={currentHotspotId} onStepComplete={onStepComplete} {...(onWrongTap != null && { onWrongTap })} showHighlight={showHighlight}>
              <div className={`${HOTSPOT_BTN} justify-between ${currentHotspotId === 'notion-filter' ? HOTSPOT_ACTIVE : HOTSPOT_INACTIVE} ${hasFilter ? 'border border-[#34c759]/40' : ''}`}>Filter {hasFilter && '✓'}</div>
            </HotspotButton>
            {['Layout', 'Show', 'Hide', 'Export'].map(notionClutter)}
            {currentHotspotId === 'notion-filter' && (
              <div className="p-3 rounded-lg bg-[#454545] border border-white/10 space-y-1">
                <div className="text-white/70 text-xs">Add condition:</div>
                <div className="text-xs text-white/50">Status = In progress</div>
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
  const [quickDemo, setQuickDemo] = useState(false)

  const rawTask = taskId ? TASKS[taskId] : null
  const task = useMemo(
    () => (rawTask && quickDemo && taskId === 'figmaMindmap'
      ? { ...rawTask, steps: rawTask.steps.slice(0, 5) }
      : rawTask),
    [rawTask, quickDemo, taskId]
  )
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
  const mockStepIdx = task && quickDemo && taskId === 'figmaMindmap' && stepIdx >= 3
    ? stepIdx + 1
    : (phase === 'steps' ? stepIdx : (task?.steps.length ?? 0))

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
                  <label className="flex items-center gap-2 mb-4 cursor-pointer">
                    <input type="checkbox" checked={quickDemo} onChange={(e) => setQuickDemo(e.target.checked)} className="rounded border-white/30 bg-white/5" />
                    <span className="text-sm text-white/70">Quick demo (shorter mindmap)</span>
                  </label>
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
                {MockComponent && <MockComponent {...(phase === 'steps' && step?.hotspotId ? { currentHotspotId: step.hotspotId } : {})} onStepComplete={handleNext} {...(phase === 'steps' && { onWrongTap: handleWrongTap })} showHighlight={phase === 'steps' && showHighlight} stepIdx={phase === 'steps' ? mockStepIdx : (task?.steps.length ?? 0)} {...(taskId ? { taskId } : {})} />}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
