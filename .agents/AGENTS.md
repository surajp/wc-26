# Soccer World Cup 2026 — Project Rules for Agentic Sessions

## Project Identity

- **Name:** FIFA World Cup 2026 Tracker & Predictor
- **Live URL:** https://soccerworldcup.xyz
- **GitHub Remote:** `git@suraj.github.com:surajp/wc-26.git` (SSH alias `suraj.github.com`)
- **Tech Stack:** Vanilla HTML + CSS + JavaScript, no framework, no build step
- **Hosting:** GitHub Pages, custom domain via CNAME file

---

## Version Control

- **VCS:** Jujutsu (`jj`) — NOT git directly. Always use `jj` commands.
- **Workflow:**
  - Edit files normally (jj auto-tracks working copy)
  - Commit: `jj describe -m "message"`
  - Publish commit: `jj bookmark move main --to @ && jj git push --bookmark main`
  - Tag a release: `jj tag set v<X.Y> -r main` then `jj git export && git --git-dir=.git push origin v<X.Y>`
- **Never** run `git add`, `git commit`, or `git push` directly — jj manages this
- **Underlying git dir:** `/Users/surajpillai/projects/gemini-cli/soccer-world-cup/.git`
- **Current release:** `v1.0` tagged at commit `81a79aaf`

---

## Project File Map

| File | Role |
|------|------|
| `index.html` | App shell — all modals, nav, header, tab panels |
| `app.js` | All logic: data loading, rendering, predictions, bracket, modals |
| `style.css` | Vanilla CSS — design tokens, light/dark themes, animations, responsive |
| `worldcup.json` | Baseline fixture data (read-only source of truth, 104 matches) |
| `world_cup_banner.jpg` | Hero header background image |
| `CNAME` | `soccerworldcup.xyz` — do not edit |

---

## Architecture

### Data Flow
1. `fetchTournamentData()` loads `worldcup.json` → assigns `m.num = m.num || (idx+1)` for all 104 matches (group stage matches 1–72 lack `num` in JSON)
2. `fetchRemoteUpdates()` polls openfootball remote every 60s for live score updates
3. `processAndRender()` merges base data + user predictions → `activeMatches` → triggers all tab renders
4. `activeMatches` is the single source of truth used by all renderers

### Key Global State
```js
let baseMatches = [];      // raw from worldcup.json (never mutated)
let activeMatches = [];    // base + predictions applied
let predictions = {};      // keyed by match num, persisted to localStorage
let predictorMode = false; // true when any prediction exists
```

### Match Numbering
- Matches 1–72: Group stage (num assigned dynamically at load time by index)
- Matches 73–104: Knockout stage (num present in worldcup.json)
- Match 104 = Final

### Predictions Storage
- Key: `'world_cup_predictions'` in `localStorage`
- Shape: `{ [matchNum]: { ft: [s1, s2], etPlayed?, et?, pPlayed?, p? } }`
- Applied in `processAndRender()` — overwrites `activeMatches[i].score` and sets `isPrediction = true`

---

## UI Structure

### Tabs
- `overview` — live match banner, recent results, top scorers, group standings preview
- `standings` — full group tables
- `matches` — filterable list of all 104 matches with click-to-details
- `bracket` — drag-pannable knockout bracket (matches 73–104)
- `predictor` — score prediction workspace (knockout stage only)

### Modals
- `#predictor-modal` — score prediction form; shows actual score banner + Remove Prediction button when editing
- `#details-modal` — match details: goal timeline, venue, prediction vs actual comparison

### Animation Sequence on Load
1. Soccer ball bounces for **minimum 2 seconds** (Promise.all with 2s timer + data fetch)
2. Ball launches off-screen right with arc (`.loader-exiting` CSS class)
3. Loader fades out over 700ms
4. `#main-content-inner` slides up with `.page-revealed` class

---

## Design Tokens

- **Accent green:** `var(--accent-green)` = `#10b981`
- **Accent gold:** `var(--accent-gold)` = `#f59e0b`
- **Danger red:** `var(--danger)` = `#ef4444`
- **Fonts:** `Outfit` (headers, `--font-header`), `Inter` (body, `--font-primary`)
- **Themes:** dark by default; light mode via `data-theme="light"` on `<html>`; toggled by `#theme-toggle`

---

## Responsive Breakpoints

| Breakpoint | Behaviour |
|-----------|-----------|
| `≤ 480px` | Tab labels hidden (icon-only nav), subtitle hidden, compressed header |
| `≤ 640px` | 2-col hero stats, stacked modals as bottom sheet, single-col predictor cards |
| `641–768px` | Tablet adjustments, 2-col stats, narrower modals |
| `≤ 900px` | Dashboard grid collapses to single column |

---

## Important Conventions

- **Do not use frameworks** — this is intentionally vanilla JS/CSS/HTML
- **Do not introduce a build step** — files are served directly via GitHub Pages
- **Match `num` is always an integer** — use `parseInt()` when reading from DOM/strings
- **`baseMatches` is never mutated** — predictions are applied only to `activeMatches` copies
- **`processAndRender()` is the re-render entry point** — call it after any state change (predictions, live data)
- **Always call `savePredictions()` after mutating `predictions`**
- **Tab animations:** `.tab-panel` uses `animation: tabSlideIn` — adding `.active` triggers it via CSS
- **Predictor mode** only activates for knockout matches (num ≥ 73)

---

## Known Nuances

- The SSH remote alias is `suraj.github.com` (not `github.com`) — this is intentional per SSH config
- `worldcup.json` group stage matches (1–72) have no `"num"` field — the app assigns it at runtime
- `m.isPrediction = true` is set on `activeMatches` entries that have user predictions applied
- The bracket uses CSS drag-pan (no library) — `setupBracketDragPanning()` in app.js
- The predictor sidebar is `position: sticky` on desktop but `position: static` on mobile (≤ 640px)
