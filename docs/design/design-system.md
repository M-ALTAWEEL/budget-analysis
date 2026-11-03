# Design: the ibudgi design system

Status: being built (redesign PR 1 of 3: foundations) · Owner: Mouhammed Altaweel · November 2026

The approved previews: colours https://claude.ai/artifact/PxVZGoHBDwFXk4oNAhoWkZ and style
https://claude.ai/artifact/R5NLmjyo21R1ULwQ1cy3Py (private to the owner).

## 1. Principles

1. **Quiet and white.** Money stress is the problem, so the page stays calm: a white page,
   white cards held by a hairline and a soft shadow, one main colour.
2. **The logo leads.** Indigo is the main colour; coral, the logo's coin, is a small highlight.
3. **Colour means something.** Green, marigold and berry say healthy, careful and overspent,
   and never change with the accent the student picks.
4. **Shapes from the logo.** Pill bars, rounded cards, a round "today" marker.
5. **Glass only on what floats** (the website's phone dock and menus). The app's dock is solid,
   with a shadow.
6. **Motion explains, and stops when asked.** Short, eased movement; nothing moves with
   reduced motion.

## 2. Tokens

One set of names on both platforms: `globals.css` (`--color-*`, Tailwind classes such as
`bg-brand`) and `mobile/src/theme/ThemeProvider.tsx` (`colors.brand`), plus
`mobile/src/theme/tokens.ts` for shapes and motion.

| Token | Light | Dark | Use |
|---|---|---|---|
| paper | `#ffffff` | `#0f1020` | the page |
| surface | `#ffffff` | `#181a33` | cards |
| sunken | `#f6f6fb` | `#13152b` | wells inside a card (chart panel, search box) |
| ink | `#15172a` | `#ecedf7` | text |
| muted | `#5e6178` | `#9a9dba` | secondary text |
| line | `#e4e4f0` | `#2a2d4d` | hairlines |
| brand | `#3a36db` | `#8b88ff` | buttons, links, selection (changes with the accent) |
| brand-dark / brand-soft | `#2d29b8` / `#ecebfc` | `#a9a7ff` / `#23245a` | hover, tinted backgrounds |
| on-brand | `#ffffff` | `#0f1020` | text on brand |
| coral / coral-ink | `#ff7a59` / `#b8421f` | `#ff7a59` / `#ff9c82` | small highlights only |
| ok / ok-soft | `#1e7a55` / `#e3f4ec` | `#5cc4a0` / `#1c3a31` | healthy, money in, done |
| marigold (+ ink, soft) | `#c98516` | `#e5a53c` | caution |
| berry (+ soft) | `#b23c63` | `#ef7fa3` | overspent, owed |
| cell0 / lv1 | `#e5e5ef` / `#b7e0cb` | `#24274a` / `#2b5a48` | the year chart |

Accents (Settings > Colour) change only the brand family: indigo (default), pine, ocean,
plum, graphite. Every text colour reaches 4.5:1 on paper, surface and sunken in both themes.

**Where coral is allowed:** the "today" marker and ring, a new-item dot, the logo. Never a
warning, an error or a large fill.

**Shapes:** card 24, tile 18, control (buttons, fields) 14, bars full pills.
**Shadows:** `card` (a soft indigo-tinted lift) and `float` (dock, menus, sheets), each with a
dark version. **Motion:** `ease-smooth` `cubic-bezier(0.2, 0.8, 0.2, 1)` and `ease-spring`
`cubic-bezier(0.34, 1.56, 0.64, 1)`.

**Type:** Geist for headings, text and numbers (amounts use even-width digits, `.tabular`);
Readex Pro for Arabic.

## 3. Still to come

- PR 2: the shared building blocks (Card, StatusChip, Segmented, ProgressPill, StatTile,
  IconButton), the navigation shell, the search menu, the Overview as a bento grid, and the
  year chart in the new style.
- PR 3: every other screen.
