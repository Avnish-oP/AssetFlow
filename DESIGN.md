# DESIGN.md — AssetFlow visual language

Enterprise ops console with a soft pinboard surface. Brand is **ink + rosewood** — never green.

---

## Brand & status

| Role | Light | Dark |
|---|---|---|
| Board bg | `#F0EFED` | `#0C0B0A` |
| Surface (pins) | `#FFFFFF` | `#161412` |
| Brand (CTA / active) | `#B33D2F` | `#E07A6C` |
| Brand wash | `#F8E9E6` | `#3A221E` |
| Positive status | blue (`#1D4E78`) | blue (`#7AABD4`) |
| Warning | amber | amber |
| Danger / conflict | red | red |

- Primary buttons: `bg-brand text-brand-fg` (pill)
- Active nav: `bg-brand-bg text-brand` + 3px brand rail
- Available / verified / resolved pills: **blue**, not brand red
- Legacy `text-green` / `bg-green` utilities alias to brand — prefer `text-brand` / `bg-brand`

---

## Typography

- UI: **Outfit**
- Titles: **Fraunces** (`font-display`)
- Headings are ink, not brand-colored

---

## Layout

- Fixed 260px sidebar, soft pin cards (`card-surface`), dashboard masonry `pin-board`
- Soft board washes: mist / sky / blush / sand — no sage green

---

## Don't

- Green brand accents
- Purple gradients
- Cream + terracotta stacks
- Neon glow / heavy multi-shadow
