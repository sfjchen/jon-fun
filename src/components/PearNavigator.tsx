'use client'

import Link from 'next/link'
import React, { useState, useCallback, useMemo } from 'react'

type Step = {
  title: string
  desc: string
  hint?: string
  hintMac?: string
  hintWin?: string
  highlight: { x: number; y: number; w: number; h: number }
}

type Task = {
  app: string
  steps: Step[]
  mock: 'photoshop' | 'lightroom' | 'figma' | 'procreate' | 'notion'
}

function isMac(): boolean {
  if (typeof window === 'undefined') return true
  return /Mac|iPhone|iPad|iPod/.test(navigator.platform) || navigator.userAgent.includes('Mac')
}

function shortcut(text: string, isMacOS: boolean): string {
  return text
    .replace(/\bCmd\b/g, isMacOS ? '⌘' : 'Ctrl')
    .replace(/\bCtrl\b/g, isMacOS ? '⌘' : 'Ctrl')
    .replace(/\bAlt\b/g, isMacOS ? '⌥' : 'Alt')
    .replace(/\bOption\b/g, isMacOS ? '⌥' : 'Alt')
}

const TASKS: Record<string, Task> = {
  removeBg: {
    app: 'Photoshop',
    mock: 'photoshop',
    steps: [
      {
        title: 'Select the subject',
        desc: 'Use the Object Selection tool or Quick Selection (W) to select the main subject. Click and drag around the object.',
        hint: 'Hold Alt and click to subtract from selection',
        highlight: { x: 24, y: 52, w: 100, h: 32 },
      },
      {
        title: 'Refine the selection',
        desc: 'Go to Select > Select and Mask. Use the Refine Edge Brush to clean up hair or fine edges.',
        hint: 'Set Output to "New Layer with Layer Mask"',
        highlight: { x: 180, y: 14, w: 130, h: 28 },
      },
      {
        title: 'Create layer mask',
        desc: 'With the selection active, click the Add Layer Mask icon at the bottom of the Layers panel.',
        hint: 'The mask hides the background, revealing transparency',
        highlight: { x: 520, y: 220, w: 70, h: 40 },
      },
      {
        title: 'Verify and export',
        desc: 'Toggle the background layer visibility to check the result. Use File > Export > Export As for PNG with transparency.',
        hintMac: '⌘+E for quick export',
        hintWin: 'Ctrl+E for quick export',
        highlight: { x: 24, y: 14, w: 50, h: 28 },
      },
    ],
  },
  colorGrade: {
    app: 'Lightroom',
    mock: 'lightroom',
    steps: [
      {
        title: 'Open the Develop module',
        desc: 'Select your photo and switch to the Develop module (or press D).',
        hint: 'Develop is where all editing happens',
        highlight: { x: 200, y: 14, w: 100, h: 28 },
      },
      {
        title: 'Adjust basic sliders',
        desc: 'Start with Exposure, Contrast, Highlights, and Shadows. Pull Highlights down and Shadows up for a balanced look.',
        hint: 'Aim for detail in both bright and dark areas',
        highlight: { x: 24, y: 120, w: 90, h: 140 },
      },
      {
        title: 'Apply a preset (optional)',
        desc: 'In the left panel, browse Presets. Click one to preview—adjust Strength if needed.',
        hint: 'Presets are a quick starting point',
        highlight: { x: 24, y: 70, w: 110, h: 36 },
      },
      {
        title: 'Fine-tune with HSL',
        desc: 'Open the HSL/Color panel. Adjust Hue, Saturation, and Luminance per color channel to match your style.',
        hint: 'Orange/red for skin tones, blue for skies',
        highlight: { x: 24, y: 200, w: 90, h: 90 },
      },
    ],
  },
  exportFigma: {
    app: 'Figma',
    mock: 'figma',
    steps: [
      {
        title: 'Select the frame or layer',
        desc: 'Click the frame, component, or layer you want to export in the canvas or Layers panel.',
        hint: 'Frames export as whole images',
        highlight: { x: 180, y: 140, w: 200, h: 100 },
      },
      {
        title: 'Open export settings',
        desc: 'In the right panel, scroll to the Export section. Click the + button to add an export format.',
        hint: 'You can add multiple export settings',
        highlight: { x: 520, y: 160, w: 70, h: 32 },
      },
      {
        title: 'Choose format and scale',
        desc: 'Select PNG, JPG, SVG, or PDF. Set scale (1x, 2x, 3x) for resolution.',
        hint: '2x or 3x for retina/high-DPI',
        highlight: { x: 500, y: 200, w: 100, h: 40 },
      },
      {
        title: 'Export',
        desc: 'Click Export [name] or use the bulk Export button at the bottom. Choose save location.',
        hintMac: '⌘+E for quick export',
        hintWin: 'Ctrl+E for quick export',
        highlight: { x: 510, y: 260, w: 80, h: 36 },
      },
    ],
  },
  procreateBrush: {
    app: 'Procreate (iPad)',
    mock: 'procreate',
    steps: [
      {
        title: 'Open Brush Library',
        desc: 'Tap the brush icon in the top toolbar to open the Brush Library.',
        hint: 'Swipe left on a brush to duplicate',
        highlight: { x: 280, y: 14, w: 80, h: 36 },
      },
      {
        title: 'Create new brush',
        desc: 'Tap the + icon in the Brush Library to create a new brush.',
        hint: 'Start from a base brush you like',
        highlight: { x: 24, y: 70, w: 60, h: 36 },
      },
      {
        title: 'Adjust shape and grain',
        desc: 'In Brush Studio, tap Shape and Grain to customize the brush tip.',
        hint: 'Import custom grain images',
        highlight: { x: 520, y: 100, w: 80, h: 32 },
      },
      {
        title: 'Set dynamics',
        desc: 'Open the Dynamics section. Adjust Size, Opacity, and Flow for pressure response.',
        hint: 'Apple Pencil pressure affects stroke',
        highlight: { x: 520, y: 160, w: 80, h: 32 },
      },
      {
        title: 'Save and name',
        desc: 'Tap Done. Name your brush in the Brush Library.',
        hint: 'Organize brushes into sets',
        highlight: { x: 300, y: 320, w: 100, h: 36 },
      },
    ],
  },
  notionDb: {
    app: 'Notion (tablet)',
    mock: 'notion',
    steps: [
      {
        title: 'Create new page',
        desc: 'Tap + in the sidebar or swipe to create a new page.',
        hint: 'Use templates for quick start',
        highlight: { x: 24, y: 60, w: 90, h: 36 },
      },
      {
        title: 'Add database block',
        desc: 'Type /table or /database and select Table – Inline.',
        hint: 'Database can be full-page or inline',
        highlight: { x: 180, y: 120, w: 120, h: 32 },
      },
      {
        title: 'Add properties',
        desc: 'Tap + to add columns: Status, Date, Person, etc.',
        hint: 'Status is useful for PM workflows',
        highlight: { x: 480, y: 80, w: 100, h: 28 },
      },
      {
        title: 'Create linked view',
        desc: 'Open database menu (⋯), choose New linked view. Pick a board or calendar.',
        hint: 'Same data, different views',
        highlight: { x: 520, y: 140, w: 80, h: 32 },
      },
      {
        title: 'Add filters',
        desc: 'Tap Filter, add conditions (e.g. Status = In progress).',
        hint: 'Filters apply to current view only',
        highlight: { x: 520, y: 200, w: 70, h: 28 },
      },
    ],
  },
  figmaVariants: {
    app: 'Figma (tablet)',
    mock: 'figma',
    steps: [
      {
        title: 'Select component',
        desc: 'Select the frame or group you want to turn into a component.',
        hint: 'Components are reusable',
        highlight: { x: 180, y: 100, w: 180, h: 80 },
      },
      {
        title: 'Create component',
        desc: 'Tap the component icon in the toolbar or use the shortcut.',
        hintMac: '⌘+Option+K to create component',
        hintWin: 'Ctrl+Alt+K to create component',
        highlight: { x: 260, y: 14, w: 100, h: 36 },
      },
      {
        title: 'Add property',
        desc: 'In the right panel, under Component, tap + to add a property (e.g. State).',
        hint: 'Variant = one property with multiple values',
        highlight: { x: 520, y: 100, w: 80, h: 32 },
      },
      {
        title: 'Create variants',
        desc: 'Add values (Default, Hover, Pressed). Figma creates a variant set.',
        hint: 'Each value = one variant',
        highlight: { x: 500, y: 160, w: 100, h: 40 },
      },
      {
        title: 'Swap instances',
        desc: 'Select an instance. In the panel, use the dropdown to swap variants.',
        hint: 'Instances inherit component changes',
        highlight: { x: 510, y: 240, w: 90, h: 36 },
      },
    ],
  },
}

const TASK_LABELS: Record<string, string> = {
  removeBg: 'Remove background',
  colorGrade: 'Color grade photo',
  exportFigma: 'Export for web',
  procreateBrush: 'Create custom brush',
  notionDb: 'Create linked database view',
  figmaVariants: 'Create component variants',
}

function PhotoshopMock() {
  return (
    <div className="absolute inset-0 flex flex-col text-xs">
      <div className="h-9 bg-[#1e1e1e] border-b border-white/10 flex items-center px-3 gap-6 shrink-0">
        <span className="text-white/80">File</span>
        <span className="text-white/80">Edit</span>
        <span className="text-[#34c759] font-medium">Select</span>
        <span className="text-white/80">Image</span>
        <span className="text-white/80">Layer</span>
        <span className="text-white/80">View</span>
      </div>
      <div className="flex flex-1 min-h-0">
        <div className="w-24 bg-[#252525] border-r border-white/10 p-2 space-y-2 shrink-0">
          <div className="h-9 flex items-center justify-center bg-white/10 rounded text-white/70">Object</div>
          <div className="h-9 flex items-center justify-center bg-white/10 rounded text-white/70">Quick</div>
          <div className="h-9 flex items-center justify-center bg-white/5 rounded text-white/40">Brush</div>
          <div className="h-9 flex items-center justify-center bg-white/5 rounded text-white/40">Eraser</div>
        </div>
        <div className="flex-1 p-4 bg-[#2a2a2a] min-w-0">
          <div className="w-full h-full border border-dashed border-white/20 rounded flex items-center justify-center text-white/30 text-sm">
            Canvas
          </div>
        </div>
        <div className="w-32 bg-[#252525] border-l border-white/10 p-2 shrink-0">
          <div className="text-white/50 mb-1">Layers</div>
          <div className="h-8 bg-white/5 rounded mb-2" />
          <div className="h-8 bg-white/5 rounded mb-2" />
          <div className="h-9 flex items-center justify-center bg-[#34c759]/20 rounded text-[#34c759] text-[10px]">Add Mask</div>
          <div className="mt-4 text-white/50">Export</div>
          <div className="h-8 bg-white/5 rounded mt-1" />
        </div>
      </div>
    </div>
  )
}

function LightroomMock() {
  return (
    <div className="absolute inset-0 flex flex-col text-xs">
      <div className="h-9 bg-[#1e1e1e] border-b border-white/10 flex items-center px-3 gap-6 shrink-0">
        <span className="text-white/80">Library</span>
        <span className="text-[#34c759] font-medium">Develop</span>
        <span className="text-white/80">Map</span>
        <span className="text-white/80">Book</span>
      </div>
      <div className="flex flex-1 min-h-0">
        <div className="w-28 bg-[#252525] border-r border-white/10 p-2 shrink-0">
          <div className="text-white/50 mb-1">Presets</div>
          <div className="h-8 bg-[#34c759]/20 rounded mb-2 text-[#34c759] text-[10px] flex items-center px-2">Preset 1</div>
          <div className="h-8 bg-white/5 rounded mb-2" />
          <div className="mt-4 text-white/50">Basic</div>
          <div className="h-20 bg-white/5 rounded mt-1" />
          <div className="mt-2 text-white/50">HSL</div>
          <div className="h-16 bg-[#34c759]/20 rounded mt-1" />
        </div>
        <div className="flex-1 p-4 bg-[#2a2a2a] min-w-0">
          <div className="w-full h-full border border-dashed border-white/20 rounded flex items-center justify-center text-white/30 text-sm">
            Photo
          </div>
        </div>
      </div>
    </div>
  )
}

function FigmaMock() {
  return (
    <div className="absolute inset-0 flex flex-col text-xs">
      <div className="h-9 bg-[#1e1e1e] border-b border-white/10 flex items-center px-3 gap-4 shrink-0">
        <span className="text-white/80">Frame</span>
        <span className="text-[#34c759] font-medium">Component</span>
        <span className="text-white/80">Prototype</span>
      </div>
      <div className="flex flex-1 min-h-0">
        <div className="flex-1 p-4 bg-[#2a2a2a] min-w-0">
          <div className="w-full h-full border border-dashed border-white/20 rounded flex items-center justify-center text-white/30 text-sm">
            Canvas
          </div>
        </div>
        <div className="w-36 bg-[#252525] border-l border-white/10 p-2 shrink-0">
          <div className="text-white/50 mb-1">Design</div>
          <div className="h-6 bg-white/5 rounded mb-2" />
          <div className="text-white/50 mb-1">Export</div>
          <div className="h-8 bg-[#34c759]/20 rounded mb-2 text-[#34c759] text-[10px] flex items-center px-2">+ Add</div>
          <div className="h-8 bg-white/5 rounded mb-4" />
          <div className="text-white/50 mb-1">Component</div>
          <div className="h-8 bg-[#34c759]/20 rounded text-[#34c759] text-[10px] flex items-center px-2">Variants</div>
        </div>
      </div>
    </div>
  )
}

function ProcreateMock() {
  return (
    <div className="absolute inset-0 flex flex-col text-xs">
      <div className="h-10 bg-[#1e1e1e] border-b border-white/10 flex items-center justify-center gap-8 px-4 shrink-0">
        <span className="text-white/80">Actions</span>
        <span className="text-[#34c759] font-medium">Brush</span>
        <span className="text-white/80">Eraser</span>
        <span className="text-white/80">Layers</span>
      </div>
      <div className="flex flex-1 min-h-0">
        <div className="w-20 bg-[#252525] border-r border-white/10 p-2 shrink-0">
          <div className="h-10 bg-[#34c759]/20 rounded mb-2 text-[#34c759] text-[9px] flex items-center justify-center">+ New</div>
          <div className="h-10 bg-white/5 rounded mb-2" />
          <div className="h-10 bg-white/5 rounded" />
        </div>
        <div className="flex-1 p-4 bg-[#2a2a2a] min-w-0">
          <div className="w-full h-full border border-dashed border-white/20 rounded flex items-center justify-center text-white/30 text-sm">
            Canvas
          </div>
        </div>
        <div className="w-28 bg-[#252525] border-l border-white/10 p-2 shrink-0">
          <div className="text-white/50 mb-1">Brush Studio</div>
          <div className="h-8 bg-[#34c759]/20 rounded mb-2 text-[#34c759] text-[9px] flex items-center px-1">Shape</div>
          <div className="h-8 bg-[#34c759]/20 rounded mb-2 text-[#34c759] text-[9px] flex items-center px-1">Dynamics</div>
          <div className="h-8 bg-white/5 rounded mb-4" />
          <div className="h-10 bg-[#34c759]/20 rounded flex items-center justify-center text-[#34c759] text-[9px]">Done</div>
        </div>
      </div>
    </div>
  )
}

function NotionMock() {
  return (
    <div className="absolute inset-0 flex flex-col text-xs">
      <div className="h-9 bg-[#1e1e1e] border-b border-white/10 flex items-center px-3 shrink-0">
        <span className="text-[#34c759] font-medium">+ New page</span>
      </div>
      <div className="flex flex-1 min-h-0">
        <div className="w-28 bg-[#252525] border-r border-white/10 p-2 shrink-0">
          <div className="h-9 bg-[#34c759]/20 rounded mb-2 text-[#34c759] text-[9px] flex items-center px-2">+ Add</div>
          <div className="h-8 bg-white/5 rounded mb-2" />
          <div className="h-8 bg-white/5 rounded" />
        </div>
        <div className="flex-1 p-4 bg-[#2a2a2a] min-w-0">
          <div className="h-8 bg-[#34c759]/20 rounded mb-2 w-32" />
          <div className="h-24 bg-white/5 rounded mb-2" />
          <div className="text-white/50 text-[10px]">/table or /database</div>
        </div>
        <div className="w-32 bg-[#252525] border-l border-white/10 p-2 shrink-0">
          <div className="text-white/50 mb-1">Properties</div>
          <div className="h-7 bg-[#34c759]/20 rounded mb-2 text-[#34c759] text-[9px] flex items-center px-2">+ Add</div>
          <div className="text-white/50 mb-1">View</div>
          <div className="h-8 bg-[#34c759]/20 rounded mb-2 text-[#34c759] text-[9px] flex items-center px-2">Linked</div>
          <div className="h-7 bg-[#34c759]/20 rounded text-[#34c759] text-[9px] flex items-center px-2">Filter</div>
        </div>
      </div>
    </div>
  )
}

const MOCK_COMPONENTS: Record<string, () => React.ReactNode> = {
  photoshop: PhotoshopMock,
  lightroom: LightroomMock,
  figma: FigmaMock,
  procreate: ProcreateMock,
  notion: NotionMock,
}

export default function PearNavigator() {
  const [phase, setPhase] = useState<'task' | 'steps' | 'done'>('task')
  const [taskId, setTaskId] = useState<string | null>(null)
  const [stepIdx, setStepIdx] = useState(0)
  const [showHighlight, setShowHighlight] = useState(false)

  const isMacOS = useMemo(isMac, [])

  const task = taskId ? TASKS[taskId] : null
  const step = task ? task.steps[stepIdx] : null
  const isLastStep = task && stepIdx === task.steps.length - 1

  const stepHint = step
    ? (isMacOS && step.hintMac ? step.hintMac : !isMacOS && step.hintWin ? step.hintWin : step.hint ?? '')
    : ''

  const handleStart = useCallback(() => {
    if (!taskId) return
    setPhase('steps')
    setStepIdx(0)
    setShowHighlight(false)
  }, [taskId])

  const handleNext = useCallback(() => {
    if (!task) return
    if (isLastStep) {
      setPhase('done')
      setShowHighlight(false)
    } else {
      setStepIdx((i) => i + 1)
      setShowHighlight(false)
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
    <div className="min-h-screen bg-gradient-to-br from-[#0d0d0d] via-[#1a1a1a] to-[#0d0d0d] p-4">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <Link href="/" className="text-white hover:text-gray-300 text-2xl font-bold">
            ← Home
          </Link>
          <span className="text-lg font-semibold text-white">
            Pear<span className="text-[#34c759]">Navigator</span>
          </span>
          <span className="text-xs text-gray-500">
            {isMacOS ? 'Mac' : 'Win'} shortcuts
          </span>
        </div>

        <div className="flex flex-col xl:flex-row gap-6 items-start">
          {/* Guide panel */}
          <div className="flex-1 w-full max-w-md bg-white/5 backdrop-blur-sm rounded-2xl border border-white/10 overflow-hidden shrink-0">
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
                  <div className="mb-4 p-3 rounded-lg bg-[#34c759]/15 border border-[#34c759]/30 text-[#34c759] text-sm">
                    {shortcut(stepHint, isMacOS)}
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setShowHighlight((h) => !h)}
                      className="flex-1 py-3 rounded-xl border border-white/20 bg-white/5 text-white font-medium hover:bg-white/10 transition-colors"
                    >
                      {showHighlight ? 'Hide highlight' : 'Highlight next step'}
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

          {/* Mock app preview - larger, with labeled elements */}
          <div className="flex-1 min-w-0 w-full xl:min-w-[600px]">
            <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">
              {phase === 'task' ? 'Your creative app' : task?.app ?? 'Your creative app'}
            </p>
            <div className="relative w-full aspect-[3/2] max-w-[640px] min-h-[320px] bg-[#2d2d2d] rounded-xl border border-white/10 overflow-hidden">
              {MockComponent && <MockComponent />}
              {phase === 'steps' && showHighlight && step && (
                <div
                  className="absolute pointer-events-none rounded-full border-[3px] border-red-500 z-10"
                  style={{
                    left: `${(step.highlight.x / 600) * 100}%`,
                    top: `${(step.highlight.y / 400) * 100}%`,
                    width: `${(step.highlight.w / 600) * 100}%`,
                    height: `${(step.highlight.h / 400) * 100}%`,
                  }}
                />
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
