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
  mock: 'photoshop' | 'lightroom' | 'figma' | 'procreate' | 'notion'
}

const TASKS: Record<string, Task> = {
  removeBg: {
    app: 'Photoshop',
    mock: 'photoshop',
    steps: [
      {
        title: 'Select the subject',
        desc: 'Tap the Object Selection or Quick Selection tool. Tap and drag around the main subject.',
        hint: 'Tap and hold another area to subtract from selection',
        highlight: { x: 24, y: 52, w: 100, h: 32 },
        hotspotId: 'ps-tool-object',
      },
      {
        title: 'Refine the selection',
        desc: 'Go to Select > Select and Mask. Use the Refine Edge Brush to clean up hair or fine edges.',
        hint: 'Set Output to "New Layer with Layer Mask"',
        highlight: { x: 180, y: 14, w: 130, h: 28 },
        hotspotId: 'ps-menu-select',
      },
      {
        title: 'Create layer mask',
        desc: 'With the selection active, tap the Add Layer Mask icon at the bottom of the Layers panel.',
        hint: 'The mask hides the background, revealing transparency',
        highlight: { x: 520, y: 220, w: 70, h: 40 },
        hotspotId: 'ps-add-mask',
      },
      {
        title: 'Verify and export',
        desc: 'Toggle the background layer visibility to check the result. Tap File > Export > Export As for PNG with transparency.',
        hint: 'Tap the File menu, then Export',
        highlight: { x: 24, y: 14, w: 50, h: 28 },
        hotspotId: 'ps-menu-file',
      },
    ],
  },
  colorGrade: {
    app: 'Lightroom',
    mock: 'lightroom',
    steps: [
      {
        title: 'Open the Develop module',
        desc: 'Select your photo and tap the Develop tab at the top.',
        hint: 'Develop is where all editing happens',
        highlight: { x: 200, y: 14, w: 100, h: 28 },
        hotspotId: 'lr-tab-develop',
      },
      {
        title: 'Adjust basic sliders',
        desc: 'Start with Exposure, Contrast, Highlights, and Shadows. Pull Highlights down and Shadows up for a balanced look.',
        hint: 'Aim for detail in both bright and dark areas',
        highlight: { x: 24, y: 120, w: 90, h: 140 },
        hotspotId: 'lr-panel-basic',
      },
      {
        title: 'Apply a preset (optional)',
        desc: 'In the left panel, browse Presets. Tap one to preview—adjust Strength if needed.',
        hint: 'Presets are a quick starting point',
        highlight: { x: 24, y: 70, w: 110, h: 36 },
        hotspotId: 'lr-preset',
      },
      {
        title: 'Fine-tune with HSL',
        desc: 'Open the HSL/Color panel. Adjust Hue, Saturation, and Luminance per color channel to match your style.',
        hint: 'Orange/red for skin tones, blue for skies',
        highlight: { x: 24, y: 200, w: 90, h: 90 },
        hotspotId: 'lr-panel-hsl',
      },
    ],
  },
  exportFigma: {
    app: 'Figma',
    mock: 'figma',
    steps: [
      {
        title: 'Select the frame or layer',
        desc: 'Tap the frame, component, or layer you want to export in the canvas or Layers panel.',
        hint: 'Frames export as whole images',
        highlight: { x: 180, y: 140, w: 200, h: 100 },
        hotspotId: 'fig-canvas',
      },
      {
        title: 'Open export settings',
        desc: 'In the right panel, scroll to the Export section. Tap the + button to add an export format.',
        hint: 'You can add multiple export settings',
        highlight: { x: 520, y: 160, w: 70, h: 32 },
        hotspotId: 'fig-export-add',
      },
      {
        title: 'Choose format and scale',
        desc: 'Select PNG, JPG, SVG, or PDF. Set scale (1x, 2x, 3x) for resolution.',
        hint: '2x or 3x for retina/high-DPI',
        highlight: { x: 500, y: 200, w: 100, h: 40 },
        hotspotId: 'fig-format',
      },
      {
        title: 'Export',
        desc: 'Tap Export [name] or the bulk Export button at the bottom. Choose save location.',
        hint: 'Tap Export to download',
        highlight: { x: 510, y: 260, w: 80, h: 36 },
        hotspotId: 'fig-export-btn',
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
        hotspotId: 'proc-brush',
      },
      {
        title: 'Create new brush',
        desc: 'Tap the + icon in the Brush Library to create a new brush.',
        hint: 'Start from a base brush you like',
        highlight: { x: 24, y: 70, w: 60, h: 36 },
        hotspotId: 'proc-new',
      },
      {
        title: 'Adjust shape and grain',
        desc: 'In Brush Studio, tap Shape and Grain to customize the brush tip.',
        hint: 'Import custom grain images',
        highlight: { x: 520, y: 100, w: 80, h: 32 },
        hotspotId: 'proc-shape',
      },
      {
        title: 'Set dynamics',
        desc: 'Tap the Dynamics section. Adjust Size, Opacity, and Flow for pressure response.',
        hint: 'Apple Pencil pressure affects stroke',
        highlight: { x: 520, y: 160, w: 80, h: 32 },
        hotspotId: 'proc-dynamics',
      },
      {
        title: 'Save and name',
        desc: 'Tap Done. Name your brush in the Brush Library.',
        hint: 'Organize brushes into sets',
        highlight: { x: 300, y: 320, w: 100, h: 36 },
        hotspotId: 'proc-done',
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
        hotspotId: 'notion-new',
      },
      {
        title: 'Add database block',
        desc: 'Type /table or /database and select Table – Inline.',
        hint: 'Database can be full-page or inline',
        highlight: { x: 180, y: 120, w: 120, h: 32 },
        hotspotId: 'notion-db',
      },
      {
        title: 'Add properties',
        desc: 'Tap + to add columns: Status, Date, Person, etc.',
        hint: 'Status is useful for PM workflows',
        highlight: { x: 480, y: 80, w: 100, h: 28 },
        hotspotId: 'notion-props',
      },
      {
        title: 'Create linked view',
        desc: 'Open database menu (⋯), choose New linked view. Pick a board or calendar.',
        hint: 'Same data, different views',
        highlight: { x: 520, y: 140, w: 80, h: 32 },
        hotspotId: 'notion-linked',
      },
      {
        title: 'Add filters',
        desc: 'Tap Filter, add conditions (e.g. Status = In progress).',
        hint: 'Filters apply to current view only',
        highlight: { x: 520, y: 200, w: 70, h: 28 },
        hotspotId: 'notion-filter',
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
        hotspotId: 'fig-canvas',
      },
      {
        title: 'Create component',
        desc: 'Tap the component icon in the toolbar.',
        hint: 'The component icon turns the selection into a reusable component',
        highlight: { x: 260, y: 14, w: 100, h: 36 },
        hotspotId: 'fig-component-tab',
      },
      {
        title: 'Add property',
        desc: 'In the right panel, under Component, tap + to add a property (e.g. State).',
        hint: 'Variant = one property with multiple values',
        highlight: { x: 520, y: 100, w: 80, h: 32 },
        hotspotId: 'fig-component-add',
      },
      {
        title: 'Create variants',
        desc: 'Add values (Default, Hover, Pressed). Figma creates a variant set.',
        hint: 'Each value = one variant',
        highlight: { x: 500, y: 160, w: 100, h: 40 },
        hotspotId: 'fig-variants',
      },
      {
        title: 'Swap instances',
        desc: 'Select an instance. In the panel, use the dropdown to swap variants.',
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
}

function HotspotButton({
  id,
  currentHotspotId,
  onStepComplete,
  children,
  className,
}: {
  id: string
  currentHotspotId?: string | undefined
  onStepComplete: () => void
  children: React.ReactNode
  className?: string
}) {
  const isTarget = currentHotspotId === id
  return (
    <button
      type="button"
      onClick={() => isTarget && onStepComplete()}
      className={`cursor-pointer touch-manipulation active:scale-95 transition-transform ${className ?? ''}`}
      aria-pressed={isTarget}
    >
      {children}
    </button>
  )
}

const TASK_LABELS: Record<string, string> = {
  removeBg: 'Remove background',
  colorGrade: 'Color grade photo',
  exportFigma: 'Export for web',
  procreateBrush: 'Create custom brush',
  notionDb: 'Create linked database view',
  figmaVariants: 'Create component variants',
}

function PhotoshopMock({ currentHotspotId, onStepComplete }: MockProps) {
  return (
    <div className="absolute inset-0 flex flex-col text-xs">
      <div className="h-9 bg-[#1e1e1e] border-b border-white/10 flex items-center px-3 gap-6 shrink-0">
        <HotspotButton id="ps-menu-file" currentHotspotId={currentHotspotId} onStepComplete={onStepComplete}>
          <span className={currentHotspotId === 'ps-menu-file' ? 'text-[#34c759] font-medium' : 'text-white/80'}>File</span>
        </HotspotButton>
        <span className="text-white/80">Edit</span>
        <HotspotButton id="ps-menu-select" currentHotspotId={currentHotspotId} onStepComplete={onStepComplete}>
          <span className={currentHotspotId === 'ps-menu-select' ? 'text-[#34c759] font-medium' : 'text-white/80'}>Select</span>
        </HotspotButton>
        <span className="text-white/80">Image</span>
        <span className="text-white/80">Layer</span>
        <span className="text-white/80">View</span>
      </div>
      <div className="flex flex-1 min-h-0">
        <div className="w-24 bg-[#252525] border-r border-white/10 p-2 space-y-2 shrink-0">
          <HotspotButton id="ps-tool-object" currentHotspotId={currentHotspotId} onStepComplete={onStepComplete}>
            <div className={`h-9 flex items-center justify-center rounded ${currentHotspotId === 'ps-tool-object' ? 'bg-[#34c759]/20 text-[#34c759]' : 'bg-white/10 text-white/70'}`}>Object</div>
          </HotspotButton>
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
          <HotspotButton id="ps-add-mask" currentHotspotId={currentHotspotId} onStepComplete={onStepComplete}>
            <div className={`h-9 flex items-center justify-center rounded text-[10px] ${currentHotspotId === 'ps-add-mask' ? 'bg-[#34c759]/30 text-[#34c759]' : 'bg-[#34c759]/20 text-[#34c759]'}`}>Add Mask</div>
          </HotspotButton>
          <div className="mt-4 text-white/50">Export</div>
          <div className="h-8 bg-white/5 rounded mt-1" />
        </div>
      </div>
    </div>
  )
}

function LightroomMock({ currentHotspotId, onStepComplete }: MockProps) {
  return (
    <div className="absolute inset-0 flex flex-col text-xs">
      <div className="h-9 bg-[#1e1e1e] border-b border-white/10 flex items-center px-3 gap-6 shrink-0">
        <span className="text-white/80">Library</span>
        <HotspotButton id="lr-tab-develop" currentHotspotId={currentHotspotId} onStepComplete={onStepComplete}>
          <span className={currentHotspotId === 'lr-tab-develop' ? 'text-[#34c759] font-medium' : 'text-white/80'}>Develop</span>
        </HotspotButton>
        <span className="text-white/80">Map</span>
        <span className="text-white/80">Book</span>
      </div>
      <div className="flex flex-1 min-h-0">
        <div className="w-28 bg-[#252525] border-r border-white/10 p-2 shrink-0">
          <div className="text-white/50 mb-1">Presets</div>
          <HotspotButton id="lr-preset" currentHotspotId={currentHotspotId} onStepComplete={onStepComplete}>
            <div className={`h-8 rounded mb-2 text-[10px] flex items-center px-2 ${currentHotspotId === 'lr-preset' ? 'bg-[#34c759]/30 text-[#34c759]' : 'bg-[#34c759]/20 text-[#34c759]'}`}>Preset 1</div>
          </HotspotButton>
          <div className="h-8 bg-white/5 rounded mb-2" />
          <div className="mt-4 text-white/50">Basic</div>
          <HotspotButton id="lr-panel-basic" currentHotspotId={currentHotspotId} onStepComplete={onStepComplete}>
            <div className={`h-20 rounded mt-1 ${currentHotspotId === 'lr-panel-basic' ? 'bg-[#34c759]/30' : 'bg-white/5'}`} />
          </HotspotButton>
          <div className="mt-2 text-white/50">HSL</div>
          <HotspotButton id="lr-panel-hsl" currentHotspotId={currentHotspotId} onStepComplete={onStepComplete}>
            <div className={`h-16 rounded mt-1 ${currentHotspotId === 'lr-panel-hsl' ? 'bg-[#34c759]/30' : 'bg-[#34c759]/20'}`} />
          </HotspotButton>
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

function FigmaMock({ currentHotspotId, onStepComplete }: MockProps) {
  return (
    <div className="absolute inset-0 flex flex-col text-xs">
      <div className="h-9 bg-[#1e1e1e] border-b border-white/10 flex items-center px-3 gap-4 shrink-0">
        <span className="text-white/80">Frame</span>
        <HotspotButton id="fig-component-tab" currentHotspotId={currentHotspotId} onStepComplete={onStepComplete}>
          <span className={currentHotspotId === 'fig-component-tab' ? 'text-[#34c759] font-medium' : 'text-white/80'}>Component</span>
        </HotspotButton>
        <span className="text-white/80">Prototype</span>
      </div>
      <div className="flex flex-1 min-h-0">
        <HotspotButton id="fig-canvas" currentHotspotId={currentHotspotId} onStepComplete={onStepComplete} className="flex-1 min-w-0 flex flex-col min-h-0">
          <div className="flex-1 p-4 bg-[#2a2a2a] min-w-0 min-h-0">
            <div className={`w-full h-full border border-dashed rounded flex items-center justify-center text-sm ${currentHotspotId === 'fig-canvas' ? 'border-[#34c759]/50 text-[#34c759]/60' : 'border-white/20 text-white/30'}`}>
              Canvas
            </div>
          </div>
        </HotspotButton>
        <div className="w-36 bg-[#252525] border-l border-white/10 p-2 shrink-0">
          <div className="text-white/50 mb-1">Design</div>
          <div className="h-6 bg-white/5 rounded mb-2" />
          <div className="text-white/50 mb-1">Export</div>
          <HotspotButton id="fig-export-add" currentHotspotId={currentHotspotId} onStepComplete={onStepComplete}>
            <div className={`h-8 rounded mb-2 text-[10px] flex items-center px-2 ${currentHotspotId === 'fig-export-add' ? 'bg-[#34c759]/30 text-[#34c759]' : 'bg-[#34c759]/20 text-[#34c759]'}`}>+ Add</div>
          </HotspotButton>
          <HotspotButton id="fig-format" currentHotspotId={currentHotspotId} onStepComplete={onStepComplete}>
            <div className={`h-8 rounded mb-4 ${currentHotspotId === 'fig-format' ? 'bg-[#34c759]/30 text-[#34c759] text-[10px] flex items-center px-2' : 'bg-white/5'}`}>PNG 2x</div>
          </HotspotButton>
          <div className="text-white/50 mb-1">Component</div>
          <HotspotButton id="fig-component-add" currentHotspotId={currentHotspotId} onStepComplete={onStepComplete}>
            <div className={`h-8 rounded mb-2 text-[10px] flex items-center px-2 ${currentHotspotId === 'fig-component-add' ? 'bg-[#34c759]/30 text-[#34c759]' : 'bg-[#34c759]/20 text-[#34c759]'}`}>+ Property</div>
          </HotspotButton>
          <HotspotButton id="fig-variants" currentHotspotId={currentHotspotId} onStepComplete={onStepComplete}>
            <div className={`h-8 rounded text-[10px] flex items-center px-2 ${currentHotspotId === 'fig-variants' ? 'bg-[#34c759]/30 text-[#34c759]' : 'bg-[#34c759]/20 text-[#34c759]'}`}>Variants</div>
          </HotspotButton>
          <HotspotButton id="fig-export-btn" currentHotspotId={currentHotspotId} onStepComplete={onStepComplete}>
            <div className={`h-9 rounded mt-2 flex items-center justify-center text-[10px] ${currentHotspotId === 'fig-export-btn' ? 'bg-[#34c759]/30 text-[#34c759]' : 'bg-[#34c759]/20 text-[#34c759]'}`}>Export</div>
          </HotspotButton>
          <HotspotButton id="fig-swap" currentHotspotId={currentHotspotId} onStepComplete={onStepComplete}>
            <div className={`h-8 rounded mt-2 text-[10px] flex items-center px-2 ${currentHotspotId === 'fig-swap' ? 'bg-[#34c759]/30 text-[#34c759]' : 'bg-white/5 text-white/70'}`}>Swap</div>
          </HotspotButton>
        </div>
      </div>
    </div>
  )
}

function ProcreateMock({ currentHotspotId, onStepComplete }: MockProps) {
  return (
    <div className="absolute inset-0 flex flex-col text-xs">
      <div className="h-10 bg-[#1e1e1e] border-b border-white/10 flex items-center justify-center gap-8 px-4 shrink-0">
        <span className="text-white/80">Actions</span>
        <HotspotButton id="proc-brush" currentHotspotId={currentHotspotId} onStepComplete={onStepComplete}>
          <span className={currentHotspotId === 'proc-brush' ? 'text-[#34c759] font-medium' : 'text-white/80'}>Brush</span>
        </HotspotButton>
        <span className="text-white/80">Eraser</span>
        <span className="text-white/80">Layers</span>
      </div>
      <div className="flex flex-1 min-h-0">
        <div className="w-20 bg-[#252525] border-r border-white/10 p-2 shrink-0">
          <HotspotButton id="proc-new" currentHotspotId={currentHotspotId} onStepComplete={onStepComplete}>
            <div className={`h-10 rounded mb-2 text-[9px] flex items-center justify-center ${currentHotspotId === 'proc-new' ? 'bg-[#34c759]/30 text-[#34c759]' : 'bg-[#34c759]/20 text-[#34c759]'}`}>+ New</div>
          </HotspotButton>
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
          <HotspotButton id="proc-shape" currentHotspotId={currentHotspotId} onStepComplete={onStepComplete}>
            <div className={`h-8 rounded mb-2 text-[9px] flex items-center px-1 ${currentHotspotId === 'proc-shape' ? 'bg-[#34c759]/30 text-[#34c759]' : 'bg-[#34c759]/20 text-[#34c759]'}`}>Shape</div>
          </HotspotButton>
          <HotspotButton id="proc-dynamics" currentHotspotId={currentHotspotId} onStepComplete={onStepComplete}>
            <div className={`h-8 rounded mb-2 text-[9px] flex items-center px-1 ${currentHotspotId === 'proc-dynamics' ? 'bg-[#34c759]/30 text-[#34c759]' : 'bg-[#34c759]/20 text-[#34c759]'}`}>Dynamics</div>
          </HotspotButton>
          <div className="h-8 bg-white/5 rounded mb-4" />
          <HotspotButton id="proc-done" currentHotspotId={currentHotspotId} onStepComplete={onStepComplete}>
            <div className={`h-10 rounded flex items-center justify-center text-[9px] ${currentHotspotId === 'proc-done' ? 'bg-[#34c759]/30 text-[#34c759]' : 'bg-[#34c759]/20 text-[#34c759]'}`}>Done</div>
          </HotspotButton>
        </div>
      </div>
    </div>
  )
}

function NotionMock({ currentHotspotId, onStepComplete }: MockProps) {
  return (
    <div className="absolute inset-0 flex flex-col text-xs">
      <div className="h-9 bg-[#1e1e1e] border-b border-white/10 flex items-center px-3 shrink-0">
        <HotspotButton id="notion-new" currentHotspotId={currentHotspotId} onStepComplete={onStepComplete}>
          <span className={currentHotspotId === 'notion-new' ? 'text-[#34c759] font-medium' : 'text-white/80'}>+ New page</span>
        </HotspotButton>
      </div>
      <div className="flex flex-1 min-h-0">
        <div className="w-28 bg-[#252525] border-r border-white/10 p-2 shrink-0">
          <HotspotButton id="notion-new" currentHotspotId={currentHotspotId} onStepComplete={onStepComplete}>
            <div className={`h-9 rounded mb-2 text-[9px] flex items-center px-2 ${currentHotspotId === 'notion-new' ? 'bg-[#34c759]/30 text-[#34c759]' : 'bg-[#34c759]/20 text-[#34c759]'}`}>+ Add</div>
          </HotspotButton>
          <div className="h-8 bg-white/5 rounded mb-2" />
          <div className="h-8 bg-white/5 rounded" />
        </div>
        <div className="flex-1 p-4 bg-[#2a2a2a] min-w-0">
          <HotspotButton id="notion-db" currentHotspotId={currentHotspotId} onStepComplete={onStepComplete}>
            <div className={`h-8 rounded mb-2 w-32 ${currentHotspotId === 'notion-db' ? 'bg-[#34c759]/30' : 'bg-[#34c759]/20'}`} />
          </HotspotButton>
          <div className="h-24 bg-white/5 rounded mb-2" />
          <div className="text-white/50 text-[10px]">/table or /database</div>
        </div>
        <div className="w-32 bg-[#252525] border-l border-white/10 p-2 shrink-0">
          <div className="text-white/50 mb-1">Properties</div>
          <HotspotButton id="notion-props" currentHotspotId={currentHotspotId} onStepComplete={onStepComplete}>
            <div className={`h-7 rounded mb-2 text-[9px] flex items-center px-2 ${currentHotspotId === 'notion-props' ? 'bg-[#34c759]/30 text-[#34c759]' : 'bg-[#34c759]/20 text-[#34c759]'}`}>+ Add</div>
          </HotspotButton>
          <div className="text-white/50 mb-1">View</div>
          <HotspotButton id="notion-linked" currentHotspotId={currentHotspotId} onStepComplete={onStepComplete}>
            <div className={`h-8 rounded mb-2 text-[9px] flex items-center px-2 ${currentHotspotId === 'notion-linked' ? 'bg-[#34c759]/30 text-[#34c759]' : 'bg-[#34c759]/20 text-[#34c759]'}`}>Linked</div>
          </HotspotButton>
          <HotspotButton id="notion-filter" currentHotspotId={currentHotspotId} onStepComplete={onStepComplete}>
            <div className={`h-7 rounded text-[9px] flex items-center px-2 ${currentHotspotId === 'notion-filter' ? 'bg-[#34c759]/30 text-[#34c759]' : 'bg-[#34c759]/20 text-[#34c759]'}`}>Filter</div>
          </HotspotButton>
        </div>
      </div>
    </div>
  )
}

const MOCK_COMPONENTS: Record<string, (props: MockProps) => React.ReactNode> = {
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
          <span className="text-xs text-gray-500">iPad / tablet</span>
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
                  {showHighlight && (
                    <p className="mb-3 text-sm text-gray-400">
                      Tap the red circle in the app to complete this step
                    </p>
                  )}
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

        {/* Mock app preview - fills remaining space */}
        <div className="flex-1 min-w-0 min-h-0 flex flex-col">
          <div className="flex-1 min-h-0 relative bg-[#2d2d2d] rounded-xl border border-white/10 overflow-hidden">
            {MockComponent && <MockComponent {...(phase === 'steps' && step?.hotspotId ? { currentHotspotId: step.hotspotId } : {})} onStepComplete={handleNext} />}
            {phase === 'steps' && showHighlight && step && (
              <button
                type="button"
                onClick={handleNext}
                className="absolute rounded-full border-[3px] border-red-500 z-10 cursor-pointer hover:border-red-400 hover:bg-red-500/10 transition-colors focus:outline-none focus:ring-2 focus:ring-red-500/50"
                style={{
                  left: `${(step.highlight.x / 600) * 100}%`,
                  top: `${(step.highlight.y / 400) * 100}%`,
                  width: `${(step.highlight.w / 600) * 100}%`,
                  height: `${(step.highlight.h / 400) * 100}%`,
                }}
                aria-label={`Tap to complete: ${step.title}`}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
