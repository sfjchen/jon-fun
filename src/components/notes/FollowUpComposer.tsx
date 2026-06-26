'use client'

type FollowUpComposerProps = {
  onSubmit: (question: string) => void
  lookupId?: string
}

export default function FollowUpComposer({ onSubmit, lookupId }: FollowUpComposerProps) {
  const inputTestId = lookupId ? `notes-followup-input-${lookupId}` : 'notes-followup-input'
  return (
    <form
      className="mt-2"
      data-testid={lookupId ? `notes-followup-form-${lookupId}` : 'notes-followup-form'}
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
        data-testid={inputTestId}
        className="w-full rounded border border-[var(--uv-border)] bg-[var(--uv-bg-elevated)] px-2 py-1.5 text-sm text-[var(--uv-text-primary)] placeholder:text-[var(--uv-text-muted)] focus:border-[var(--uv-accent)] focus:outline-none"
      />
    </form>
  )
}
