# Responsive UX/UI Best Practices

Guidance for demos and interfaces across mobile (especially iPhone), narrow laptop, and wide laptop screens.

---

## 1. Breakpoints & Layout Strategy

| Breakpoint | Width | Typical devices |
|------------|-------|-----------------|
| default | <640px | iPhone SE, small phones |
| sm | 640px | iPhone 14/15, larger phones |
| md | 768px | iPad mini portrait |
| lg | 1024px | iPad, narrow laptop |
| xl | 1280px | Standard laptop |
| 2xl | 1536px+ | Wide monitors |

**How it's usually done best:**
- **Mobile-first**: Design smallest first, add complexity with `sm:`, `md:`, `lg:`.
- **Content prioritization**: On mobile, stack vertically; on lg+, use side-by-side.
- **Flexible containers**: Use `flex-1 min-w-0` for flex children so they shrink instead of overflowing.

---

## 2. Viewport Units (Mobile Safari Fix)

**Problem:** `100vh` breaks on iPhone—address bar collapse causes layout jumps.

**Best practice:** Use `100dvh` (dynamic viewport) with `100vh` fallback:

```css
min-height: calc(100vh - 5rem);   /* fallback */
min-height: calc(100dvh - 5rem);   /* modern browsers */
```

- **dvh**: Adjusts when browser UI expands/collapses; use for main containers.
- **svh**: Smallest viewport; use for hero/login so content isn't hidden.
- **lvh**: Largest viewport; use for immersive full-screen content.

---

## 3. Safe Areas (iPhone Notch & Home Indicator)

**Best practice:** Add `env(safe-area-inset-*)` for fixed/absolute elements near edges:

```css
padding-bottom: env(safe-area-inset-bottom);
padding-left: env(safe-area-inset-left);
```

Ensure `viewport-fit=cover` in meta if using full-bleed:

```html
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
```

---

## 4. Touch Targets

**iOS HIG / WCAG 2.2:** Minimum 44×44pt (px) for tap targets.

**In Tailwind:** `min-h-11 min-w-11` (44px) for buttons. Add `touch-manipulation` to remove 300ms tap delay.

---

## 5. Split Panels (Guide + Demo)

**Mobile:** Vertical stack. Cap guide height (e.g. `max-h-[42vh]`) so demo gets usable space. Use `overflow-y-auto` on both panels.

**Narrow laptop (lg):** Side-by-side. Guide fixed width (`lg:w-80`), demo fills remainder with `flex-1 min-w-0`.

**Wide laptop:** Same; optionally grow guide (`xl:w-96`, `2xl:w-[28rem]`) for readability.

---

## 6. Typography Scaling

- Use `text-base sm:text-lg` for body; avoid tiny text on mobile.
- `truncate` for long labels; `title` attribute for tooltip on hover.

---

## 7. Fixed Toasts / Overlays

Place above `env(safe-area-inset-bottom)` on iPhone:

```css
bottom: calc(2rem + env(safe-area-inset-bottom));
```

---

## 8. Considerations for Pear Navigator Specifically

- **Guide panel:** Scrollable; max height on mobile so simulator is visible.
- **Simulator frame:** Responsive border (`border-4 sm:border-6 md:border-8`); inner padding scales.
- **Hotspots:** Already `min-h-11`; keep touch-manipulation.
- **Demo min-height:** Use `min-h-[min(40vh,320px)]` so both panels fit on ~667px iPhone.
