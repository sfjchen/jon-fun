export type EayQuestion = { id: string; template: string }

/** Placeholder {name} filled with subject display name at runtime. */
export const EAY_INTAKE_QUESTIONS: EayQuestion[] = [
  { id: 'q1', template: 'A movie {name} secretly loves' },
  { id: 'q2', template: 'The snack {name} would pick at midnight' },
  { id: 'q3', template: 'Something {name} would never admit in public' },
]
