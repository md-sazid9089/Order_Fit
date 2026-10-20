# Release coverage

| Coverage | Evidence |
|---|---|
| Unit contracts | 131 passing Node tests: money, session scope, errors, CSP, navigation, duplicate review, and deterministic-engine boundaries. |
| Browser failure matrix | Offline, timeout, 401, 403, 404, 409, 422, 429, 5xx, non-JSON, malformed response, and recovery. |
| Responsive | Workspace routes at 320, 390, 430, 600, 768, 1024, 1280, 1440, 1920, and 2560 px. |
| Accessibility | Axe checks in light and dark mode, selected navigation, settings tabs, keyboard-reachable controls. |
| Roles | Owner, viewer, auditor, commercial lead, risk officer, signed-out, ordinary owner, and platform admin guard. |
| Workflows | Order lifecycle, document upload, duplicate cash review, roles/invitations, admin, CSP, pagination, passkeys, and pipeline performance. |

Evidence is synthetic and stored under `evidence/`; traces that could contain session data are excluded.
