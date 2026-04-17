'use client'

import type { ReaderAccent, ReaderFontPreset, ReaderPreferences, ReaderTheme, ReaderTextAlign } from '@/lib/reader/types'

type VoiceOption = {
  label: string
  value: string
}

type SettingsDrawerProps = {
  open: boolean
  mobile: boolean
  prefs: ReaderPreferences
  voiceOptions: VoiceOption[]
  isSpeaking: boolean
  canGoPrev: boolean
  canGoNext: boolean
  onClose: () => void
  onChange: <K extends keyof ReaderPreferences>(key: K, value: ReaderPreferences[K]) => void
  onGoPrev: () => void
  onGoNext: () => void
  onSaveBookmark: () => void
  onJumpToBookmark: () => void
  hasBookmark: boolean
  onToggleSpeak: () => void
  onReset: () => void
}

const fontPresets: Array<{ id: ReaderFontPreset; label: string }> = [
  { id: 'default', label: 'Default' },
  { id: 'accessible', label: 'Accessible' },
  { id: 'roboto', label: 'Roboto' },
  { id: 'lora', label: 'Lora' },
]

const themes: Array<{ id: ReaderTheme; label: string }> = [
  { id: 'paper', label: 'Paper' },
  { id: 'sepia', label: 'Sepia' },
  { id: 'night', label: 'Night' },
  { id: 'midnight', label: 'Midnight' },
]

const accents: Array<{ id: ReaderAccent; label: string; color: string }> = [
  { id: 'sky', label: 'Sky', color: '#2f81f7' },
  { id: 'emerald', label: 'Emerald', color: '#0f9f6e' },
  { id: 'violet', label: 'Violet', color: '#805ad5' },
  { id: 'amber', label: 'Amber', color: '#d97706' },
  { id: 'rose', label: 'Rose', color: '#e11d48' },
]

const alignments: Array<{ id: ReaderTextAlign; label: string }> = [
  { id: 'left', label: 'Left' },
  { id: 'right', label: 'Right' },
  { id: 'justify', label: 'Justify' },
  { id: 'center', label: 'Center' },
]

function Toggle({
  checked,
  label,
  onChange,
}: {
  checked: boolean
  label: string
  onChange: (next: boolean) => void
}) {
  return (
    <label className="flex items-center justify-between gap-3 rounded-xl border px-3 py-2" style={{ borderColor: 'var(--ink-border)' }}>
      <span className="text-sm">{label}</span>
      <button
        type="button"
        className="reader-focus relative h-7 w-12 rounded-full transition-colors"
        style={{ backgroundColor: checked ? 'var(--ink-accent)' : 'var(--ink-bg)' }}
        onClick={() => onChange(!checked)}
        aria-pressed={checked}
      >
        <span
          className="absolute top-1 h-5 w-5 rounded-full bg-white transition-transform"
          style={{ left: checked ? 'calc(100% - 1.5rem)' : '0.25rem' }}
        />
      </button>
    </label>
  )
}

export function SettingsDrawer({
  open,
  mobile,
  prefs,
  voiceOptions,
  isSpeaking,
  canGoPrev,
  canGoNext,
  onClose,
  onChange,
  onGoPrev,
  onGoNext,
  onSaveBookmark,
  onJumpToBookmark,
  hasBookmark,
  onToggleSpeak,
  onReset,
}: SettingsDrawerProps) {
  if (!open) return null

  const panel = (
    <aside
      className={`e-reader-chrome-panel e-reader-chrome-scrollbar ${mobile ? 'h-full w-full max-w-md overflow-y-auto rounded-l-3xl p-5' : 'sticky top-6 w-[340px] shrink-0 overflow-y-auto rounded-3xl p-5'}`}
      aria-label="Reader settings"
    >
      <div className="mb-5 flex items-center justify-between gap-3">
        <div>
          <p className="e-reader-chrome-muted text-xs uppercase tracking-[0.24em]">Reader settings</p>
          <h2 className="text-lg font-semibold">Customize your reading view</h2>
        </div>
        <button type="button" onClick={onClose} className="e-reader-chrome-chip reader-focus rounded-full px-3 py-1.5 text-sm">
          Close
        </button>
      </div>

      <div className="mb-5 grid grid-cols-3 gap-2">
        <button type="button" onClick={onGoPrev} disabled={!canGoPrev} className="e-reader-chrome-chip reader-focus rounded-xl px-3 py-2 text-sm disabled:opacity-40">
          Prev
        </button>
        <button type="button" onClick={hasBookmark ? onJumpToBookmark : onSaveBookmark} className="e-reader-chrome-chip reader-focus rounded-xl px-3 py-2 text-sm">
          {hasBookmark ? 'Bookmark' : 'Save spot'}
        </button>
        <button type="button" onClick={onGoNext} disabled={!canGoNext} className="e-reader-chrome-chip reader-focus rounded-xl px-3 py-2 text-sm disabled:opacity-40">
          Next
        </button>
      </div>

      <section className="mb-5">
        <h3 className="mb-2 text-sm font-semibold">Font family</h3>
        <div className="grid grid-cols-2 gap-2">
          {fontPresets.map((preset) => (
            <button
              key={preset.id}
              type="button"
              className="e-reader-chrome-chip reader-focus rounded-xl px-3 py-2 text-sm"
              data-active={prefs.fontPreset === preset.id}
              onClick={() => onChange('fontPreset', preset.id)}
            >
              {preset.label}
            </button>
          ))}
        </div>
      </section>

      <section className="mb-5 space-y-3">
        <h3 className="text-sm font-semibold">Type scale</h3>
        <label className="block">
          <div className="mb-1 flex items-center justify-between text-sm">
            <span>Font size</span>
            <span className="e-reader-chrome-muted">{prefs.fontSize}px</span>
          </div>
          <input
            className="e-reader-chrome-slider w-full"
            type="range"
            min={14}
            max={34}
            step={1}
            value={prefs.fontSize}
            onChange={(event) => onChange('fontSize', Number(event.target.value))}
          />
        </label>
        <label className="block">
          <div className="mb-1 flex items-center justify-between text-sm">
            <span>Line height</span>
            <span className="e-reader-chrome-muted">{prefs.lineHeight.toFixed(2)}</span>
          </div>
          <input
            className="e-reader-chrome-slider w-full"
            type="range"
            min={1.3}
            max={2.1}
            step={0.05}
            value={prefs.lineHeight}
            onChange={(event) => onChange('lineHeight', Number(event.target.value))}
          />
        </label>
        <label className="block">
          <div className="mb-1 flex items-center justify-between text-sm">
            <span>Paragraph gap</span>
            <span className="e-reader-chrome-muted">{prefs.paragraphGap}px</span>
          </div>
          <input
            className="e-reader-chrome-slider w-full"
            type="range"
            min={8}
            max={40}
            step={2}
            value={prefs.paragraphGap}
            onChange={(event) => onChange('paragraphGap', Number(event.target.value))}
          />
        </label>
        <label className="block">
          <div className="mb-1 flex items-center justify-between text-sm">
            <span>Page width</span>
            <span className="e-reader-chrome-muted">{prefs.maxWidth}px</span>
          </div>
          <input
            className="e-reader-chrome-slider w-full"
            type="range"
            min={560}
            max={1080}
            step={20}
            value={prefs.maxWidth}
            onChange={(event) => onChange('maxWidth', Number(event.target.value))}
          />
        </label>
      </section>

      <section className="mb-5">
        <h3 className="mb-2 text-sm font-semibold">Alignment</h3>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {alignments.map((alignment) => (
            <button
              key={alignment.id}
              type="button"
              className="e-reader-chrome-chip reader-focus rounded-xl px-3 py-2 text-sm"
              data-active={prefs.textAlign === alignment.id}
              onClick={() => onChange('textAlign', alignment.id)}
            >
              {alignment.label}
            </button>
          ))}
        </div>
      </section>

      <section className="mb-5 space-y-2">
        <h3 className="text-sm font-semibold">Reading helpers</h3>
        <Toggle checked={prefs.textIndent} label="Text indent" onChange={(next) => onChange('textIndent', next)} />
        <Toggle checked={prefs.bionic} label="Bionic reading" onChange={(next) => onChange('bionic', next)} />
        <Toggle checked={prefs.copyEnabled} label="Copy text" onChange={(next) => onChange('copyEnabled', next)} />
      </section>

      <section className="mb-5">
        <h3 className="mb-2 text-sm font-semibold">Theme</h3>
        <div className="grid grid-cols-2 gap-2">
          {themes.map((theme) => (
            <button
              key={theme.id}
              type="button"
              className="e-reader-chrome-chip reader-focus rounded-xl px-3 py-2 text-sm"
              data-active={prefs.theme === theme.id}
              onClick={() => onChange('theme', theme.id)}
            >
              {theme.label}
            </button>
          ))}
        </div>
      </section>

      <section className="mb-5">
        <h3 className="mb-2 text-sm font-semibold">Accent</h3>
        <div className="flex flex-wrap gap-2">
          {accents.map((accent) => (
            <button
              key={accent.id}
              type="button"
              className="reader-focus flex items-center gap-2 rounded-full border px-3 py-2 text-sm"
              style={{
                borderColor: prefs.accent === accent.id ? accent.color : 'var(--ink-border)',
                backgroundColor: prefs.accent === accent.id ? `${accent.color}22` : 'var(--ink-bg)',
              }}
              onClick={() => onChange('accent', accent.id)}
            >
              <span className="h-3 w-3 rounded-full" style={{ backgroundColor: accent.color }} />
              {accent.label}
            </button>
          ))}
        </div>
      </section>

      <section className="mb-5 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">Text to speech</h3>
          <button type="button" onClick={onToggleSpeak} className="e-reader-chrome-action reader-focus rounded-xl px-3 py-2 text-sm">
            {isSpeaking ? 'Stop' : 'Play'}
          </button>
        </div>
        <label className="block">
          <div className="mb-1 flex items-center justify-between text-sm">
            <span>Rate</span>
            <span className="e-reader-chrome-muted">{prefs.ttsRate.toFixed(1)}x</span>
          </div>
          <input
            className="e-reader-chrome-slider w-full"
            type="range"
            min={0.7}
            max={1.6}
            step={0.1}
            value={prefs.ttsRate}
            onChange={(event) => onChange('ttsRate', Number(event.target.value))}
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block">Voice</span>
          <select
            className="e-reader-chrome-input reader-focus w-full rounded-xl border px-3 py-2"
            value={prefs.voiceURI}
            onChange={(event) => onChange('voiceURI', event.target.value)}
          >
            <option value="">System default</option>
            {voiceOptions.map((voice) => (
              <option key={voice.value} value={voice.value}>
                {voice.label}
              </option>
            ))}
          </select>
        </label>
      </section>

      <section className="mb-5 space-y-2">
        <h3 className="text-sm font-semibold">Automation</h3>
        <Toggle checked={prefs.autoScrollEnabled} label="Auto scroll" onChange={(next) => onChange('autoScrollEnabled', next)} />
        <Toggle checked={prefs.autoNextChapter} label="Auto next chapter" onChange={(next) => onChange('autoNextChapter', next)} />
        <label className="block">
          <div className="mb-1 flex items-center justify-between text-sm">
            <span>Scroll speed</span>
            <span className="e-reader-chrome-muted">{prefs.autoScrollSpeed.toFixed(1)}</span>
          </div>
          <input
            className="e-reader-chrome-slider w-full"
            type="range"
            min={0.6}
            max={4}
            step={0.2}
            value={prefs.autoScrollSpeed}
            onChange={(event) => onChange('autoScrollSpeed', Number(event.target.value))}
          />
        </label>
      </section>

      <button type="button" onClick={onReset} className="e-reader-chrome-action reader-focus w-full rounded-xl px-4 py-3 text-sm font-semibold">
        Reset to defaults
      </button>
    </aside>
  )

  if (!mobile) return panel

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/35 p-3 sm:p-4">
      {panel}
    </div>
  )
}
