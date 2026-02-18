'use client'

import Link from 'next/link'
import { useState, useCallback } from 'react'

type Step = {
  title: string
  desc: string
  hint: string
  highlight: { x: number; y: number; w: number; h: number }
}

type Task = {
  app: string
  steps: Step[]
}

const TASKS: Record<string, Task> = {
  removeBg: {
    app: 'Photoshop',
    steps: [
      {
        title: 'Select the subject',
        desc: 'Use the Object Selection tool (W) or Quick Selection (W) to select the main subject. Click and drag around the object.',
        hint: 'Tip: Hold Alt and click to subtract from selection',
        highlight: { x: 24, y: 48, w: 72, h: 28 },
      },
      {
        title: 'Refine the selection',
        desc: 'Go to Select > Select and Mask. Use the Refine Edge Brush to clean up hair or fine edges.',
        hint: 'Set Output to "New Layer with Layer Mask"',
        highlight: { x: 140, y: 12, w: 110, h: 24 },
      },
      {
        title: 'Create layer mask',
        desc: 'With the selection active, click the Add Layer Mask icon at the bottom of the Layers panel.',
        hint: 'The mask hides the background, revealing transparency',
        highlight: { x: 310, y: 200, w: 56, h: 36 },
      },
      {
        title: 'Verify and export',
        desc: 'Toggle the background layer visibility to check the result. Use File > Export > Export As for PNG with transparency.',
        hint: 'PNG preserves transparency for web or other apps',
        highlight: { x: 240, y: 12, w: 72, h: 24 },
      },
    ],
  },
  colorGrade: {
    app: 'Lightroom',
    steps: [
      {
        title: 'Open the Develop module',
        desc: 'Select your photo and switch to the Develop module (or press D).',
        hint: 'Develop is where all editing happens',
        highlight: { x: 180, y: 12, w: 90, h: 24 },
      },
      {
        title: 'Adjust basic sliders',
        desc: 'Start with Exposure, Contrast, Highlights, and Shadows. Pull Highlights down and Shadows up for a balanced look.',
        hint: 'Aim for detail in both bright and dark areas',
        highlight: { x: 20, y: 100, w: 80, h: 120 },
      },
      {
        title: 'Apply a preset (optional)',
        desc: 'In the left panel, browse Presets. Click one to preview—adjust Strength if needed.',
        hint: 'Presets are a quick starting point',
        highlight: { x: 20, y: 60, w: 100, h: 32 },
      },
      {
        title: 'Fine-tune with HSL',
        desc: 'Open the HSL/Color panel. Adjust Hue, Saturation, and Luminance per color channel to match your style.',
        hint: 'Orange/red for skin tones, blue for skies',
        highlight: { x: 20, y: 180, w: 80, h: 80 },
      },
    ],
  },
  exportFigma: {
    app: 'Figma',
    steps: [
      {
        title: 'Select the frame or layer',
        desc: 'Click the frame, component, or layer you want to export in the canvas or Layers panel.',
        hint: 'Frames export as whole images',
        highlight: { x: 120, y: 100, w: 160, h: 80 },
      },
      {
        title: 'Open export settings',
        desc: 'In the right panel, scroll to the Export section. Click the + button to add an export format.',
        hint: 'You can add multiple export settings',
        highlight: { x: 320, y: 140, w: 56, h: 28 },
      },
      {
        title: 'Choose format and scale',
        desc: 'Select PNG, JPG, SVG, or PDF. Set scale (1x, 2x, 3x) for resolution.',
        hint: '2x or 3x for retina/high-DPI',
        highlight: { x: 300, y: 180, w: 90, h: 36 },
      },
      {
        title: 'Export',
        desc: 'Click Export [name] or use the bulk Export button at the bottom. Choose save location.',
        hint: 'Cmd+E (Mac) or Ctrl+E (Win) for quick export',
        highlight: { x: 310, y: 230, w: 70, h: 32 },
      },
    ],
  },
}

const TASK_LABELS: Record<string, string> = {
  removeBg: 'Remove background',
  colorGrade: 'Color grade photo',
  exportFigma: 'Export for web',
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0d0d0d] via-[#1a1a1a] to-[#0d0d0d] p-4">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <Link href="/" className="text-white hover:text-gray-300 text-2xl font-bold">
            ← Home
          </Link>
          <span className="text-lg font-semibold text-white">
            Pear<span className="text-[#34c759]">Navigator</span>
          </span>
          <div className="w-24" />
        </div>

        <div className="flex flex-col lg:flex-row gap-6 items-start">
          {/* Guide panel */}
          <div className="flex-1 w-full max-w-md bg-white/5 backdrop-blur-sm rounded-2xl border border-white/10 overflow-hidden">
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
                  <div className="space-y-2 mb-6">
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
                    {step.hint}
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

          {/* Mock app preview with overlay */}
          <div className="flex-shrink-0">
            <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">
              {phase === 'task' ? 'Your creative app' : task?.app ?? 'Your creative app'}
            </p>
            <div className="relative w-[400px] h-[280px] bg-[#2d2d2d] rounded-xl border border-white/10 overflow-hidden">
              {/* Mock app UI */}
              <div className="absolute inset-0 flex flex-col">
                <div className="h-8 bg-[#1e1e1e] border-b border-white/10 flex items-center px-3 gap-4">
                  <div className="w-12 h-2 bg-white/20 rounded" />
                  <div className="w-16 h-2 bg-white/20 rounded" />
                  <div className="w-20 h-2 bg-white/20 rounded" />
                </div>
                <div className="flex flex-1">
                  <div className="w-16 bg-[#252525] border-r border-white/10 p-2 space-y-2">
                    {[1, 2, 3, 4, 5].map((i) => (
                      <div key={i} className="w-10 h-10 bg-white/10 rounded" />
                    ))}
                  </div>
                  <div className="flex-1 p-4 bg-[#2a2a2a]">
                    <div className="w-full h-full border border-dashed border-white/20 rounded flex items-center justify-center text-white/30 text-sm">
                      Canvas
                    </div>
                  </div>
                  <div className="w-24 bg-[#252525] border-l border-white/10 p-2 space-y-2">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="w-full h-6 bg-white/10 rounded" />
                    ))}
                  </div>
                </div>
              </div>
              {/* Scripted red ellipse overlay (OverlayEye-style) */}
              {phase === 'steps' && showHighlight && step && (
                <div
                  className="absolute pointer-events-none rounded-full border-[3px] border-red-500"
                  style={{
                    left: step.highlight.x,
                    top: step.highlight.y,
                    width: step.highlight.w,
                    height: step.highlight.h,
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
