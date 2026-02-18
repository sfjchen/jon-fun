# Figma Prototype Spec — Pear AI Step Navigator (Extra Credit)

Use this spec to build the Figma interactive prototype for the MVP presentation.

## Frame size

**768 × 1024 px** (PearPad tablet portrait)

## Screens to design

### 1. Intent / task selection
- Header: "PearNavigator" (or Pear logo + product name)
- Title: "What do you want to do?"
- Subtitle: "Tell Pear Navigator your goal"
- 3 task cards (tappable):
  - Photoshop: Remove background
  - Lightroom: Color grade photo
  - Figma: Export for web
- Primary button: "Start guide" (disabled until a task is selected)

### 2. Step screens (repeat for each step)
- Step indicator: "Step X of 4"
- Step title (e.g., "Select the subject")
- Step description (1–2 sentences)
- Hint box (green tint): keyboard shortcut or tip
- Button: "Next step" (or "Done" on last step)

### 3. Completion
- Checkmark icon
- "Task complete"
- Short summary
- "Start over" button

## Prototype connections

| From | Interaction | To |
|------|-------------|-----|
| Task selection | Tap task card | (Visual: card selected) |
| Task selection | Tap "Start guide" | Step 1 |
| Step N | Tap "Next step" | Step N+1 |
| Step 4 | Tap "Done" | Completion |
| Completion | Tap "Start over" | Task selection |

## Visual style

- Dark theme (background ~#0d0d0d to #1a1a1a)
- Accent: #34c759 (Pear green)
- Font: Inter or SF Pro
- Cards: rounded (16px), subtle border

## Optional: companion layout

Create a second frame showing:
- Left: Mock screenshot of Photoshop/Figma/Lightroom
- Right: Tablet frame with current step

Use this in the video to show "companion mode" (tablet beside laptop).
