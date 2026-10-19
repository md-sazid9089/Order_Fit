# Consistency review

Workspace pages use the same semantic tokens for background, card, foreground, muted, primary, status, border, and focus states. Page headers, panels, status badges, monetary input, alert/error/empty states, and the order journey are shared primitives.

The sidebar active state uses `bg-primary text-primary-foreground`; inactive states use muted foreground and semantic hover states. Settings tabs use the same selected pair. The pipeline current-page badge now also uses `text-primary-foreground`, fixing the remaining light-mode selected-state mismatch.

Landing pages retain their separate branded composition, while their audited legend and footer text meet the corrected light-mode contrast target.
