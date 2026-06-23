'use client'

type FollowUpComposerProps = {
  onSubmit: (question: string) => void
}

export default function FollowUpComposer({ onSubmit }: FollowUpComposerProps) {
  return (
    <form
      className="mt-2"
      data-testid="notes-followup-form"
      onSubmit={(e) => {
        e.preventDefault()
        const fd = new FormData(e.currentTarget)
        const q = String(fd.get('followup') ?? '').trim()
        if (!q) return
        onSubmit(q)
        e.currentTarget.reset()
      }}
    >
      <input
        name="followup"
        placeholder="Follow up ↵"
        data-testid="notes-followup-input"
        className="w-full rounded border border-[var(--uv-border)] bg-[var(--uv-bg-elevated)] px-2 py-1.5 text-sm text-[var(--uv-text-primary)] placeholder:text-[var(--uv-text-muted)] focus:border-[var(--uv-accent)] focus:outline-none"
      />
    </form>
  )
}
