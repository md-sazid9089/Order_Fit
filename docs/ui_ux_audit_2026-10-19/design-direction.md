# OrderFit design direction (Phase 5C)

Status: adopted for the fix phase on `ui-release-2026-10-19`. This refines the incumbent visual world; it does not replace it. Product rules in `PRODUCT.md` take precedence.

## Position

OrderFit is a calm ledger, not a dashboard toy. The owner should see the decision, the cash number and the next action without reading. Brand lives in a few precise details: pine green for the single primary action, stone and eggshell surfaces, tabular figures, and honest status language. Everything else is quiet.

Mode by surface:

| Surface | Mode | Consequence |
|---|---|---|
| Landing (`/`) | Persuade | Expressive type and motion are allowed; every claim must be true and every sample labelled as an example. |
| Auth (`/auth/*`) | Operate | One task per screen, centred card, no decoration. |
| Workspace and order workflow | Operate | Scanability and consistency outrank expression. No scroll-jacking, no decorative motion. |
| Platform admin (`/admin/*`) | Operate | Same system as the workspace, denser tables. |

## Foundations

### Color tokens (CSS variables in `web/app/globals.css`, exposed to Tailwind via `@theme inline`)

| Token | Light | Dark | Use |
|---|---|---|---|
| `background` | `#F7F6F5` stone | `#141617` | Page canvas |
| `surface` / `card` | `#FFFFFF` | `#1C1F20` | Panels, tables, inputs |
| `foreground` | `#1A1A1A` | `#F3F4F6` | Body text |
| `muted-foreground` | `#5A6B73` | `#A9B1B4` | Secondary text (≥ 4.5:1 on surface and background) |
| `border` | `#E5E2DC` | `#2C3031` | Hairlines |
| `border-strong` | `#C9C4BA` | `#454B4D` | Input borders, hover |
| `primary` | `#004D3B` pine | `#7FD1B0` | The one primary action per view, links, selected state |
| `primary-foreground` | `#FFFAEC` | `#102B22` | Text on primary |
| `ring` | `#004D3B` | `#7FD1B0` | Focus ring (≥ 3:1 against both surfaces) |
| `muted` | `#F0EEEA` | `#24282A` | Hover fills, segmented controls |
| `success` / `success-soft` | `#1F7A4D` / `#E8F5EE` | `#5CC28E` / `#13291E` | Feasible, completed |
| `warning` / `warning-soft` | `#A15C07` / `#FFF4E0` | `#F0B45A` / `#2E2210` | Needs review, stale |
| `danger` / `danger-soft` | `#B42318` / `#FDECEA` | `#F2877C` / `#33171A` | Infeasible, failed, destructive |
| `info` / `info-soft` | `#1D5C8C` / `#EAF2F9` | `#7DB7E6` / `#13222F` | Neutral system notices, sandbox |

Verdicts map onto semantic colors and always carry a text label and an icon, never color alone: feasible → success, needs changes → warning, infeasible/decline → danger, not evaluated/stale → neutral or warning. The same verdict looks identical on the pipeline, detail, decision guide and approvals.

Raw hex literals in components are migrated to these tokens. Brand constants (`brand-pine-green`, `brand-eggshell`, `brand-mint`) stay available for the landing page only.

### Typography

- One family for the product: **IBM Plex Sans** (UI), with **IBM Plex Mono** only for identifiers, hashes and code. Money uses Plex Sans with `font-variant-numeric: tabular-nums` (`.tabular`), right-aligned in tables.
- The landing page may use **Instrument Serif** italic for its single accent phrase. Playfair Display is not loaded unless used.
- Scale (rem / px): 0.75/12 caption · 0.875/14 body-sm and controls · 1/16 body · 1.125/18 section title · 1.5/24 page title · 2/32 display (workspace KPIs) · landing hero up to 4.5/72. Nothing below 12 px. Weights 400, 500, 600 only (700 for the landing hero).
- No uppercase micro-labels with wide tracking as decoration. Labels are sentence case.

### Spacing, layout, radius, elevation

- 4-pt grid; component padding 12/16/20; section gaps 24/32.
- Page gutter: 16 px (< 640), 24 px (≥ 640), 32 px (≥ 1024). Content max width 1200 px for reading pages and forms, 1440 px for tables and dashboards.
- Radius: 8 px controls, 12 px panels, 9999 px pills. Never nest a radiused card inside another card; use dividers inside a panel.
- Elevation: panels are flat with a hairline border; only menus, dialogs and the sticky header use a soft offset shadow.

### Motion

- Product screens: 150–200 ms ease-out on hover, focus and disclosure; no scroll-jacking (Lenis is removed from authenticated routes), no entrance animations on data.
- `prefers-reduced-motion: reduce` disables marquee, parallax and any non-essential transition everywhere.

## Components (built on `web/components/ui/*`)

| Role | Canonical | Notes |
|---|---|---|
| Page header | `PageHeader` (title, description, actions, optional back link) | One `<h1>` per page; the app bar shows a non-heading location label. |
| Panel | `Panel` (`section` with title, description, actions, body) | Replaces ad-hoc `rounded-2xl border bg-white p-5`. |
| Stat tile | `StatTile` (label, value, caption, status) | Value at 24–28 px tabular; never wraps a status sentence at display size. |
| Button | `ui/button.tsx` with fixed tokens: `default` (primary), `outline`, `ghost`, `destructive`, `link`; sizes `sm` 32 px, `default` 40 px, `lg` 44 px | Loading state shows a spinner and a verb ("Saving…"). |
| Field | `Field` (label, control, hint, error with `aria-describedby`) | Money fields accept major units and send minor-unit strings. |
| Status | `StatusBadge` (tone + label + optional icon) | Verdicts, workflow state, operation state. |
| Alerts | `InlineAlert` (tone, title, body, action); `role="alert"` for failures, `role="status"` for notices | Toasts only supplement. |
| Empty / error | `EmptyState`, `ErrorState` (with retry and request reference) | An error is never rendered as empty. |

## Page templates

1. **List page**: `PageHeader` with the primary create action → filters → table (desktop) / card list (< 768 px) → pagination.
2. **Record page**: `PageHeader` with record title as `<h1>`, status badges and the one primary action → summary panel → secondary actions in an overflow row → sections.
3. **Form/settings page**: `PageHeader` → stacked `Panel`s, single column on phones, max 720 px.
4. **Workflow page**: record header + a compact journey indicator (Enter → Review → Evaluate → Negotiate → Approve) that reflects real state, never a fixed step number.
5. **Auth page**: centred card, 400 px.
6. **Admin page**: same shell and templates as the workspace.

## Migration order

1. Tokens, base styles, focus, tabular numerals (`globals.css`) — every page benefits.
2. Shared primitives (`PageHeader`, `Panel`, `StatTile`, `InlineAlert`, `EmptyState`, `ErrorState`, `StatusBadge`, `Field`, money input/format).
3. App shell (header, sidebar, mobile drawer) and the order-workflow journey indicator.
4. Highest-traffic pages: pipeline, order detail, new order, overview.
5. Remaining workspace pages, then admin, then auth and landing polish.
