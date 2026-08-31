# Design System & Aesthetics

## Tokens & Color Palette (`src/styles/tokens.css`)
- **Typeface:** `Inter` (Variable, sans-serif) + `Geist Mono` (tabular data)
- **Numerals:** `tabular-nums` class on all numbers, tables, and financial metrics.
- **Surface & Elevation Tiers:**
  - Canvas / Ambient Background: `--bg: #0b0c0e` (`bg-slate-950`)
  - Primary Surfaces / Panels: `--surface-1: #141519` (`bg-slate-900`)
  - Elevated Cards / Form Inputs: `--surface-2: #1b1d23` (`bg-slate-800/50`)
  - Floating Modals / Dropdowns: `--surface-3: #22252c` (`bg-slate-800/80`)
- **Borders & Dividers:** `--border: rgba(255, 255, 255, 0.08)` (`border-slate-700`)
- **Typography Scale:**
  - Primary Text: `--text-1: #f9fafb`
  - Secondary Text: `--text-2: #d1d5db`
  - Muted Text: `--text-3: #9ca3af`
- **Radii:**
  - Controls & Buttons: `--radius-control: 8px` (`rounded-lg`)
  - Panels & Cards: `--radius-card: 12px` (`rounded-xl`)
  - Badges & Pills: `--radius-pill: 999px` (`rounded-full`)
  - Shopfloor Kiosk Touch Targets: `rounded-2xl` / `rounded-3xl`
- **Shadows:** Soft ambient glows (`shadow-subtle`, `shadow-modal`).
- **Transitions:** Standardized 150ms transitions (`transition-all duration-150`).

## Component Kit
- **Buttons:** Solid, ghost, and outline variants. Disabled states must reduce opacity to 50%.
- **Pills / Badges:** Status indicators use soft backgrounds with bright text (e.g., `bg-emerald-950/50 text-emerald-400`).
- **KPI Cards:** Large numeric value (tabular-nums), subtle icon in top right, trend indicator at the bottom.
- **Tables:** Fixed headers, striped rows, mono-spaced data columns, right-aligned numbers.
- **Modals:** Backdrop blur, fixed max-width, center aligned, click-outside to close.
- **Skeletons:** Pulse animations mirroring the exact layout of the expected component.

## Status Color Semantics
- **Success / Completed / Active:** Emerald (`--success: #10b981`)
- **Pending / In Progress / Warning:** Amber (`--warning: #f59e0b`)
- **Error / Rejected / Overdue / Scrap:** Rose (`--danger: #ef4444`)
- **Draft / Planned / Neutral:** Slate/Gray
- **Information / Primary Actions:** Blue/Cyan (`--info: #3b82f6`)

## Page Header Pattern
- Standardized layout: Breadcrumbs top left, `h1` Title, secondary description.
- Action buttons top right.

## Operator Terminal Big-Touch Rule
- The shop floor application (`/terminal`) is used on tablets.
- **Rule:** ALL interactive elements (buttons, rows, selects) MUST have a minimum height and width of `48px` to ensure touch reliability.
- **Typography on Terminal:** Minimum `text-sm`, preferring `text-lg` or `text-xl` for primary actions.
