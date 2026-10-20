# OrderFit web design-system census (2026-10-19)

Read-only measurement of how `web/app` and `web/components` are built compared with one design system. Nothing outside this file was changed.

## Scope, method and baseline

- **Baseline:** branch `ui-release-2026-10-19`, HEAD `d0e0205`. Scanned 108 `.ts/.tsx/.css` files under `web/app` and `web/components`. `node_modules` was excluded. `components/ui/liquid-sculpture-hero.tsx` (3,480 lines) is reported separately in §0.
- **Method:** Python regex scans of class strings plus brace-aware JSX tag parsing for `<button>`, `<input>`, `<select>`, `<textarea>`, `<table>` and `<Link>`. Grep counted imports and copy. The copy and term counts are approximate. They cover JSX text nodes and string literals that do not look like class lists, and they exclude `"use client"`. One check ran against the compiled dev CSS, `.next/dev/static/chunks/app_globals_css_*.css`, built 2026-10-19 17:00.
- **The working tree changed during the census.** Another actor modified `web/app/globals.css`, `web/components/collection-pages.tsx` and `web/components/layout/auth-shell.tsx`. It also added the untracked files `web/components/system/*` (inline-alert, money-field, page-header, panel, stat-tile, states, status-badge), `web/lib/money-input.ts` and `web/tests/money-input.test.mjs`. **All counts below describe the HEAD versions of the three modified files** (they were read before the edits) and do not include `components/system/*`. Findings that the in-flight edits already address are marked **[WT]**:
  - shadcn token mappings added to `@theme`
  - AuthShell header changed from `<h1>` to `<p>`
  - `"N customers loaded."` copy replaced
  - `--font-serif` switched to Instrument Serif
  - a global `prefers-reduced-motion` rule and a `:focus-visible` outline added
  - radii rescaled
  - success/warning/danger/info tokens added

  None of these has been re-verified in a running app.

---

## 0. Landing hero (reported separately)

| Item | Finding | Evidence |
|---|---|---|
| `components/ui/liquid-sculpture-hero.tsx` | **No file imports it.** It is a 3,480-line WebGL2 particle hero (`getContext("webgl2")`) and is dead code. | Grep for `liquid-sculpture`/`SculptureHero` finds no importer. Default export at `liquid-sculpture-hero.tsx:2654` |
| Its own design system | It defines private `--sh-bg/--sh-fg/--sh-head/--sh-body/--sh-accent` variables and fetches its own Google Fonts (**Geist + Instrument Serif**). | `:2276-2280`, `:2372`, `:2596` |
| Colors | 5 hex literals (`#151514` ×2, `#EAE9E7`, `#EBE9E5`, `#111110`, `#F1EFEA`), all near-duplicates of app off-whites and near-blacks | – |
| Motion | It respects reduced motion (`matchMedia("(prefers-reduced-motion: reduce)")`, CSS media block) | `:2516`, `:3004`, `:3262` |
| Actual landing hero | `components/landing/hero-section.tsx` is the hero that renders (`app/page.tsx:3`) | – |

---

## 1. Colors

### 1a. Literal volume

| Measure | Count | Notes |
|---|---|---|
| Distinct hex literals, TSX (excluding hero) | **84 distinct / 2,279 occurrences** | 2 `rgba()` literals in `hero-section.tsx:17` |
| Distinct hex literals in `globals.css` (HEAD) | 77 | Includes a 119-line `html.dark …` override block with 86 `!important` |
| Tailwind palette classes (`neutral/red/rose/amber/emerald/green/sky/violet/purple/blue-*`) | **100 distinct / 726 occurrences** | 10 hue families. Red and rose are both used for "bad". |
| `bg-white`, `text-white`, `bg-black`, etc. | 21 distinct / 526 (`bg-white` 221 in 43 files, `text-white` 232) | – |
| Semantic token utilities (`bg-background`, `text-foreground`, `bg-surface`, `border-border`, `text-muted-foreground`, …) | 73 distinct / 219 total. **Outside `components/ui/*` only 24 uses, in 4 files:** `app/error.tsx` (10), `app/not-found.tsx` (10), `components/landing/competitive-matrix.tsx` (3, `settle-pine`) and `collection-pages.tsx` (1, WT) | – |

### 1b. Top hex literals

| Hex | Uses / files | Role in practice | Representative |
|---|---|---|---|
| `#1E2021` | 398 / 32 | Light-mode heading text, primary button background, focus border. This is the **dark-theme `--background`** value. | `app/admin/engine/page.tsx:36`, `components/layout/auth-shell.tsx:160` |
| `#E8E6E1` | 232 / 25 | The de facto border color | `app/deals/page.tsx:17`, `app/admin/logs/page.tsx:103` |
| `#737373` | 191 / 21 | Muted text | `app/admin/logs/page.tsx:115` |
| `#FAF9F7` | 131 / 24 | Subtle surface | `app/admin/engine/page.tsx:36` |
| `#2A2C2D` | 120 / 11 | Dark border | `app/admin/users/page.tsx:276` |
| `#004D3B` | 111 / 17 | Brand green / ok text | `app/deals/page.tsx:17` |
| `#1A1A1A` | 102 / 26 | Body text | `app/admin/orders/page.tsx:152` |
| `#222425` | 92 / 11 | Dark muted surface | `app/auth/forgot-password/page.tsx:31` |
| `#525252` | 83 / 17 | Secondary text | `app/admin/engine/page.tsx:47` |
| `#ECEAE4` | 71 / 15 | Border or surface | `app/deals/[id]/documents/page.tsx:85` |
| `#526975` | 67 / 12 | Muted text (landing) | `components/landing/architecture-security.tsx:90` |
| `#F4F2ED` | 63 / 15 | Chip and segmented-control background | `app/deals/page.tsx:17` |
| `#181A1B` | 60 / 12 | Dark card | `app/admin/users/page.tsx:253` |
| `#2C302F` | 53 / 7 | Dark border (2nd variant) | `app/deals/[id]/page.tsx:180` |

### 1c. Near-duplicate clusters

| Cluster | Members (uses) | Representative |
|---|---|---|
| Off-white surfaces (13) | `#F7F6F5` 47+2 lowercase, `#FAF9F7` 131, `#F4F2ED` 63, `#F3F4F6` 38, `#F2F0EB` 4, `#F0EFEA` 1, `#F0EEEA` 8, `#EFECE6` 2, `#ECEAE4` 71, `#EAE7E0` 1, `#FFFAEC` 23, plus `neutral-50` 27 and `neutral-100` 12 | `app/deals/page.tsx:171` (`#F4F2ED` then hover `#EAE7E0`) |
| Light borders (8) | `#E8E6E1` 232, **token value `#E5EBEA` 2**, `#ECEAE4` 64 as border, `#F4F2ED` 19 as border, `#F0EEEA` 3, `#E5E7EB` 1, `neutral-200` 17, `neutral-300` 13 | `app/admin/users/page.tsx:266` (`#E5E7EB`) |
| Near-black text (9) | `#1E2021` 398, `#1A1A1A` 102, `#202223` 11, `#151718` 8, `#121314` 3, `neutral-900` 20, `text-black` 5, `bg-black` 12, `bg-neutral-900` 8 | `components/landing/order-simulator.tsx:201` (`#202223`) |
| Mid-grey text (9 hex) | `#737373` 191, `#525252` 83, `#526975` 67, `#A3A3A3` 37, `#9CA3AF` 22, `#6B6B6B` 6, `#8C8C8C` 1, `#B8B6B0` 1, `#374151` 1, plus `text-neutral-300…700` (263) | `app/auth/signin/page.tsx:110` (`#6B6B6B` placeholder) |
| Dark surfaces/borders (14) | `#181A1B` 60, `#222425` 92, `#2A2C2D` 120, `#2C302F` 53, `#2E3235` 25, `#151718` 8, `#232423` 2, `#2B2D2C` 2, `#26282A` 1, `#282A2B` 2, `#282A2C` 4, `#2D3032` 1, `#2E3032` 1, `#373A3C` 1 | `app/auth/signin/page.tsx:151` (`#232423`/`#2B2D2C`) |
| Greens (16 hex) | `#004D3B` 111, `#093A2F` 25, `#00382B` 12, `#00261D` 1, `#065F46` 3, `#059669` 16, `#34D399` 28, `#6EE7B7` 5, `#A7F3D0` 3, `#ECFDF5` 2, `#D1FAE5` 1, `#B5F2C6` 38, `#EAF7EE` 9, `#D5EFE0` 1, `#E6F4F1` 8, `#529A86` 1, plus `emerald-*`/`green-*` (18 classes) | `app/admin/orders/page.tsx:353` |
| Reds (8 hex) | `#991B1B` 21, `#DC2626` 7, `#7F1D1D` 1, `#E05D52` 2, `#FEF2F2` 6, `#FEE2E2` 1, `#FECACA` 3, `#FCA5A5` 2, plus `red-*` (14 classes), plus `rose-*` (9 classes) | `app/overview/page.tsx:556` |
| Ambers (7 hex) | `#8A5A00` 8, `#92400E` 4, `#D97706` 9, `#C97D18` 2, `#FDE68A` 2, `#FEF3C7` 1, `#FCD34D` 1, plus `amber-*` (11 classes) | `app/deals/page.tsx:18` |

### 1d. Tokens in `globals.css` (HEAD): used vs unused

| Token group | Defined | Used (outside `globals.css`) | Notes |
|---|---|---|---|
| `@theme` mapped semantics (`--color-background/foreground/surface/border/border-strong/muted-foreground/destructive`) | 7 | All appear, but almost only in `components/ui/*` and the error/not-found pages. `bg-surface` 2, `hover:border-border-strong` 2, `bg-background` 2 (ui) | – |
| `:root/.dark` vars **not mapped into `@theme`** at HEAD (`--card --popover --primary --secondary --muted --accent --input --ring` and their foregrounds) | 14 | Used by shadcn primitives (`bg-primary`, `bg-card`, `bg-popover`, `border-input`, `bg-muted`, `text-primary-foreground`, …) | **The compiled CSS contains no rules for them** (0 matches for `.bg-primary`, `.bg-card`, `.bg-popover`, `.border-input`, `.bg-muted`, `.text-primary-foreground`). The primitives render without fills and focus rings. **[WT]** mapping added. |
| `--color-brand-*` | 18 | 3 (`pine-green`, `forest-green`, `eggshell`), only in `app/error.tsx:24,27` and `app/not-found.tsx:18,20` | 15 never used |
| `--color-settle-*` | 15 | 1 (`settle-pine`, 3 uses, `competitive-matrix.tsx:161,186`) | 14 never used. Duplicates brand values (`#004D3B` defined 3× as `primary`, `brand-pine-green` and `settle-pine`) |
| `--radius-*` | 7 + `--radius` | Through `rounded-*` | – |
| `.orderfit-page-main` / `.orderfit-page-container` utilities | 2 | **0 uses.** Every page hand-writes `px-4 sm:px-6 lg:px-8` and `max-w-[1560px]`. | `globals.css` "Unified Page Layout System" block |

### 1e. Literals used where a token exists

| Token (light) | Token value | Literal uses instead |
|---|---|---|
| `--foreground` | `#1A1A1A` | `#1A1A1A` ×102, `#1E2021` ×398, `neutral-900` ×20 |
| `--background` | `#F7F6F5` | `#F7F6F5` ×49 (`app/layout.tsx:49` body uses `bg-[#F7F6F5] dark:bg-[#1E2021]`) |
| `--card` / `--surface` | `#FFFFFF` | `bg-white` ×221 |
| `--border` / `--input` | `#E5EBEA` | `#E5EBEA` ×2. **`#E8E6E1` ×232** is used instead. |
| `--muted` / `--secondary` | `#ECEAE4` | `#ECEAE4` ×71, `#FAF9F7` ×131, `#F4F2ED` ×63 |
| `--muted-foreground` | `#526975` | `#526975` ×67, `#737373` ×191, `#525252` ×83 |
| `--primary` / `--ring` | `#004D3B` | `#004D3B` ×111. The **primary button color in practice is `#1E2021` or `neutral-900`, not `--primary`.** |
| `--destructive` | `#C53030` | `#C53030` ×0. `#991B1B` ×21, `#DC2626` ×7, `red-600/700/800` instead. |
| `--accent` | `#B5F2C6` | `#B5F2C6` ×38 |
| Dark `--card` / `--muted` / `--border` / `--foreground` | `#181A1B` / `#222425` / `#2A2C2D` / `#F3F4F6` | ×60 / ×92 / ×120 / ×38 as `dark:` literals |

### 1f. Dark-mode coverage

The `dark:` variant appears **1,095 times in total**. Dark mode for untagged screens comes only from the `globals.css` `html.dark .bg-white`, `.text-[#…]` and `.border-[#…]` `!important` override block, which remaps about 45 raw classes.

| File | `dark:` | raw `bg-white` | `bg-[#…]` |
|---|---|---|---|
| `app/overview/page.tsx` | 190 | 13 | 35 |
| `components/deals/deal-evaluation-inspector.tsx` | 181 | 16 | 24 |
| `components/landing/order-simulator.tsx` | 84 | 2 | 20 |
| `app/deals/page.tsx` | 83 | 9 | 8 |
| `app/auth/signup/page.tsx` | 73 | 6 | 9 |
| `components/ui/skeleton.tsx` | 63 | 15 | 8 |
| `components/landing/feature-pillars.tsx` | 52 | 7 | 5 |
| `components/layout/app-sidebar.tsx` | 51 | 5 | 6 |
| `app/auth/signin/page.tsx` | 44 | 1 | 5 |
| `app/deals/new/page.tsx` | 42 | 5 | 3 |
| `app/admin/users/page.tsx` | 40 | 11 | 31 |
| `components/layout/connection-indicator.tsx` | 39 | 6 | 14 |
| `app/deals/[id]/page.tsx` | 13 | **16** | 2 |
| `components/preparation-workspace.tsx` | 6 | **10** | 0 |
| `app/deals/sources/page.tsx` | 5 | 7 | 0 |

**Light-only raw surfaces (`bg-white` or `bg-[#…]` with 0 `dark:`):** `app/admin/orders` (8/9), `app/admin/tenants` (8/7), `app/admin/logs` (3/9), `app/admin/security` (3/6), `app/admin/system` (2/3), `app/admin/engine` (1/2), `app/deals/[id]/documents` (11/0), `components/p7/bank-hold.tsx` (3), `components/approval/ui.ts` (2), `components/auth/accept-invitation.tsx`, `components/decision-guide.tsx`, `components/manual-order-inputs.tsx`, `components/notifications/notification-bell.tsx`, `components/settings/settings-screen.tsx`, and 8 landing sections (`navbar`, `architecture-security`, `competitive-matrix`, `cta-section`, `faq-section`, `sectors-marquee`, `workflow-section`, `footer`). Every P7 screen (customers, payees, financing, risk, audit, cash-flow, users, settings) has 0 `dark:` and gets `bg-white` through the shared `panel` and `field` constants (`components/p7/common.tsx:10-14`, 1 `dark:` in the whole file).

---

## 2. Typography

### 2a. Sizes (color arbitraries such as `text-[#1E2021]` are excluded)

| Class | Uses / files | Representative |
|---|---|---|
| `text-xs` (12px) | 334 / 58 | `app/admin/logs/page.tsx:115` |
| `text-sm` | 286 / 63 | `app/admin/page.tsx:311` |
| **`text-[11px]`** | **108 / 21** | `app/overview/page.tsx:751`, `components/deals/deals-workflow-stepper.tsx:56` |
| `text-base` | 56 / 28 | `components/layout/auth-shell.tsx:160` |
| **`text-[10px]`** | **55 / 16** | `app/deals/page.tsx:102,153`, `app/admin/orders/page.tsx:335` |
| `text-lg` | 44 / 22 | `app/overview/page.tsx:448` |
| `text-xl` | 39 / 18 | `app/admin/orders/page.tsx:217` |
| `sm:text-sm` | 29 / 12 | Auth inputs (`text-base sm:text-sm`) |
| `text-2xl` (+ `sm:`/`lg:` 3xl) | 20 + 21 / 15 | Page titles |
| **`text-[9px]`** | 1 | `components/layout/app-sidebar.tsx:353` ("ADM"/"USR") |
| Landing arbitraries | `text-[2.25rem]` 7, `md:text-[3.1875rem]` 7, `text-[1.688rem]` 5, `md:text-[2rem]` 3, `md:text-[2.1rem]` 2, `text-[2rem]`, `sm:text-[2.5rem]`, `md:text-[3rem]`, `lg:text-[3.75rem]`, `xl:text-[4.25rem]`, `text-[clamp(2.75rem,14vw,11rem)]` | `components/landing/feature-pillars.tsx:42` |

**Text below 12px: 164 instances in 24 files.** The heaviest workspace users are `overview` (25), `deal-evaluation-inspector` (19), `admin/users` (20), `admin/orders` (13), `admin/tenants` (10), `deals/page` (7) and `deals/[id]/documents` (5). Table headers (`deals/page.tsx:153`), status chips and stepper labels are all 10–11px.

### 2b. Weights, tracking, case

| Item | Counts | Representative |
|---|---|---|
| Weights | `font-semibold` 310, `font-bold` 157, `font-medium` 133, `font-normal` 23, `font-extrabold` 1 | Titles use bold (`deals/page.tsx:86`) or semibold (`deals/[id]/page.tsx:226`) at random |
| Tracking | `tracking-wider` 61, `tracking-tight` 36, `tracking-[0.02rem]` 7, `tracking-widest` 6, `tracking-wide` 4, `tracking-[0.04em]` 4, `tracking-normal` 1 | – |
| `uppercase` | 83 in 25 files. Also `font-small-caps` utility defined, 0 uses. | – |
| Eyebrow recipes (6 variants) | `text-xs font-medium uppercase tracking-wider text-[#737373]` (`deals/page.tsx:23`); `text-xs font-semibold uppercase tracking-wider` (`overview/page.tsx:341`); `text-[11px] font-semibold uppercase` with no tracking (`overview/page.tsx:751`); `text-[10px] uppercase tracking-wider` thead (`deals/page.tsx:153`); `text-xs font-semibold uppercase tracking-wide text-neutral-500` (`unavailable-notice.tsx:11`, `admin/engine/page.tsx:48`); landing `tracking-widest` (`architecture-security.tsx:84`) | – |
| `tabular-nums` | 5, **all in the landing hero** (`hero-section.tsx:121…`). **0 on any workspace money, table or KPI.** **[WT]** adds a `.tabular` utility. | – |

### 2c. Font families

| Class | Uses / files | Resolves to |
|---|---|---|
| `font-sans` | 108 / 27 | IBM Plex Sans. Redundant, because `*`, `html`, `body`, `h1-h6` and `button/input/select/textarea` already force Plex Sans with `!important` (`globals.css` base layer). |
| `font-display` | 63 / 22 | **IBM Plex Sans (same family as `font-sans`)** |
| `font-heading` | 36 / 14 (landing) | IBM Plex Sans |
| `font-beausite` / `font-radio-grotesk` | 4 / 1 (`footer.tsx`) | IBM Plex Sans |
| `font-mono` | 79 / 24 | IBM Plex Mono (IDs, hashes, money in `overview/page.tsx:717`) |
| `font-neue-machina` | 3 (`order-simulator.tsx:427`) | IBM Plex Mono |
| `font-serif` | **1** (`components/landing/hero-section.tsx:27`) | Playfair Display at HEAD; Instrument Serif in the WT |

| Imported Google family (`globals.css:1`) | Variants loaded | Actual use |
|---|---|---|
| IBM Plex Sans | 300–700 + 4 italics (9) | Everything |
| IBM Plex Mono | 400/500/600 + italic (4) | 79 + 3 elements |
| Playfair Display | 400/600/700 + 3 italics (6) | **1 element** (landing hero line) |
| Instrument Serif | regular + italic | Fallback only (and the unused liquid hero loads it again) |

Six class names alias one family (`font-sans`, `display`, `heading`, `radio-grotesk`, `beausite` and the base rules). At HEAD the base rule `* { font-family: 'IBM Plex Sans' … }` targets every element directly. That likely defeats inheritance, so `font-mono` set on a parent does not reach child elements. **[WT]** removes the `*` font rule.

---

## 3. Spacing and sizing

| Item | Finding | Representative |
|---|---|---|
| Page container | `max-w-[1560px]` 42 uses / 23 files, all hand-written. `.orderfit-page-container` 0 uses. | `components/p7/common.tsx:27` |
| Workspace gutter | `main` = `px-4 sm:px-6 lg:px-8 py-6`, then inner `max-w-[1560px] mx-auto` (deals, overview, sources, documents, preparation, PageFrame, unavailable) | `app/deals/page.tsx:81-82` |
| Admin and new-order gutter | `main` = `p-4 sm:p-6 lg:p-8 max-w-[1560px]` on the same element. Content is 64px narrower at `lg` and the top padding is 32px instead of 24px. | `app/admin/logs/page.tsx:154`, `app/deals/new/page.tsx:181` |
| Error-state gutter | `main className="p-6"` with no container | `app/deals/page.tsx:60`, `app/overview/page.tsx:186` |
| Other widths | Auth card `max-w-[440px]` ×3, accept-invite `max-w-md`, error/not-found `max-w-md`, global-error `maxWidth:420` (inline style), landing `max-w-7xl` ×13, hero `max-w-6xl`, admin text `max-w-2xl`, admin modals `max-w-lg/md` | `app/auth/signin/page.tsx:80` |
| Header height | `h-16` in AuthShell (`auth-shell.tsx:159`) and **8 copies** in admin pages (`app/admin/*/page.tsx`). Sidebar brand row `h-16`. Landing navbar `h-16 sm:h-18`. Auth pages use a padded header with no fixed height (`signin/page.tsx:60`). | – |
| Button heights | ui/button `h-8` (unused); `py-1.5 text-xs` ≈30px toolbars (`deals/page.tsx:94`); `px-3 py-2 text-sm` ≈36px P7 (`p7/common.tsx:11`); `py-2.5 text-xs` ≈34px CTAs (`deals/page.tsx:134`); `py-3 text-sm` ≈44px auth (`signin/page.tsx:158`); `h-10` error pages (`error.tsx:27`); `size-8` pager (`deals/page.tsx:213`) | – |
| Input heights | `p-2 text-sm` ≈36px (`p7/common.tsx:14`); `px-3 py-2` + base ≈42px (`manual-order-inputs.tsx:5`); `py-2 text-xs` ≈32px (admin, deals search); `px-4 py-3` ≈46px auth; ui/input `h-8` (unused) | – |
| Arbitrary spacing and sizing | 18 distinct / 22 uses. Mostly `min-w-[760px]` table scroll and `min-h-[100dvh]` auth (3) | `app/deals/page.tsx:152` |
| Padding scale | 43 distinct `px/py` values (868 uses), including `px-3.5`, `py-3.5`, `px-2.5`, `py-2.5`, `px-1.5` | – |

---

## 4. Radius, border, shadow, blur

| Item | Distinct / total | Breakdown | Representative |
|---|---|---|---|
| `rounded-*` | 18 / 653 | `xl` 166, `full` 135, `lg` 129, `2xl` 104, bare `rounded` (4px) 62, `md` 19, `3xl` 13, `4xl` 8, arbitrary `[min(var(--radius-md),10px)]`/`[4px]`/`[2px]` in ui. **The same "panel" role appears as `rounded`, `rounded-lg`, `rounded-xl` and `rounded-2xl`.** | `p7/common.tsx:10` (`xl`) vs `deals/sources/page.tsx:84` (`2xl`) vs `deals/[id]/documents/page.tsx:161` (`rounded`) |
| Border colors | **67 / 662** | `#E8E6E1` 221, `dark:#2A2C2D` 109, `#ECEAE4` 64, `dark:#2C302F` 40, `focus:#1E2021` 22, `dark:#2E3235` 22, `#F4F2ED` 19, `neutral-200` 17; the default `border` (token) in P7 | `app/admin/users/page.tsx:266` |
| Shadows | 16 / 195 | `shadow-xs` 138, `shadow-lg` 11, `hover:shadow-md` 9, `shadow-2xs` 9, `shadow-2xl` 5, `shadow-sm` 5, `hover:shadow-sm` 5, `shadow-xl` 2, `shadow-md` 2 (ui); arbitrary `shadow-[0_20px_50px_rgba(0,0,0,0.06)]` (`order-simulator.tsx:198`) and glow `shadow-[0_0_8px_rgba(181,242,198,0.6)]` (`smooth-scroll-provider.tsx:121`) | – |
| Backdrop blur | 5 / 21 | `backdrop-blur-md` 11 (AuthShell header plus 8 admin headers, connection indicator), `backdrop-blur-xs` 5 (admin modals ×3, dialog/sheet), `backdrop-blur-sm` 1 (landing navbar), `blur-3xl` hero glow, `blur` ×3 (OTP, unused) | `app/admin/users/page.tsx:565` |
| Card recipes (`bg-white`/`#FAF9F7` + rounded + padding) | **26 distinct / 98** | See §5 card row | – |

---

## 5. Components

### 5a. UI roles and their implementations

| Role | Implementations (count) | Where used | Flag |
|---|---|---|---|
| **Page shell** | (1) `AuthShell` (`components/layout/auth-shell.tsx:154-180`): workspace routes via `deals/layout`, `overview/layout`, `AuthenticatedPage`. (2) **Admin shell hand-copied ×8** (`app/admin/{page,engine,logs,orders,security,system,tenants,users}/page.tsx`, e.g. `engine/page.tsx:28-45`). (3) Auth page header copied ×3 (`auth/signin:60`, `signup`, `forgot-password`). (4) `accept-invitation.tsx:59` grid card. (5) error/not-found centered (`error.tsx:9`). (6) `global-error.tsx` inline styles. (7) Landing navbar. | – | **3+ hand-rolled** |
| **Page title block** | (1) `PageFrame` (`p7/common.tsx:24`): customers, payees, financing, risk, audit, cash-flow, settings, users. **It accepts `intro` but never renders it**, so all 8 explanatory intros are dropped. (2) Inline h1 `text-2xl sm:text-3xl bold` (`deals/page.tsx:86`, `overview/page.tsx:282`, `deals/sources/page.tsx:60`, `admin/page.tsx:240`). (3) `text-xl sm:text-2xl bold` + back button (`deals/new:200`, `deals/[id]:190`, `preparation-workspace.tsx:182`). (4) `text-xl/2xl font-semibold` (`documents:158`, `deals/[id]:226`, `accept-invitation:61`). (5) Admin header h1 `text-base` (8 pages). (6) `unavailable-notice.tsx:12`. **At HEAD every workspace page has 2 `<h1>`** (AuthShell `auth-shell.tsx:160` plus the page). `deals/[id]` has 3; `admin/page` has 2. **[WT]** AuthShell h1 changed to `<p>`. | – | **5 variants** |
| **Sidebar/nav** | `AppSidebar` (`components/layout/app-sidebar.tsx`), single implementation with `variant="admin"` and mobile `Sheet`. `AdminSidebar` wrapper (`admin-sidebar.tsx`) is orphaned. Labels come from **3 maps**: `lib/p7-model.ts:32-41` (sentence case), `app-sidebar.tsx:51-64` `LABELS` override (Title Case), and `auth-shell.tsx` `SIDEBAR_ROUTE_NAMES` (header). `/financing` and `/risk-constraints` are not in nav. | – | label drift |
| **Card/panel** | 26 recipes across 98 instances: (a) polished `rounded-2xl border-[#E8E6E1] shadow-xs` + dark (deals, overview, auth, inspector), 13+; (b) `panel` const `rounded-xl border bg-white p-5`, **defined 3×** (`p7/common.tsx:10`, `approval/ui.ts:1`, `preparation-workspace.tsx:21`); (c) inline `rounded-2xl border bg-white p-5` ×16 (`deals/sources:83-91`, `deals/[id]:301,340`, `documents:166,172`); (d) admin `rounded-2xl p-4 border-[#E8E6E1] shadow-xs`, light-only, ×16 (`admin/page.tsx:258`); (e) documents `border-[#ECEAE4] shadow-sm` (`documents:85`); (f) `DecisionGuide` sky panel (`decision-guide.tsx:11`); (g) `ui/card.tsx` unused. `deals/[id]` mixes (a) and (c) on one screen (`:206` vs `:225`). | – | **6 hand-rolled** |
| **Stat tile/KPI** | `deals/page.tsx:22-24` (CARD/LABEL/VALUE); `overview/page.tsx:333-440` (icon box + change); `overview/page.tsx:750-780` mini tiles (`text-[11px]`); `admin/page.tsx:258-290`; `admin/orders/page.tsx:213-240`; inspector summary (`deal-evaluation-inspector.tsx:161,176`) | – | **6 variants** |
| **Data table** | `deals/page.tsx:152` (hex, `text-[10px]` uppercase thead); admin ×5 (`logs:202`, `orders:304`, `security:91`, `tenants:224`, `users:458`); `cash-flow-screen.tsx:38`; `customers-screen.tsx:88`; `bundle-review.tsx:19`; `preparation-workspace.tsx:308` (unstyled `<th>`); landing ×2. `ui/table.tsx` unused. Dark mode for tables comes from global `html.dark table thead tr` overrides. **No table uses tabular numerals or right-aligned money.** | – | **4+ variants** |
| **List row** | `cash-flow-screen.tsx:48` (`divide-y li`); `audit-screen.tsx:29-32` (`dl` + `details`); `preparation-workspace.tsx:271,278,289` (`article border-t`); notification items; payees rows | – | ad hoc |
| **Filter/search** | Deals search (`deals/page.tsx:145-147`, `bg-white rounded-xl`, icon); admin search ×4 (`logs:169`, `orders:262`, `tenants:209`, `users:392`, `bg-[#FAF9F7]`) plus admin filter selects; no search on P7 collections | – | 2 |
| **Tabs/segmented** | `deals/page.tsx:139` (`role=tab`); `overview/page.tsx:472` timeframe (no role); `overview/page.tsx:639` mode (no role); `deal-evaluation-inspector.tsx:95` 5 tabs (no role) incl. "Raw JSON"; inspector table/raw `:556`; `settings-screen.tsx:28` (`role=tab`, `bg-neutral-900` style). `ui/tabs.tsx` unused. | – | **6 hand-rolled** |
| **Buttons** | 172 raw `<button>` in 46 files, **30 distinct bg/radius/border recipes**. Primary: `bg-[#1E2021] rounded-xl` (auth `signin:158`, admin, AuthShell CTA `auth-shell.tsx:170`, `deals/page.tsx:134`); `primary` const `bg-neutral-900 rounded` **×2 defs** (`p7/common.tsx:12`, `approval/ui.ts:3`), 17 uses; `bg-neutral-900 rounded-lg` (`deals/[id]:232`, `accept-invitation:79`); **`button` const in `deals/sources/page.tsx:19` is a dark primary**, while `button` in `p7/common.tsx:11` is a bordered secondary; `bg-black rounded-lg` (`documents:165`); `bg-brand-pine-green` (`error.tsx:24`); `bg-[#004D3B] rounded-full` (landing); `bg-red-600` (`overview:190`). Secondary: `button` const `border-neutral-400 rounded` **×3 defs** (`p7/common`, `approval/ui`, `preparation-workspace:20`), 44 uses; `bg-white rounded-xl border-[#E8E6E1]` (`deals/page.tsx:94`); `bg-[#FAF9F7] rounded-xl` (admin); red-bordered (`bank-hold.tsx:10`). Destructive: `danger` const (10), admin `text-[#991B1B] hover:bg-[#FEF2F2]`, `bg-[#991B1B]` (`admin/users:748`). Text/underline buttons (`deals/page.tsx:60`, `deals/[id]:201`). Icon: theme toggle, admin back link `p-1.5 rounded-xl`, bell. **`ui/button.tsx` used by 0 screens.** | – | **8+ primaries** |
| **Inputs/select/textarea/checkbox** | 76 `<input>`, 45 `<select>`, 15 `<textarea>`, 8 native checkboxes (7 files, unstyled). Class constants: `field` ×2 defs (`p7/common:14` with `mt-1`, `approval/ui:4` without), `fieldClass` (`manual-order-inputs.tsx:5`, re-exported as `field` in `deals/new:11` and `deals/sources:9`), `input` ×2 (`preparation-workspace:19`, red `bank-hold:9`); admin inline `bg-[#FAF9F7] rounded-xl text-xs` (11 inputs, 10 selects); auth `px-4 py-3 rounded-xl` (`signin:110`); business switcher. `ui/input`, `select`, `textarea`, `checkbox` unused. | – | **6 recipes** |
| **Form field wrapper** | Label-wraps-input: `"block text-sm"` 37, `"text-sm"` 14, `"block"` 10; `"block text-xs text-[#737373]"` 10; admin `"block text-xs font-semibold uppercase … mb-1.5"` 2; auth `"block font-semibold text-[#1E2021] mb-1"` 5. Hints are loose `<p>`, errors are `Alert` or inline `<p>`. `aria-describedby`/`aria-invalid` only 5 uses in 3 files. `ui/form.tsx` unused. | – | **5 variants** |
| **Badge/status/verdict chip** | `deals/page.tsx:16-21` `TONE`; `deal-evaluation-inspector.tsx:36-55` `decisionStyles`; `overview/page.tsx:156` `statusBadge` (text only) and `:167` `recentStatusBadge` (`rounded-md`); `admin/users/page.tsx:251` `getRoleBadge` (pastel hex per role) and status chips `:513`; `admin/orders/page.tsx:353`; `payees-screen.tsx:14` `STATUS_STYLE`; `provenance-badge.tsx`; notification count (`notification-bell.tsx:49`); stepper pill. `ui/badge.tsx` unused. **The same verdict has 3 labels:** `accept_as_is` is "Feasible As Offered" (`lib/pipeline-model.ts:36`), "Accept As-Is" (inspector `:42`) and "Feasible As-Is" (`overview:751`); decline is "No feasible plan" vs "Decline / Renegotiate". | – | **9+ variants** |
| **Alert/banner** | `Alert` (`p7/common.tsx:37`, 28 uses / 10 files); **inline `bg-red-50 … text-red-800` ×18 in 19 files** (`auth-shell.tsx:124`, `deals/page.tsx:60`, `deals/[id]:199`, …); overview amber data-quality notice (`overview:301,319`); `DecisionGuide` (sky); `BankChangeHold` (`border-2 border-red-300`); `sandboxBanner` string const (`approval/ui.ts:5`); landing announcement banner | – | **4+** |
| **Toast** | Sonner `<Toaster/>` mounted globally (`providers.tsx:38`) with **0 `toast()` calls**. 4 admin pages hand-roll toasts with `setTimeout` (`admin/page.tsx:44`, `logs:27`, `orders:45`, `tenants:36`). P7 success notices render inline. | – | **2 systems, 1 dead** |
| **Dialog/sheet/dropdown** | 3 hand-rolled modals in `admin/users/page.tsx:565,649,708` (`fixed inset-0 bg-black/40`, no `aria-modal` or focus trap); notification popover `role="dialog"` (`notification-bell.tsx:51`); connection-indicator popover; `ui/sheet` used only by AppSidebar mobile; `ui/dialog`, `dropdown-menu` and `tooltip` unused (`title=` used as tooltip) | – | 3 |
| **Empty state** | Table row text (`deals/page.tsx:157`, with CTA); `<p className={panel}>` (`customers:23`, `payees:24`); `text-sm text-neutral-600` (`audit-screen:26`); admin rows "…in the database yet" (`logs:223`, `orders:326`, `tenants:247`, `users:480`); `overview:842`; `preparation-workspace:304` | – | **5 variants** |
| **Error state** | `error.tsx` / `not-found.tsx` (the only token-based screens); `global-error.tsx` inline styles; `QueryError` (`p7/common.tsx:90`, 14 uses); AuthShell error `<p>`; overview error box with `bg-red-600` Retry (`overview:186-200`); deals error `main p-6` + underline (`deals/page.tsx:60`); deal detail `showUnavailable`; `CollectionPages` inline alert | – | **7 variants** |
| **Skeleton/loading** | `ui/skeleton.tsx` (874 lines, 15 exports, **16 consumers**; the one primitive with real adoption); `Loading` wrapper (`p7/common.tsx:42`, 14 uses); border spinners ×2 (`auth-shell.tsx:126`, `accept-invitation.tsx:70`); `RefreshCw animate-spin` ×8 (admin); text `"Loading…"` (`CollectionPages`) | – | 3 |
| **Pagination/load-more** | Offset pager with page pill `bg-[#004D3B]` (`deals/page.tsx:192-229`); `CollectionPages` "Load more {noun}" (10 files); admin loads `limit=100` with no paging (`admin/orders:71`) | – | 2 + none |
| **Stepper** | `DealsWorkflowStepper` (`components/deals/deals-workflow-stepper.tsx`), used on `deals/[id]` (step 4) and `preparation-workspace` (step 5) only. Hidden below `lg`; not rendered on `deals/new`. **Steps 2 "Validate" and 3 "Confirm" link to routes that are now server redirects** (`app/deals/new/validate/page.tsx`, `app/deals/[id]/confirm/page.tsx`). Labels "1. Ingest … 5. Approve" do not match page titles. | – | broken links |
| **File dropzone** | None. One native `<input type="file">` (`deals/[id]/documents/page.tsx:163`). | – | – |
| **Money/date/percent** | `formatMinor` (`lib/approval-model.ts:9`, 42 refs), wrapped by 4 local helpers (`deals/page.tsx:71`, `overview/page.tsx:77`, `financing-screen.tsx:20`, `risk-screen.tsx:18`, the last two falling back to `"${minor} minor units"`). Raw minor units shown in `deals/new/page.tsx:276`. `formatUSD` on landing (`order-simulator.tsx:171`). **`DollarSign` icon on BDT KPIs** (`overview:339`, `admin/page:300`, `admin/orders:240`). Dates: raw ISO strings (`deals/page.tsx:104,167`); `when()` = `toLocaleString()` **defined 2×** (`p7/common:15`, `approval/ui:6`), 18 uses; admin `toLocaleString("en-US")`. Percent: ad hoc `toFixed(1)` ×10, `toFixed(0)` ×8. | – | **4+ money paths** |
| **Business switcher** | Native `<select>` in AuthShell (`auth-shell.tsx:165-168`, `appearance-none bg-none text-center`, no chevron); admin tenant selects (`admin/logs:182`, `admin/users:404`) | – | 2 |
| **Charts** | Hand-rolled SVG splines (`overview/page.tsx:519-580`) with hard-coded strokes. **Inflow is drawn red `#E05D52`, outflow blue `#3B82F6`, while the legend dots are dark and grey** (`:452-458` vs `:556-557`). Div bar meters (`overview:722`); inspector daily series is a table/raw view. `recharts` is a dependency with 0 imports. | – | legend mismatch |

### 5b. `components/ui/*` primitives with no screen consumer

16 of 20 files are not imported by any screen: `badge`, `button` (only used inside `dialog`/`sheet`), `card`, `checkbox`, `dialog`, `dropdown-menu`, `form`, `input`, `label` (only inside `form`), `select`, `separator`, `table`, `tabs`, `textarea`, `tooltip`, `be-ui-otp-input` (516 lines) and `liquid-sculpture-hero` (3,480 lines). The used ones are `skeleton` (16 consumers), `sheet` (1, AppSidebar), `sonner` (mounted, no toasts) and `scroll-reveal` (landing). Other orphans: `components/admin/capabilities-screen.tsx` (no route) and `components/layout/admin-sidebar.tsx`. All ui primitives import `cn` from the npm package `cn` (`lib/utils.ts` re-exports it).

### 5c. Screens using raw elements instead of primitives (counts: button / input / select / textarea / table)

| Screen | Raw counts | Screen | Raw counts |
|---|---|---|---|
| `components/preparation-workspace.tsx` | 17 / 8 / 7 / 5 / 2 | `app/deals/[id]/documents/page.tsx` | 6 / 2 / 2 / 0 / 0 |
| `app/admin/users/page.tsx` | 15 / 2 / 6 / 1 / 1 | `app/deals/page.tsx` | 6 / 1 / 0 / 0 / 1 |
| `components/users/users-screen.tsx` | 10 / 2 / 2 / 2 / 0 | `app/overview/page.tsx` | 5 / 0 / 0 / 0 / 0 |
| `components/deals/deal-evaluation-inspector.tsx` | 9 / 0 / 2 / 0 / 0 | `components/approval/approval-controls.tsx` | 5 / 2 / 0 / 0 / 0 |
| `app/deals/sources/page.tsx` | 7 / 2 / 6 / 0 / 0 | `components/layout/app-sidebar.tsx` | 5 / 0 / 0 / 0 / 0 |
| `app/deals/[id]/page.tsx` | 7 / 2 / 1 / 0 / 0 | `components/cash/cash-event-actions.tsx` | 4 / 4 / 3 / 1 / 0 |
| `components/payees/payees-screen.tsx` | 7 / 2 / 0 / 2 / 0 | `components/settings/settings-screen.tsx` | 4 / 9 / 3 / 1 / 0 |
| `components/manual-order-inputs.tsx` | 2 / 14 / 2 / 0 / 0 | `app/deals/new/page.tsx` | 2 / 8 / 2 / 0 / 0 |
| admin logs / orders / tenants / security | 3/1/1/0/1, 3/1/1/0/1, 2/1/0/0/1, 0/0/0/0/1 | `app/auth/signup` / `signin` | 2/4/2/0/0, 2/2/0/0/0 |

**No screen imports `ui/button`, `ui/input`, `ui/select`, `ui/textarea`, `ui/table`, `ui/card`, `ui/badge`, `ui/tabs` or `ui/dialog`.**

---

## 6. Icons

| Item | Finding | Representative |
|---|---|---|
| Library | `lucide-react` only: 42 files, 50 distinct icons, 208 instances | – |
| Sizes on lucide elements | `size-4` 92, `size-3.5` 39, `size-3` 26, `size-5` 16, **`w-3.5 h-3.5` 12**, **`h-4 w-4` 6**, `size-6` 3, `size-4.5` 2, `size-5 lg:size-6` 1, `size-2.5` 1, `size-2` 1, none (ui default via `[&_svg]`) 9 | `app/deals/[id]/documents/page.tsx:111` (`w-3.5 h-3.5`), `app/deals/[id]/page.tsx:268` (`h-4 w-4`), `components/layout/connection-indicator.tsx:198` (`size-2` spinner) |
| Unicode glyph icons | `→` ×4 (`deals/[id]/documents/page.tsx:147`, landing `competitive-matrix:124`, `hero-section:196`, `navbar:217`), `✓` ×1 (`deal-evaluation-inspector.tsx:425`), `•` ×2 (`overview/page.tsx:860`, OTP). `·` ×91 used as separators. No emoji. | – |
| Semantics | `DollarSign` for a BDT default currency (`overview/page.tsx:339`) | – |

---

## 7. Motion

| Source | Where it runs | Workspace? | Reduced motion |
|---|---|---|---|
| **Lenis smooth scroll + GSAP ticker** (`smooth-scroll-provider.tsx:4-57,195-215`) | Mounted in `Providers` (`providers.tsx:34`), so on **every route** | **Yes** | `smoothWheel` off under reduce. The GSAP ticker and Lenis RAF still run. |
| **Scroll progress bar** (fixed 3px gradient with glow, `smooth-scroll-provider.tsx:113-126`) | Every route | **Yes** | Not guarded |
| `html { scroll-behavior: smooth }` (`globals.css` base) | Every route | Yes | Not guarded at HEAD. **[WT]** adds a global reduce rule. |
| CSS transitions | `transition-colors` 171, `transition-all` 60, `transition-transform` 16, `transition` 13, `transition-shadow/opacity` 2; `duration-200` 14, `300` 6, `100` 6, `500` 5, `150` 2, `75` 1; `active:scale-[0.98]` (`auth-shell.tsx:170`, `deals/[id]:214`) | Yes | `motion-reduce:` only 2 uses (`skeleton.tsx:19,348`) |
| `tw-animate-css` (`globals.css:3`) | `animate-in/out`, fade/zoom/slide in ui primitives (mostly unused), admin toasts and modals (`admin/users:566`), connection-indicator popover, landing navbar/FAQ | Yes (admin, indicator) | No |
| `animate-spin` 14, `animate-pulse` 5, **`animate-ping` 2** | Connection indicator (`app/layout.tsx:52`, global) pings and pulses on every screen | **Yes** | No |
| Custom keyframes | `animate-fade-in` on every auth route change (`app/auth/template.tsx:10`); `animate-marquee` (landing `sectors-marquee`) | Auth | No |
| `motion` (Framer) | `ScrollReveal` ×9 wrappers on landing (`app/page.tsx:31-71`), no `useReducedMotion`; `be-ui-otp-input` (unused) | No | ScrollReveal: no |
| Theme switch | `next-themes` `disableTransitionOnChange={false}` (`providers.tsx:30`), so every `transition-*` animates on toggle | Yes | – |
| `@tsparticles/react`, `@tsparticles/slim`, `recharts` | Dependencies with **0 imports** | – | – |
| WebGL | `liquid-sculpture-hero` only (unused) | – | Yes (internal) |

---

## 8. Copy and terminology

### 8a. Competing terms (approximate counts in user-visible strings: all areas / workspace)

| Concept | Terms (all / workspace) | Representative conflict |
|---|---|---|
| The thing being assessed | **order 142 / 99**, **deal 37 / 32**, purchase order/PO 21 / 3 | Nav "Deals Pipeline" (`app-sidebar.tsx:53`) vs model "Orders" (`lib/p7-model.ts:33`). Header CTA "Evaluate New Order" (`auth-shell.tsx:170`). Admin "Orders Management" with column "View Deal" (`admin/orders:312`) and search "PO number, customer, or deal ID..." (`:266`). |
| The result | evaluation/evaluate 91 / 81, decision 30 / 22, recommendation 15 / 15, assessment 9 / 6, verdict 9 / 5 | Table headers "Engine Verdict" and "Decision Status" side by side (`deals/page.tsx:154`). DecisionGuide "Clarify before relying on this assessment" (`decision-guide.tsx:29`). |
| Exploring alternatives | sandbox 23 / 17, what-if 17 / 16, scenario 14 / 13, negotiate 14 / 7, simulate 13 / 1, fork 39 (only `preparation-workspace.tsx`) | Route `/negotiate` is linked as "Open what-if and approval" (`deals/[id]:216`). Stepper step "5. Approve". Raw "Fork {id}" rows (`preparation-workspace.tsx:271`). |
| Counterparty | customer 68 / 34, buyer 1 (`deals/[id]:316`), counterparty 2 | – |
| Who gets paid | supplier 38 / 13, payee 17 / 17, vendor 3 (landing) | Nav "Payees & Suppliers" vs model "Payees" vs page "Payees & Suppliers" |
| Limits | reserve/floor 40 / 24, policy 27 / 26, risk 18 / 12, constraint 7 / 4, guardrail 1 | Route `/risk-constraints` titled "Risk and constraints". Deals KPI "Default cash reserve" + chip "Policy". Overview "Policy Reserve Floor". |
| The account holder | business 62 / 42, **tenant 40 (35 in admin)**, company 12, organization 12, workspace 2 | Admin "Tenant Namespaces", "Tenant Organization". Settings "Company profile". |
| People | user 26, member 9 | "User Management" (nav) vs "Users" (model) |

### 8b. Capitalization

| Surface | Count | Examples |
|---|---|---|
| Workspace headings | **Sentence 51 vs Title 9** | Title: "Deals Pipeline" (`deals/page.tsx:86`), "Evaluate New Order" (`deals/new:200`), "Cash & Financing" (`deals/sources:60`), "Order Review & Evaluation" (`deals/[id]:190`), "Order Feasibility & Delay Sensitivity Stress Test" (`overview:629`). Sentence: "Source documents" (`documents:158`), "Decision guide". |
| Admin headings | **Title 11 vs Sentence 3** | "Cryptographic Append-Only Audit Stream" (`admin/logs:121`) vs "System status" (`admin/system:65`) |
| Nav | Model sentence case (`"New order"`, `"Cash flow"`, `"Audit log"`) overridden by Title Case (`"Cash Flow Baseline"`, `"Operation Audit Log"`, `"User Management"`). Admin nav: "Tenant Namespaces", "Cluster Audit Log", "System & Nodes", "Engine Invariants". | `app-sidebar.tsx:18-25,51-64` |
| Buttons/tabs/chips | Title: "Review Recommendation" (`deals:134`), "View All" (`overview:830`), "Clear Filters" (`admin/orders:287`), tabs "All Orders / Needs Action / Closed / Infeasible" (`lib/pipeline-model.ts:10-11`), chip "Action Required" / "N Need Review" (`deals:119-120`). Sentence: "Confirm and evaluate", "Load more customers", "Retry". **Same page:** "Sign Up" (`auth/signin/page.tsx:73`) vs "Sign up" (`:149`); "Log in" (`:160`) vs "Signing in…" vs "Sign in again" (`p7/common.tsx:93`). | – |

### 8c. Ellipsis

`…` 46 occurrences in 24 files vs `...` 11 in 8 files: admin ×9 (`admin/logs:173`, `admin/page:222` "Verifying...", `admin/system:76` "Checking..."), `auth/signup` 1, `connection-indicator` 1.

### 8d. Developer-facing copy shown to users

| Copy | Location |
|---|---|
| "(integer minor units)" field labels | `deals/new/page.tsx:255`, `deals/sources/page.tsx:83-84`, `manual-order-inputs.tsx:13,14,22`, `cash-event-actions.tsx:46` ("positive whole minor units") |
| Raw minor-unit values | `deals/new/page.tsx:276` ("Opening cash: {opening_cash_minor} minor units"), `financing-screen.tsx:20` / `risk-screen.tsx:18` fallback, `preparation-workspace.tsx:308` ("Profit ({currency} minor units)"), `deal-evaluation-inspector.tsx:686`, `admin/orders/page.tsx:245` ("Integer minor units stored") |
| Raw IDs, hashes, versions | "Fork {fork.id}" (`preparation-workspace.tsx:271`), "revision {m.revision}" (`:278`), "Bound to financial revision…, input version…, calculator…" and "Bundle hash" (`bundle-review.tsx:12-13`), row/previous hash (`audit-screen.tsx:31-32`), "revision {input_version}" and `status.replaceAll("_"," ")` (`deals/[id]/page.tsx:227`), mono 10px `order.id` / `userId` / `tenant.id` (`admin/orders:335`, `admin/users:492`, `admin/tenants:261`) |
| "Raw JSON" tab | `deal-evaluation-inspector.tsx:151` |
| "{n} customers loaded." | `collection-pages.tsx` at HEAD **[WT changed]** |
| System and implementation language | "The server enforces this on every request." (`p7/common.tsx:99`); "Organized from the current deterministic evaluation…" (`decision-guide.tsx:14`); "No purchase orders recorded in the database yet." (`admin/orders:326`); "Verify DB Health" (`admin/page:222`); "ADM"/"USR" 9px (`app-sidebar.tsx:353`) |
| Dropped copy | `PageFrame` ignores `intro`, so 8 screens lose their explanatory paragraph (`p7/common.tsx:24`) |

---

## Consolidation recommendations

Principle: keep `web/components/ui/*` as the single primitive layer (shadcn/Radix). Map every `:root`/`.dark` variable into `@theme` (in progress in the WT), and add semantic status tokens (success, warning, danger, info; also in the WT). Then delete the `html.dark .bg-[#…]` `!important` override block, which only exists to rescue raw hex classes. Note that the new `web/components/system/*` files (WT) overlap several roles below. Pick one layer per role rather than adding a third.

| Role | Canonical implementation to keep | Pages that diverge |
|---|---|---|
| Color tokens | `globals.css` semantic tokens (`bg-background`, `bg-card`, `border-border`, `text-foreground`, `text-muted-foreground`, `bg-primary`, `text-destructive`, + status tokens). Replace `#E8E6E1`→`border`, `#1E2021`/`#1A1A1A`→`foreground`, `#737373`/`#525252`/`#526975`→`muted-foreground`, `#FAF9F7`/`#F4F2ED`/`#ECEAE4`→`muted`/`secondary`, `bg-white`→`bg-card`. Drop the unused `brand-*`/`settle-*` aliases from product UI. | All 32 files using `#1E2021`; admin ×8, P7 screens, `deals/*`, `overview`, `auth/*`, inspector, stepper, sidebar |
| Page shell | `AuthShell` (`components/layout/auth-shell.tsx`). Extract its header into a shared `AppHeader` and render one admin layout shell from `app/admin/layout.tsx`. Use one `AuthCardLayout` for the auth pages. | `app/admin/*/page.tsx` ×8 (copied shell), `auth/signin`, `signup`, `forgot-password`, `accept-invitation` |
| Page container | `.orderfit-page-main` + `.orderfit-page-container` (already defined, 0 uses), or a `<Page>` component | Every page hand-writing `px-4 sm:px-6 lg:px-8` and `max-w-[1560px]`; admin and `deals/new` use the narrower variant |
| Page title block | `PageFrame` (`components/p7/common.tsx:24`). Render `intro`, add `actions` and `back` slots, one h1 size. | `deals/page`, `overview`, `deals/sources`, `deals/new`, `deals/[id]` (×2 h1), `deals/[id]/documents`, `preparation-workspace`, `unavailable-notice`, admin ×9 |
| Card/panel | `ui/card.tsx` restyled to the deals card look (`deals/page.tsx:22`: border, shadow-xs, one radius) | `panel` consts ×3 (`p7/common`, `approval/ui`, `preparation-workspace`), inline `rounded-2xl border bg-white p-5` (`deals/sources`, `deals/[id]`, `documents`), admin cards, `DecisionGuide` |
| Stat tile | Extract from `deals/page.tsx:22-24` (CARD/LABEL/VALUE) into `StatTile` on `ui/card`, with tabular money | `overview` KPI and mini tiles, `admin/page`, `admin/orders`, inspector summary |
| Data table | `ui/table.tsx` + deals header style (`deals/page.tsx:153`, but at ≥12px), right-aligned tabular money | Admin ×5, `cash-flow-screen`, `customers-screen`, `bundle-review`, `preparation-workspace` |
| Filter/search | Deals search (`deals/page.tsx:145`) rebuilt on `ui/input` | Admin logs, orders, tenants, users |
| Tabs/segmented | `ui/tabs.tsx` (Radix roving focus), styled like the `deals/page.tsx:139` pill tabs | `overview` ×2, inspector ×2, `settings-screen` |
| Buttons | `ui/button.tsx` variants: default (primary), outline, ghost, destructive, link, icon sizes. Decide whether primary is `--primary` pine or near-black, once. | P7 `button`/`primary`/`danger` consts (3 files), `deals/sources` `button`, `bank-hold`, admin inline, auth inline, `deals/[id]`, `documents` (`bg-black`), `error`/`not-found`, overview retry |
| Inputs | `ui/input`, `ui/select`, `ui/textarea`, `ui/checkbox` | `field`/`fieldClass`/`input` consts (5 definitions), admin inputs, auth inputs, AuthShell business switcher, 8 native checkboxes |
| Field wrapper | `ui/form.tsx` (`FormItem`/`FormLabel`/`FormDescription`/`FormMessage`), or a non-RHF `Field` with the same slots and `aria-describedby` | P7 forms, `manual-order-inputs`, `deals/new`, `deals/sources`, admin modals, auth |
| Badge/verdict | `ui/badge.tsx` with tone variants and **one verdict label map** (`lib/pipeline-model.ts` `verdictOf`) used everywhere. Keep `ProvenanceBadge` as a thin wrapper. | `deals/page` `TONE`, inspector `decisionStyles`, `overview` `statusBadge`/`recentStatusBadge`, admin role and status chips, `payees` `STATUS_STYLE` |
| Alert | `Alert` (`p7/common.tsx:37`) promoted to `ui/alert` with tokens | 18 inline `bg-red-50 … text-red-800` boxes, overview notices, AuthShell error |
| Toast | Sonner (`ui/sonner.tsx`, already mounted) | Admin `page`, `logs`, `orders`, `tenants` hand-rolled toasts |
| Dialog/popover/tooltip | `ui/dialog`, `ui/dropdown-menu`, `ui/tooltip` | `admin/users` ×3 modals, `notification-bell` popover, `connection-indicator` popover, `title=` tooltips |
| Empty state | New `EmptyState` (message + optional CTA) based on the `deals/page.tsx:157` pattern | `customers`, `payees`, `audit`, admin ×4, `overview:842`, `preparation-workspace:304` |
| Error state | `QueryError` (`p7/common.tsx:90`) in-page; `error.tsx` for route boundaries | `overview` error block, `deals/page` error, AuthShell error, `CollectionPages` inline alert, `deals/[id]` `showUnavailable` |
| Loading | `ui/skeleton.tsx` + `Loading` | Border spinners (`auth-shell:126`, `accept-invitation:70`), admin `RefreshCw` spin rows |
| Pagination | `CollectionPages` load-more (cursor API) | `deals/page` offset pager; admin pages with no paging |
| Stepper | `DealsWorkflowStepper`. Point steps 2–3 at live screens, render it on `deals/new`, show a compact form below `lg`. | `deals/new` (missing) |
| Money/date/percent | `formatMinor` (`lib/approval-model.ts:9`) behind one `<Money>` (tabular, no "minor units" fallback). One `formatDate`/`formatDateTime` replacing both `when()` copies and raw ISO strings. One `formatPercent`. Replace the `DollarSign` icon. | `deals/page`, `overview`, `financing-screen`, `risk-screen`, `deals/new`, `customers`, admin |
| Charts | Either adopt `recharts` (installed) or remove the dependency. Fix the series/legend color mismatch on the overview chart. | `overview/page.tsx:519-580` |
| Icons | lucide, `size-4` default and `size-3.5` dense | `h-4 w-4` (`deals/[id]`), `w-3.5 h-3.5` (`documents`), glyph `→`/`✓`/`•` |
| Typography | `font-sans` only (delete the `display`/`heading`/`radio-grotesk`/`beausite`/`neue-machina` aliases), `font-mono` for IDs. A ≥12px floor. A documented scale (xs/sm/base/lg/xl/2xl). Drop the Playfair import if the single hero line goes. | `text-[9px]`/`[10px]`/`[11px]` in 24 files; landing arbitraries |
| Motion | Scope Lenis, GSAP and the scroll progress bar to the landing page instead of `Providers`. Guard `ScrollReveal`, the indicator ping/pulse and theme transitions with reduced motion. Remove `@tsparticles/*`. | `providers.tsx`, `connection-indicator.tsx`, `scroll-reveal.tsx` |
| Copy | One glossary (order, evaluation, what-if, customer, payee/supplier, reserve, business) and sentence case everywhere. Remove "minor units", raw IDs and "Raw JSON" from user surfaces. Use `…` consistently. | Nav maps ×3, admin labels, P7 forms, inspector, `preparation-workspace` |
