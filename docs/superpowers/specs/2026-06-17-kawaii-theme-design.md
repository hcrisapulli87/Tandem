# Tandem — "Sugar Pop" Kawaii Theme

## Context

Tandem currently ships a dark, neutral theme. Harrison's partner (the second user)
wants the app to feel **cutesy**, in the Hello Kitty vibe. This is a **restyle only** —
no changes to layout, data, auth, or behaviour. The structure (Today = two person
sections; My List = add/manage) stays exactly as-is.

## Locked decisions

- **Direction:** "Sugar Pop" — light, airy, pastel. (Chosen over a classic white+red
  "bow" look and a dark "midnight kawaii" look, via visual mockups.)
- **No character art.** Hello Kitty is Sanrio's trademarked character, so we evoke the
  *feeling* through palette + shape + type only — explicitly **no mascot/logo**. This
  sidesteps the IP question and ages better. (Harrison: "just having the theme and its
  colours is enough".)
- **Cuteness sources:** pastel pink→lavender palette, big rounded cards, the rounded
  *Baloo 2* display font for the wordmark/headings, heart-shaped check ticks, pill-shaped
  badges/nav, and soft pink shadows.

## Design tokens (palette)

| Token | Value | Use |
|---|---|---|
| `--bg` | `#fff6fb` (+ soft pink→lavender gradient) | page background |
| `--surface` | `#ffffff` | cards |
| `--surface-2` | `#fff2f9` | checklist rows |
| `--border` / `--border-strong` | `#ffd9ec` / `#ffc6e2` | hairlines, checkbox outline |
| `--text` / `--muted` | `#6a5560` / `#bfa6b5` | warm plum-gray text |
| `--accent` / `--accent-strong` | `#ff86c2` / `#ff5fae` | primary pink |
| `--accent-2` | `#b9a7ff` | lavender (gradients, one-off tag) |
| `--danger` | `#f0727f` | delete |
| Fonts | `Baloo 2` (display), `Nunito` (body) | Google Fonts |

## Scope — files touched

- `src/styles/theme.css` — repalette `:root`, light `color-scheme`, gradient body,
  rounded cards, gradient primary buttons, pill nav (`.navlink--active`), gradient `YOU`
  badge, **heart checkbox** (`.checkbox` / `.checkbox--on`), pink streak dots, Baloo 2
  headings + lowercase `tandem ♥` wordmark.
- `src/components/ChecklistItem.tsx` — tick glyph `✓` → `♥` (done) / `♡` (not done).
- `src/components/StreakBadge.tsx` — `🔥` → `⭐` to match the soft vibe.
- `index.html` — `theme-color` to light pink; iOS status-bar style `black-translucent` →
  `default` (dark text on light).
- `vite.config.ts` — PWA manifest `theme_color` / `background_color` to light.
- App icon (`public/favicon.svg` + regenerated PWA/apple icons) — pink heart, so the
  home-screen icon matches the new look.

## Out of scope

No layout changes, no new screens, no behavioural/auth/data changes. Streak logic,
RLS, realtime, and the two-person model are untouched.

## Verification

`npm run build` + `npm test` green; render the real login screen to confirm the theme
applies in the actual app (not just the mockup); visually confirm Today/My List via the
restyled components.
