'use client'

import Link from 'next/link'
import React, { useState, useCallback } from 'react'

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
}

type MockProps = {
  currentHotspotId?: string | undefined
  onStepComplete: () => void
  showHighlight?: boolean | undefined
  stepIdx?: number | undefined
}

function HotspotButton({
  id,
  currentHotspotId,
  onStepComplete,
  showHighlight,
  children,
  className,
}: {
  id: string
  currentHotspotId?: string | undefined
  onStepComplete: () => void
  showHighlight?: boolean | undefined
  children: React.ReactNode
  className?: string
}) {
  const isTarget = currentHotspotId === id
  const showOverlay = showHighlight && isTarget
  return (
    <button
      type="button"
      onClick={() => isTarget && onStepComplete()}
      className={`relative cursor-pointer touch-manipulation active:scale-95 transition-transform focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2 focus-visible:ring-offset-[#252525] ${className ?? ''}`}
      aria-pressed={isTarget}
    >
      {children}
      {showOverlay && (
        <span
          role="img"
          aria-label={`Highlight: ${id}`}
          className="absolute inset-0 rounded-lg border-[4px] border-red-500 bg-red-500/20 pointer-events-none z-10 ring-4 ring-red-500/40 shadow-lg shadow-red-500/30"
        />
      )}
    </button>
  )
}

const TASK_LABELS: Record<string, string> = {
  procreateBrush: 'Create custom brush',
  notionDb: 'Create linked database view',
  figmaVariants: 'Create component variants',
}

function FigmaMock({ currentHotspotId, onStepComplete, showHighlight, stepIdx = 0 }: MockProps) {
  const hasSelection = stepIdx >= 1
  const isComponent = stepIdx >= 2
  const hasVariants = stepIdx >= 4
  return (
    <div className="absolute inset-0 flex flex-col text-xs">
      <div className="h-9 bg-[#2e2e2e] border-b border-white/15 flex items-center px-3 gap-4 shrink-0">
        <span className="text-white/80">Frame</span>
        <span className="text-white/80">Component</span>
        <span className="text-white/80">Prototype</span>
      </div>
      <div className="flex flex-1 min-h-0">
        <HotspotButton id="fig-canvas" currentHotspotId={currentHotspotId} onStepComplete={onStepComplete} showHighlight={showHighlight} className="flex-1 min-w-0 flex flex-col min-h-0">
          <div className="flex-1 p-4 bg-[#404040] min-w-0 min-h-0">
            <div className={`w-full h-full border-2 border-dashed rounded-lg flex flex-col items-center justify-center gap-2 text-sm transition-colors ${hasSelection ? 'border-[#8b5cf6]/60 bg-[#8b5cf6]/5' : ''} ${currentHotspotId === 'fig-canvas' ? 'border-[#34c759]/60 text-[#34c759]' : 'border-white/25 text-white/40'}`}>
              {hasSelection && <div className="w-24 h-16 rounded bg-white/20" />}
              <span>{isComponent ? 'Component' : 'Canvas'}</span>
              {hasVariants && <span className="text-[10px] text-[#34c759]/80">Default · Hover · Pressed</span>}
            </div>
          </div>
        </HotspotButton>
        <div className="w-36 bg-[#383838] border-l border-white/15 p-3 shrink-0 flex flex-col gap-2">
          <HotspotButton id="fig-component-tab" currentHotspotId={currentHotspotId} onStepComplete={onStepComplete} showHighlight={showHighlight}>
            <div className={`min-h-[44px] h-10 rounded flex items-center px-2 text-[10px] ${currentHotspotId === 'fig-component-tab' ? 'bg-[#34c759]/30 text-[#34c759]' : 'bg-[#34c759]/20 text-[#34c759]'}`}>Create component</div>
          </HotspotButton>
          <div className="text-white/50 mb-1 mt-2">Component</div>
          <HotspotButton id="fig-component-add" currentHotspotId={currentHotspotId} onStepComplete={onStepComplete} showHighlight={showHighlight}>
            <div className={`min-h-[44px] h-10 rounded flex items-center px-2 text-[10px] ${currentHotspotId === 'fig-component-add' ? 'bg-[#34c759]/30 text-[#34c759]' : 'bg-[#34c759]/20 text-[#34c759]'}`}>+ Property</div>
          </HotspotButton>
          <HotspotButton id="fig-variants" currentHotspotId={currentHotspotId} onStepComplete={onStepComplete} showHighlight={showHighlight}>
            <div className={`min-h-[44px] h-10 rounded flex items-center px-2 text-[10px] ${currentHotspotId === 'fig-variants' ? 'bg-[#34c759]/30 text-[#34c759]' : 'bg-[#34c759]/20 text-[#34c759]'}`}>Variants</div>
          </HotspotButton>
          <HotspotButton id="fig-swap" currentHotspotId={currentHotspotId} onStepComplete={onStepComplete} showHighlight={showHighlight}>
            <div className={`min-h-[44px] h-10 rounded mt-2 flex items-center px-2 text-[10px] ${currentHotspotId === 'fig-swap' ? 'bg-[#34c759]/30 text-[#34c759]' : 'bg-white/5 text-white/70'}`}>Swap</div>
          </HotspotButton>
        </div>
      </div>
    </div>
  )
}

function ProcreateMock({ currentHotspotId, onStepComplete, showHighlight, stepIdx = 0 }: MockProps) {
  const brushActive = stepIdx >= 1
  const hasNewBrush = stepIdx >= 2
  const inBrushStudio = stepIdx >= 2
  const brushSaved = stepIdx >= 5
  return (
    <div className="absolute inset-0 flex flex-col text-xs">
      <div className="h-10 bg-[#2e2e2e] border-b border-white/15 flex items-center justify-center gap-8 px-4 shrink-0">
        <span className="text-white/80">Actions</span>
        <HotspotButton id="proc-brush" currentHotspotId={currentHotspotId} onStepComplete={onStepComplete} showHighlight={showHighlight}>
          <span className={`${brushActive ? 'text-[#34c759] font-medium' : 'text-white/80'}`}>Brush</span>
        </HotspotButton>
        <span className="text-white/80">Eraser</span>
        <span className="text-white/80">Layers</span>
      </div>
      <div className="flex flex-1 min-h-0">
        <div className="w-24 bg-[#383838] border-r border-white/15 p-2 shrink-0">
          <HotspotButton id="proc-new" currentHotspotId={currentHotspotId} onStepComplete={onStepComplete} showHighlight={showHighlight}>
            <div className={`min-h-[44px] h-11 rounded mb-2 text-[9px] flex items-center justify-center ${currentHotspotId === 'proc-new' ? 'bg-[#34c759]/30 text-[#34c759]' : 'bg-[#34c759]/20 text-[#34c759]'}`}>+ New</div>
          </HotspotButton>
          <div className="h-10 bg-white/10 rounded mb-2" />
          <div className="h-10 bg-white/10 rounded" />
        </div>
        <div className={`flex-1 p-4 min-w-0 transition-all ${brushActive ? 'bg-[#404040]' : 'bg-[#404040]'}`}>
          <div className={`w-full h-full border-2 border-dashed rounded-lg flex flex-col items-center justify-center gap-2 text-sm transition-all relative ${brushActive ? 'border-white/30' : 'border-white/20'}`}>
            {brushActive && <div className="absolute top-4 right-4 w-6 h-6 rounded-full border-2 border-[#34c759] bg-[#34c759]/30" title="Brush cursor" />}
            {hasNewBrush && <div className="w-12 h-12 rounded-full bg-[#34c759]/40 border-2 border-[#34c759]/60" />}
            {inBrushStudio && <span className="text-white/50 text-[10px]">Brush Studio</span>}
            {brushSaved && <span className="text-[#34c759] text-xs">✓ Saved</span>}
            {!hasNewBrush && !brushSaved && <span className="text-white/40">Canvas</span>}
          </div>
        </div>
        <div className="w-28 bg-[#383838] border-l border-white/15 p-2 shrink-0">
          <div className="text-white/50 mb-1">Brush Studio</div>
          <HotspotButton id="proc-shape" currentHotspotId={currentHotspotId} onStepComplete={onStepComplete} showHighlight={showHighlight}>
            <div className={`min-h-[44px] h-10 rounded mb-2 text-[9px] flex items-center px-2 ${currentHotspotId === 'proc-shape' ? 'bg-[#34c759]/30 text-[#34c759]' : 'bg-[#34c759]/20 text-[#34c759]'}`}>Shape</div>
          </HotspotButton>
          <HotspotButton id="proc-dynamics" currentHotspotId={currentHotspotId} onStepComplete={onStepComplete} showHighlight={showHighlight}>
            <div className={`min-h-[44px] h-10 rounded mb-2 text-[9px] flex items-center px-2 ${currentHotspotId === 'proc-dynamics' ? 'bg-[#34c759]/30 text-[#34c759]' : 'bg-[#34c759]/20 text-[#34c759]'}`}>Dynamics</div>
          </HotspotButton>
          <div className="h-8 bg-white/5 rounded mb-4" />
          <HotspotButton id="proc-done" currentHotspotId={currentHotspotId} onStepComplete={onStepComplete} showHighlight={showHighlight}>
            <div className={`min-h-[44px] h-11 rounded flex items-center justify-center text-[9px] ${currentHotspotId === 'proc-done' ? 'bg-[#34c759]/30 text-[#34c759]' : 'bg-[#34c759]/20 text-[#34c759]'}`}>Done</div>
          </HotspotButton>
        </div>
      </div>
    </div>
  )
}

function NotionMock({ currentHotspotId, onStepComplete, showHighlight, stepIdx = 0 }: MockProps) {
  const hasPage = stepIdx >= 1
  const hasDb = stepIdx >= 2
  return (
    <div className="absolute inset-0 flex flex-col text-xs">
      <div className="h-9 bg-[#2e2e2e] border-b border-white/15 flex items-center px-3 shrink-0">
        <HotspotButton id="notion-new" currentHotspotId={currentHotspotId} onStepComplete={onStepComplete} showHighlight={showHighlight}>
          <span className={hasPage ? 'text-[#34c759] font-medium' : 'text-white/80'}>+ New page</span>
        </HotspotButton>
      </div>
      <div className="flex flex-1 min-h-0">
        <div className="w-28 bg-[#383838] border-r border-white/15 p-2 shrink-0">
          <HotspotButton id="notion-new" currentHotspotId={currentHotspotId} onStepComplete={onStepComplete} showHighlight={showHighlight}>
            <div className={`min-h-[44px] h-10 rounded mb-2 text-[9px] flex items-center px-2 ${currentHotspotId === 'notion-new' ? 'bg-[#34c759]/30 text-[#34c759]' : 'bg-[#34c759]/20 text-[#34c759]'}`}>+ Add</div>
          </HotspotButton>
          <div className="h-8 bg-white/10 rounded mb-2" />
          <div className="h-8 bg-white/10 rounded" />
        </div>
        <div className="flex-1 p-4 bg-[#404040] min-w-0">
          <HotspotButton id="notion-db" currentHotspotId={currentHotspotId} onStepComplete={onStepComplete} showHighlight={showHighlight}>
            <div className={`min-h-[44px] h-10 rounded mb-2 w-36 ${currentHotspotId === 'notion-db' ? 'bg-[#34c759]/30' : 'bg-[#34c759]/20'}`} />
          </HotspotButton>
          {hasDb && <div className="h-20 bg-white/10 rounded mb-2 flex gap-2 p-2"><div className="flex-1 h-4 bg-white/20 rounded" /><div className="flex-1 h-4 bg-white/20 rounded" /></div>}
          <div className="text-white/50 text-[10px]">/table or /database</div>
        </div>
        <div className="w-36 bg-[#383838] border-l border-white/15 p-3 shrink-0 flex flex-col gap-3">
          <div>
            <div className="text-white/50 mb-2">Properties</div>
            <HotspotButton id="notion-props" currentHotspotId={currentHotspotId} onStepComplete={onStepComplete} showHighlight={showHighlight}>
              <div className={`min-h-[44px] h-9 rounded flex items-center px-2 text-[9px] ${currentHotspotId === 'notion-props' ? 'bg-[#34c759]/30 text-[#34c759]' : 'bg-[#34c759]/20 text-[#34c759]'}`}>+ Add</div>
            </HotspotButton>
          </div>
          <div className="flex flex-col gap-2">
            <div className="text-white/50">View</div>
            <HotspotButton id="notion-linked" currentHotspotId={currentHotspotId} onStepComplete={onStepComplete} showHighlight={showHighlight}>
              <div className={`min-h-[44px] h-9 rounded flex items-center px-2 text-[9px] ${currentHotspotId === 'notion-linked' ? 'bg-[#34c759]/30 text-[#34c759]' : 'bg-[#34c759]/20 text-[#34c759]'}`}>Linked</div>
            </HotspotButton>
            <HotspotButton id="notion-filter" currentHotspotId={currentHotspotId} onStepComplete={onStepComplete} showHighlight={showHighlight}>
              <div className={`min-h-[44px] h-9 rounded flex items-center px-2 text-[9px] ${currentHotspotId === 'notion-filter' ? 'bg-[#34c759]/30 text-[#34c759]' : 'bg-[#34c759]/20 text-[#34c759]'}`}>Filter</div>
            </HotspotButton>
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

  const task = taskId ? TASKS[taskId] : null
  const step = task ? task.steps[stepIdx] : null
  const isLastStep = task && stepIdx === task.steps.length - 1

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

  const handleReset = useCallback(() => {
    setPhase('task')
    setTaskId(null)
    setStepIdx(0)
    setShowHighlight(false)
  }, [])

  const MockComponent = task ? MOCK_COMPONENTS[task.mock] : null

  return (
    <div className="h-screen w-screen overflow-hidden bg-gradient-to-br from-[#0d0d0d] via-[#1a1a1a] to-[#0d0d0d] flex flex-col">
      <div className="flex-none flex items-center justify-between px-4 py-3">
          <Link href="/" className="text-white hover:text-gray-300 text-2xl font-bold">
            ← Home
          </Link>
          <span className="text-lg font-semibold text-white">
            Pear<span className="text-[#34c759]">Navigator</span>
          </span>
          <span className="text-xs text-gray-500">PearPad</span>
      </div>

      <div className="flex-1 flex flex-col lg:flex-row gap-4 px-4 pb-4 min-h-0 overflow-hidden">
        {/* Guide panel */}
        <div className="flex-none lg:w-96 xl:w-[420px] bg-white/5 backdrop-blur-sm rounded-2xl border border-white/10 overflow-y-auto shrink-0">
            <div className="p-6">
              {phase === 'task' && (
                <>
                  <p className="text-xs font-semibold text-[#34c759] uppercase tracking-wider mb-2">
                    What do you want to do?
                  </p>
                  <h2 className="text-xl font-semibold text-white mb-2">Tell Pear Navigator your goal</h2>
                  <p className="text-gray-400 text-sm mb-4">
                    Pick a task. The guide will appear step by step with highlights.
                  </p>
                  <div className="space-y-2 mb-6 max-h-[320px] overflow-y-auto">
                    {Object.entries(TASKS).map(([id, t]) => (
                      <button
                        key={id}
                        onClick={() => setTaskId(id)}
                        className={`w-full text-left px-4 py-3 rounded-xl border transition-all ${
                          taskId === id
                            ? 'border-[#34c759] bg-[#34c759]/15 text-white'
                            : 'border-white/10 bg-white/5 text-gray-300 hover:border-[#34c759]/50'
                        }`}
                      >
                        {t.app}: {TASK_LABELS[id]}
                      </button>
                    ))}
                  </div>
                  <button
                    onClick={handleStart}
                    disabled={!taskId}
                    className="w-full py-4 rounded-xl bg-[#34c759] text-black font-semibold disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90 transition-opacity"
                  >
                    Start guide
                  </button>
                </>
              )}

              {phase === 'steps' && task && step && (
                <>
                  <p className="text-xs font-semibold text-[#34c759] uppercase tracking-wider mb-2">
                    Step {stepIdx + 1} of {task.steps.length}
                  </p>
                  <h2 className="text-xl font-semibold text-white mb-2">{step.title}</h2>
                  <p className="text-gray-400 text-sm mb-4">{step.desc}</p>
                  {step.hint && (
                    <div className="mb-4 p-3 rounded-lg bg-[#34c759]/15 border border-[#34c759]/30 text-[#34c759] text-sm">
                      {step.hint}
                    </div>
                  )}
                  <p className="mb-3 text-sm text-gray-400">
                    Tap the highlighted button in the simulator to complete this step
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setShowHighlight((h) => !h)}
                      className="flex-1 py-3 rounded-xl border border-white/20 bg-white/5 text-white font-medium hover:bg-white/10 transition-colors"
                    >
                      {showHighlight ? 'Hide highlight' : 'Show highlight'}
                    </button>
                    <button
                      onClick={handleNext}
                      className="flex-1 py-3 rounded-xl bg-[#34c759] text-black font-semibold hover:opacity-90 transition-opacity"
                    >
                      {isLastStep ? 'Done' : 'Next step'}
                    </button>
                  </div>
                </>
              )}

              {phase === 'done' && (
                <div className="text-center py-8">
                  <div className="text-5xl text-[#34c759] mb-4">✓</div>
                  <h2 className="text-2xl font-bold text-white mb-2">Task complete</h2>
                  <p className="text-gray-400 mb-6">
                    You&apos;ve finished the guide. Try another task or refine your result.
                  </p>
                  <button
                    onClick={handleReset}
                    className="px-8 py-3 rounded-xl bg-[#34c759] text-black font-semibold hover:opacity-90 transition-opacity"
                  >
                    Start over
                  </button>
                </div>
              )}
            </div>
        </div>

        {/* Mock app preview - fills remaining space */}
        <div className="flex-1 min-w-0 min-h-0 flex flex-col">
          <div className="flex-1 min-h-0 relative bg-[#3a3a3a] rounded-xl border border-white/15 overflow-hidden">
            {MockComponent && <MockComponent {...(phase === 'steps' && step?.hotspotId ? { currentHotspotId: step.hotspotId } : {})} onStepComplete={handleNext} showHighlight={phase === 'steps' && showHighlight} {...(phase === 'steps' ? { stepIdx } : {})} />}
          </div>
        </div>
      </div>
    </div>
  )
}
