# Copilot task board — IKOS

Ready-to-hand-off briefs for the 🐙 (well-scoped) items from [TODO.md](TODO.md).
Each card is **self-contained** — paste the `Prompt` block into Copilot Chat (or into a
GitHub issue and assign `@copilot` if you've enabled the coding agent). Claude keeps the
🧠 items (render pipeline, state model, cross-view sync, convergence).

---

## ‼ Read first — repo rules for every task

- **Source of truth is [`Iterative Knowledge OS.dc.html`](Iterative%20Knowledge%20OS.dc.html)**
  (one file: an HTML template at the top, then one big `<script>` with `class Component`).
  **Also** `support.js` (the runtime). **Never edit `index.html`** — it's a generated bundle.
- After editing, run **`node build.mjs`** to regenerate `index.html`, then it's deployable.
- It's a single ~3000-line component — **use search anchors**, don't reformat unrelated code.
- Match the surrounding style: inline styles as `{{ ... }}` template bindings and JS style objects,
  2-space-ish indentation, terse one-liners. No new build tooling or frameworks.
- State lives in one object (`nodes`, `edges`, `positions`, `chapters`, `books`, `notes`,
  `mastery`) and persists to `localStorage` key `ikos_state_v1`. Every view reads/writes it.
- Test by `npx serve .` and opening the app; type `reset` in the terminal for a clean seed.

Priority order below is roughly high→low leverage. **T1–T2 are quick wins; do them first.**

---

## T1 · `package.json` with scripts  ·  _≈15 min_

**Goal:** one-command build/dev. **Files:** new `package.json` at repo root.

Add `build` → `node build.mjs`, `dev` → `npx serve .`, `check` → validate the bundle
(that `index.html`'s template parses and its inline script passes `node --check`). No deps.

> **Prompt:** Create a root `package.json` for a static, no-dependency site. Scripts:
> `"build": "node build.mjs"`, `"dev": "npx serve ."`, `"check": "node build.mjs"`.
> Set `"name": "ikos"`, `"private": true`, `"type": "module"`, `"license": "SEE COPYRIGHT"`.
> No dependencies. Don't add a bundler or framework.

---

## T2 · CI: build must stay green  ·  _≈20 min_

**Goal:** every push proves the bundle rebuilds. **Files:** new `.github/workflows/ci.yml`.

> **Prompt:** Add a GitHub Actions workflow `.github/workflows/ci.yml` that runs on push and
> pull_request. Single job on `ubuntu-latest`, `actions/setup-node@v4` (node 20), steps:
> `node build.mjs`, then verify the git working tree has no *unexpected* changes to `index.html`
> other than the regenerated bundle (i.e. `node build.mjs` runs without error and exits 0).
> Keep it minimal, no caching needed.

---

## T3 · Mobile: responsive units pass  ·  _≈2–3 h_

**Goal:** the app stops overflowing on phones. **File:** `Iterative Knowledge OS.dc.html`
(the top-of-file `<style>`/`<helmet>` region and inline `style="..."` bindings).

**Where:** search the styles for fixed `width:`, `min-width:`, `height:` in px on top-level
panels/rails/modals. Convert to `clamp()` / `%` / `min()` / `dvh`/`dvw` where they cause
horizontal overflow < 720px. **Don't** touch the graph/orbit canvas sizing logic (that's
measured in JS — leave `measure()`/`graphScale` alone).

**Acceptance:** at 375×812 (iPhone) there is no horizontal page scroll; every panel fits or
scrolls *inside itself*; text stays ≥ 14px.

> **Prompt:** In `Iterative Knowledge OS.dc.html`, find fixed-pixel `width`/`min-width` on the
> top-level layout panels, side rails, and modal/card containers that cause horizontal overflow
> on screens narrower than 720px, and convert them to responsive units (`clamp()`, `%`, `min()`,
> `dvh`). Do not change the graph/orbit canvas measurement code (`measure()`, `graphScale`,
> `worldW/worldH`) or any three.js. Verify no horizontal page scroll at 375px wide. Run
> `node build.mjs` when done.

---

## T4 · Mobile: swipeable tabbed layout under 720px  ·  _≈3–4 h_

**Goal:** the 4-up Split becomes one view at a time with a bottom tab bar on phones.
**File:** `Iterative Knowledge OS.dc.html`.

**Where:** the view-mode buttons render around the `modeBtn('book'…)/('graph')/('split')/('orbit')`
row (search `modeBtn(`). The app already has a single-view mode per renderer — reuse it.

**Task:** under a `max-width: 720px` media query (or a JS width check via the existing
`ResizeObserver`/`measure`), hide the Split option and render a fixed **bottom tab bar**
(Book · Graph · ▶ · ◉) that switches the active single view. Support horizontal swipe between
tabs (pointer events; respect the graph/orbit's own drag — only swipe from the tab bar or a top
gutter).

**Acceptance:** on a phone you see one full-bleed view + a bottom tab bar; tapping/swiping
switches views; desktop layout is unchanged ≥ 720px.

> **Prompt:** In `Iterative Knowledge OS.dc.html`, add a mobile layout (≤ 720px) where instead of
> the Split 4-up, only one renderer shows at a time with a fixed bottom tab bar to switch between
> Book / Graph / Terminal / Orbit. Reuse the existing per-view single modes (see the `modeBtn(...)`
> row). Add left/right swipe to change tabs without stealing the graph/orbit canvas drag. Leave the
> desktop (≥ 720px) layout unchanged. Run `node build.mjs` when done.

---

## T5 · Mobile: touch ergonomics + reduced motion  ·  _≈1–2 h_

**File:** `Iterative Knowledge OS.dc.html`.

- Tap targets (buttons, mode toggles, terminal send) ≥ 44×44px on touch.
- Terminal input `font-size: 16px` on mobile (prevents iOS focus-zoom). Search the terminal
  input style (near `setTermInputRef`).
- Wrap animation-heavy behaviour in `@media (prefers-reduced-motion: reduce)`: dampen orbit
  auto-spin, disable the page-flip transition, and skip ambient comet spawns. For JS-driven
  motion (orbit), read `window.matchMedia('(prefers-reduced-motion: reduce)').matches` and set
  `orbitSpin` / comet cadence accordingly.

> **Prompt:** In `Iterative Knowledge OS.dc.html`: (1) ensure interactive controls are ≥ 44px on
> touch; (2) set the terminal input font-size to 16px on mobile to stop iOS zoom-on-focus; (3)
> honor `prefers-reduced-motion` — via CSS for transitions and via
> `matchMedia('(prefers-reduced-motion: reduce)')` in JS to reduce orbit spin and suppress the
> ambient comet spawns in `updateComets`. Run `node build.mjs`.

---

## T6 · Mobile: modals as full-screen sheets  ·  _≈1–2 h_

**File:** `Iterative Knowledge OS.dc.html`.

**Where:** the orbit detail modal (search `orbitDetail` / the card near the `🌱 Grow` button) and
the Modules browser. On ≤ 720px, render these as full-height bottom sheets (slide up, own scroll,
big close target) instead of floating centered cards.

> **Prompt:** In `Iterative Knowledge OS.dc.html`, make the concept detail modal and the Modules
> browser render as full-screen bottom sheets on screens ≤ 720px (slide-up, internal scroll, large
> close button), keeping the desktop floating-card look above 720px. Run `node build.mjs`.

---

## T7 · Terminal: history + autocomplete + inline help  ·  _≈3–4 h_  ⭐

**Goal:** make the REPL feel like the primary way to drive IKOS. **File:** `Iterative Knowledge OS.dc.html`.

**Where:** the terminal input handler and command dispatch (search `termInputEl`, `termOut`,
and the command list — `help`, `add`, `connect`, `install`, `iterate`, `rechapter`, `mode`,
`killswitch`, `reset`).

**Task:** (1) **↑/↓ history** across submitted commands (keep an array in state/instance).
(2) **Tab / ghost-text autocomplete** of the leading command word from the known verb list.
(3) `help <cmd>` prints one-line usage for that command. Keep the existing natural-language path
working (only autocomplete the first token).

**Acceptance:** ↑ recalls prior commands; typing `inst`+Tab → `install`; `help connect` shows usage.

> **Prompt:** In `Iterative Knowledge OS.dc.html`, enhance the terminal REPL: add ↑/↓ command
> history, Tab autocomplete of the first command word from the existing verb list (help, add,
> connect, iterate, modules, install, uninstall, export, rechapter, mode, killswitch, reset), and
> `help <command>` one-line usage. Find the input handler via `termInputEl`/`termOut`. Do not break
> the existing natural-language command path. Run `node build.mjs`.

---

## T8 · Graph: right-click context menu ("orders")  ·  _≈2–3 h_  ⭐

**Goal:** issue orders to a node from the tactical map. **File:** `Iterative Knowledge OS.dc.html`.

**Where:** graph nodes render as positioned elements (search where `s.nodes[id]` maps to node
elements, and `s.positions[id]`). Existing verbs to reuse: reflect (`reflectNode`), connect
(`startLink`/`openLinkPicker`), fold, pin.

**Task:** add `onContextMenu` on a node → a small menu at the cursor with: **Reflect**, **Connect…**,
**Fold**, **Pin**, **Send to Orbit** (switch to orbit view + `openOrbitDetail(id)`). Close on outside
click / Esc. Reuse existing handlers; don't invent new state verbs.

> **Prompt:** In `Iterative Knowledge OS.dc.html`, add a right-click (`onContextMenu`) context menu
> to graph nodes with actions Reflect, Connect…, Fold, Pin, and "Send to Orbit". Wire each to the
> existing methods (`reflectNode`, the link picker, fold, and switching to the orbit view +
> `openOrbitDetail`). Position the menu at the pointer, dismiss on outside-click/Esc, match the
> app's dark card styling. Run `node build.mjs`.

---

## T9 · Tactical HUD chrome + command-tone microcopy  ·  _≈2–3 h_

**File:** `Iterative Knowledge OS.dc.html`.

- **Chrome:** thin corner brackets + a hairline frame around the stage; a small monospace
  telemetry readout in a corner (node count · view · engine badge — some already exist). Muted
  slate + gold + signal-green (already the palette). Subtle, not busy.
- **Microcopy:** make event ticker lines read like orders/telemetry — e.g. an added node →
  `NODE 47 · LINKED`, a mastered node → `COHERENCE ↑`. Find where events are pushed
  (`pushEvent(...)`) and adjust wording only (don't change logic).

> **Prompt:** In `Iterative Knowledge OS.dc.html`, give the main stage an Ender's-Game "command
> tablet" frame: thin corner brackets, a hairline border, and a small monospace telemetry readout
> (view name, node count, engine). Use the existing slate/gold/green palette; keep it subtle and
> reduced-motion friendly. Separately, reword the event ticker strings pushed via `pushEvent(...)`
> to read like terse tactical telemetry, without changing any logic. Run `node build.mjs`.

---

## Cross-repo (needs the EHR codebase — not in this repo)

These are 🐙-sized but live in the **EHR simulator** project, so route them once you're in that repo:

- **Diagnostic `?` tooltips** — each live readout (Langmuir probes, turbulence, …) gets a
  plain-language "what this number means + why it matters for the match number." (TODO §10)
- **Readiness/coherence meter** display component (given a 0–100 value) — the score *calculation*
  stays with Claude (🧠 §7); the meter UI is a clean hand-off.

---

### When a task is done
Run `node build.mjs`, open with `npx serve .`, sanity-check the view you touched, and confirm no
horizontal scroll on mobile tasks. Claude owns the final rebuild/verify + any `index.html`
conflict resolution, so batching several 🐙 changes before a review pass is fine.
