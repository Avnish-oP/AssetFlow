# DESIGN.md — AssetFlow visual language

Derived from the team's Excalidraw mockups (10 screens, dark "ops console" style). The goal isn't novelty — it's that four people's screens look like one product. If you're about to pick a color or spacing value that isn't below, don't. Ask instead of guessing.

This is a hand-written contract, not a generated style guide — treat it the same way as `AGENT.md`'s file-ownership rule: deviations cause visible inconsistency by hour 5, so it's cheaper to follow it now than to restyle later.

---

## 1. Design philosophy

This is an **internal operations tool**, not a marketing site. Every screen answers "what needs my attention right now" (overdue returns, conflicts, pending approvals) before anything else. Priorities, in order:

1. **Status is always legible at a glance** — color-coded pills, not just text.
2. **Conflicts are loud, everything else is quiet** — the double-allocation block and booking overlap are the two moments the UI should visually shout; routine CRUD stays calm and dense.
3. **Density over whitespace** — this is a table-and-form-heavy ERP used by people all day, not a landing page. Don't pad it like one.
4. **Same shell, every screen** — persistent left sidebar, same nav order, same header pattern, on all 10 screens. Nobody re-derives the shell per screen.

---

## 2. Color tokens

Dark theme only for the hackathon (no light mode — cut for time).

```css
--bg:              #0A0A0B   /* app background */
--surface:         #131316   /* cards, panels */
--surface-raised:  #1B1B1F   /* modals, dropdowns */
--border:          #2A2A2E   /* card/table borders — always 1px, always this color */
--border-strong:   #3A3A3F   /* focused inputs, active nav item */

--text-primary:    #F5F5F5
--text-secondary:  #A1A1AA
--text-muted:      #6B6B70

--accent-green:    #22C55E   /* Active, Verified, Available, Resolved, success actions */
--accent-green-bg: #16311F   /* success banner/badge background */
--accent-red:      #EF4444   /* Blocked, Overdue, Missing, conflict states, destructive actions */
--accent-red-bg:   #3A1A1A   /* blocked/conflict banner background */
--accent-amber:    #F59E0B   /* Pending, Damaged, warnings, "flagged" states */
--accent-amber-bg: #332405   /* warning banner background */
--accent-blue:     #3B82F6   /* Booked/confirmed slots, informational, links */
--accent-blue-bg:  #16233F
```

Rule: a color never appears without its `-bg` pair when used as a banner or badge — solid text-color-only badges read as noise on a dark background at this density.

## 3. Typography

- UI font: system sans stack (`-apple-system, Inter, Segoe UI, sans-serif`) — don't add a webfont, not worth the time budget.
- Scale: `12px` (table cells, meta text) / `14px` (body, labels, inputs) / `16px` (section headers) / `20px` (screen title) / `28px` (KPI numbers).
- Weight: `600` for screen titles and KPI numbers, `500` for section headers, `400` everywhere else. No `700+` anywhere — this isn't a marketing page.

## 4. Layout

- **Sidebar:** fixed, 220px, `--surface` background, `--border` right edge. Same 10 items, same order, on every screen: Dashboard, Organization Setup, Assets, Allocation & Transfer, Resource Booking, Maintenance, Audit, Reports, Notifications. Active item: `--border-strong` background + `--accent-green` left border, 3px.
- **Content area:** `--bg` background, 24px padding, max content width unconstrained (this is a desktop-first ops tool).
- **Cards:** `--surface` background, 1px `--border`, 8px radius. That's it — no shadow-heavy elevation, borders do the separating work on a dark background.
- **KPI row (Dashboard):** grid of equal-width cards, big number (28px/600) over a label (12px, `--text-secondary`).

## 5. Component patterns

| Pattern | Rule |
|---|---|
| **Status pill** | Rounded-full, 12px text, colored border + `-bg` fill matching the semantic color (§2). Available/Active/Verified/Resolved = green. Overdue/Missing/Blocked = red. Pending/Damaged/Flagged = amber. Booked/Reserved = blue. |
| **Conflict banner** | Full-width, `--accent-red-bg` fill, `--accent-red` left border (4px), used *only* for: double-allocation block, booking overlap, overdue flags. Reserve red for these — don't reuse it for generic form errors, or the two signature conflict rules stop standing out. |
| **Table** | 1px `--border` row dividers only, no zebra striping (too busy at this density). Header row: `--text-secondary`, 12px, uppercase-off (sentence case, per mockup). |
| **Kanban card (Maintenance)** | Same card token as everywhere else — `--surface` + `--border`. Priority/asset tag as a small pill top-left. Dragging updates status via `PATCH`; the column itself has no separate styling per state, only the cards' pills carry color. |
| **Forms** | Label above input, 14px. Input: `--surface-raised` background, `--border` outline, `--border-strong` on focus (no colored focus ring — this isn't a consumer product). |
| **Empty state** | Centered, `--text-muted` icon + one line of `--text-secondary` text + a single primary action. Every list screen needs one — don't ship a blank table. |

## 6. Screen-specific notes

- **Screen 5 (Allocation):** the red conflict banner + Transfer Request form appearing *inline below it* (not a modal) is the one interaction worth pixel-matching to the mockup exactly — it's the demo's first "wow" moment.
- **Screen 6 (Booking):** render the calendar as a simple vertical time-slot list (per mockup), not a full calendar grid — a real calendar widget is not worth the build time for a 7-hour hackathon, and the mockup already shows the simpler pattern is fine.
- **Screen 7 (Maintenance):** kanban, 5 fixed columns (Pending → Approved → Technician Assigned → In Progress → Resolved), matches the state machine in `README.md` §4.4 exactly — don't let the frontend invent a column the backend doesn't have a status for.
- **Screen 9 (Reports):** two chart cards (bar + line) side by side, list-style stat blocks below — use `recharts`, keep chart color to `--accent-blue` and `--accent-amber` only, don't rainbow it.

## 7. Using Stitch MCP (if connected)

Google Stitch can extract a "Design DNA" (colors/type/layout) from an existing screen and generate new screens from text, and can pull raw HTML/CSS for a screen as a scaffolding reference. Useful ways to use it here without letting it drift from this file:

- Feed it the Excalidraw mockup screenshots first and ask it to extract Design DNA, then **diff that against the tokens in §2** — reconcile any mismatch here, in this file, not by silently accepting whatever Stitch outputs.
- Use `generate_screen_from_text` for a fast first draft of a screen you're stuck on, then hand-rebuild it in Tailwind/shadcn using the tokens above — Stitch's raw HTML/CSS is a reference, not something to ship as-is.
- Don't let Stitch generate its own `DESIGN.md` and use both — this file is the canonical one for this repo; if Stitch produces one, merge anything useful into this file and discard the rest.

## 8. Accessibility (don't skip this even under time pressure)

- Text on `--bg`/`--surface` must hit the pill/badge colors above at their specified contrast — don't lighten status colors for "vibrance," it breaks contrast on dark backgrounds.
- Every interactive element needs a visible focus state (`--border-strong` outline) — this is a keyboard-heavy internal tool.
- Status must never be color-only: pills always carry a text label too (`Available`, not just a green dot).
