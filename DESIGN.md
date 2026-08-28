# Design System & Aesthetics

## Tokens & Typography
- **Typeface:** `Inter` (sans-serif)
- **Numerals:** `tabular-nums` class on all numbers, tables, and financial metrics.
- **Elevations (Zinc Tiers):**
  - Backgrounds: `bg-slate-950`
  - Cards / Panels: `bg-slate-900`
  - Hover states: `bg-slate-800`
- **Radii:** `rounded-xl` for cards, `rounded-lg` for inputs/buttons, `rounded-2xl` for terminal items.
- **Shadows:** Standardized soft glows (`shadow-blue-500/20`) for active states.
- **Transitions:** Hard rule of 150ms (`transition-all duration-150`).

## Component Kit
- **Buttons:** Solid, ghost, and outline variants. Disabled states must reduce opacity to 50%.
- **Pills / Badges:** Status indicators use soft backgrounds with bright text (e.g., `bg-emerald-950/50 text-emerald-400`).
- **KPI Cards:** Large numeric value (tabular-nums), subtle icon in top right, trend indicator at the bottom.
- **Tables:** Fixed headers, striped rows, mono-spaced data columns, right-aligned numbers.
- **Modals:** Backdrop blur, fixed max-width, center aligned, click-outside to close.
- **Skeletons:** Pulse animations mirroring the exact layout of the expected component.

## Status Color Semantics
- **Success / Completed / Active:** Emerald/Green
- **Pending / In Progress / Warning:** Amber/Yellow
- **Error / Rejected / Overdue / Scrap:** Rose/Red
- **Draft / Planned / Neutral:** Slate/Gray
- **Information / Primary Actions:** Blue/Cyan

## Page Header Pattern
- Standardized layout: Breadcrumbs top left, `h1` Title, secondary description.
- Action buttons top right.

## Operator Terminal Big-Touch Rule
- The shop floor application (`/terminal`) is used on tablets.
- **Rule:** ALL interactive elements (buttons, rows, selects) MUST have a minimum height and width of `48px` to ensure touch reliability.
- **Typography on Terminal:** Minimum `text-sm`, preferring `text-lg` or `text-xl` for primary actions.
