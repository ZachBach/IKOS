# IKOS — Roadmap & TODO

> Working checklist for evolving IKOS from a knowledge/reflection tool into a
> tactical **command environment**. Grouped by theme, ordered roughly by leverage.
> The north star stays the same: **one shared state, many synchronized views.**

## How to use this file

Each item carries a suggested **owner** so work can be split between agents and
usage kept low (see [Dividing work: Claude + Copilot](#dividing-work-claude--copilot)):

- 🧠 **Claude** — cross-cutting, touches the source-of-truth `.dc.html`, three.js /
  render pipeline, state-model or trust changes, anything needing whole-file context.
- 🐙 **Copilot** — well-scoped and local: CSS/responsive, a single self-contained
  component, boilerplate, docs, tests. Cheap to hand off inline.
- 👤 **You** — a product/design decision or an answer only you have.

Status: `[ ]` todo · `[~]` in progress · `[x]` done · `[?]` needs a decision

> ⚠️ **Source of truth is [`Iterative Knowledge OS.dc.html`](Iterative%20Knowledge%20OS.dc.html).**
> After editing it (or `support.js`), run **`node build.mjs`** to regenerate the
> deployable [`index.html`](index.html) bundle, then `vercel deploy`. Never hand-edit `index.html`.

---

## 0 · Repo & housekeeping

- [x] 🧠 `build.mjs` — regenerate `index.html` from source without the proprietary DC bundler
      (support-swap + font-`<helmet>` transplant + gzip re-pack + round-trip self-check).
- [x] 🧠 README + TODO polish.
- [x] 🐙 Add a `.gitignore` (node_modules, `.DS_Store`, `.vercel`, `*.log`, scratch).
- [x] 🧠 Removed the stale duplicate source in `uploads/` (`Iterative Knowledge OS.dc.html`, `support.js`)
      that shadowed the real source. Screenshots kept (unused by README — move to `docs/` if you like).
- [x] 🐙 Add a `package.json` with `"build": "node build.mjs"` and `"dev": "npx serve ."` scripts. → [COPILOT_TASKS.md T1](COPILOT_TASKS.md)
- [x] 🐙 Add a tiny CI check (GitHub Action): `node build.mjs` must run clean and the
      template's inline script must pass `node --check`. → [COPILOT_TASKS.md T2](COPILOT_TASKS.md)

---

## 1 · Orbit — make the planets POP  ✦ *("get schwifty")*

**Shipped this pass** (in `buildOrbital` / the animation loop):
- [x] 🧠 **Ringed gas giants** — mastered planets and hubs (3+ connections) grow tilted,
      shimmering Saturn/Jupiter ring systems (2–3 bands, colour-matched, slow drift).
- [x] 🧠 **Moons / seeds** — each planet spawns orbiting satellite bodies, one per
      connection (capped at 4), on randomly-inclined orbits — "minor nodes as moons."
- [x] 🧠 **Click-to-zoom-into-planet** — clicking a planet flies the camera *into* it
      (rotates it front-and-centre + zooms) before opening the detail modal.
- [x] 🧠 **Cosmic events** — ambient shooting-star/comet streaks across the starfield,
      plus a burst when you dive into a planet.

**Next / polish:**
- [x] 🧠 Wire cosmic events to *state* changes, not just ambient — `on_mastery` fires a gold
      shockwave + comet and the planet **earns its rings live** (`orbitMastered`, no rebuild);
      folding a cluster **implodes** into the abstraction planet (`spawnShock 'implode'`);
      a new reflection arrives with a violet **birth-flash** (`spawnShock 'burst'`).
- [x] 🧠 Ring detail — `makeRingSystem` (shared by `buildOrbital` + the live `orbitMastered`
      upgrade): fine radial banding via a TSL node material on WebGPU (`makeRingMaterial`,
      procedural `sin(d·140)` bands) with a deterministic concentric canvas texture on classic
      WebGL, plus a faint feathered shadow band the rings cast around the planet's ring-plane
      equator (`makeRingShadowTexture`).
- [x] 🧠 Moons carry meaning — each moon now *is* an edge: coloured by relationship type
      (`relColor`), sized by edge weight, and **clickable** — clicking a moon flies the camera
      to the concept on the other end of that edge (decoration → navigation).
- [x] 🧠 Perf guard — decoration budgets in `buildOrbital` shrink with graph size: >120 nodes
      → 2 moons max, >250 → none; >180 → only mastered planets keep rings; >150 → labels only on
      landmarks (mastered/pinned/hubs). At strategic zoom-out the loop culls moons + non-priority
      labels (see [§3 capacity](#3--scale--performance)).

---

## 2 · Mobile-responsive design

- [x] 🐙 Audit fixed pixel widths / `min-width` in the four views; convert to `clamp()` / `%` / `dvh`.
- [x] 🐙 Collapse the 4-up Split layout to a **swipeable single view** with a bottom tab bar
      (Book · Graph · Terminal · Orbit) under ~720px.
- [x] 🐙 Touch targets ≥ 44px; terminal input avoids the iOS zoom-on-focus (font-size ≥ 16px).
- [x] 🧠 Graph/Orbit gestures — `touch-action:none` on the graph stage + orbit canvas so touches
      drive the view, not the page (no scroll capture); **two-finger pinch-zoom** on both (graph
      rescales `graphZoom`, orbit dollies the camera — same clamps as the wheel paths); **pan
      momentum** on the graph (`startPanGlide`, 0.92/frame decay, reduced-motion aware — orbit
      already had rotational momentum); `pointercancel` handled on both. Worth a hands-on pass
      on a real touch device to confirm feel.
- [x] 🐙 Detail modal + Modules browser: full-screen sheets on mobile instead of floating cards.
- [x] 🐙 Respect `prefers-reduced-motion` (dampen orbit spin, page-flip, comet spawns).

---

## 3 · Scale & performance  — *"how many nodes before it explodes?"*

**Short answer (current build):** comfortable to **~150–250 nodes**; noticeable drag
lag **300–500**; jank / localStorage pressure **~800–1500** depending on device.
The walls, in order you'll hit them:

1. **Graph view (first wall).** Nodes are React-reconciled **DOM elements**; every drag
   re-renders. DOM graphs get sludgy in the low hundreds. → Biggest win: render the graph
   to **canvas** (or only re-render the dragged node), and throttle to rAF.
2. **Orbit labels.** Each label is a canvas-texture sprite (memory-heavy). → Only build
   label sprites for near/large/zoomed planets; billboard-cull the rest.
3. **Orbit draw calls.** No instancing — each planet/ring/moon/edge is its own draw call
   (my new rings+moons raised per-node object count to ~10). → `InstancedMesh` for planets
   and moons; merge edges into one `LineSegments` buffer.
4. **Book prose.** Composed O(nodes) every render; chapters chunk every 3 nodes → hundreds
   of chapters at high counts. → memoize composed chapters; only recompose the visible path.
5. **localStorage** (`ikos_state_v1`) has a ~5MB ceiling; big graphs + notes + videos approach it.
   → migrate to IndexedDB; store positions as typed arrays.

- [ ] 🧠 Canvas/instanced render path for Graph and Orbit (unlocks 1000s of nodes).
- [x] 🧠 Label & ring/moon LOD tied to camera distance / zoom — past cam-z 880 moons hide (and
      skip their per-frame orbit math), labels survive only on pinned/mastered planets; rings stay
      by design (they're the readable identity of gas giants at distance). Build-time budgets
      (above) handle the node-count axis; instanced rendering still open (first item).
- [ ] 🧠 IndexedDB persistence + schema versioning.
- [ ] 🐙 Add a `stress N` terminal command that seeds N synthetic nodes for benchmarking.

### 3b · Graph auto-layout — "tree with branches & roots"

*The graph gets messy as nodes are added; give it structure.* Treat chapter/book order as
the **trunk**, edges as **branches**, and source/root concepts as **roots**.

- [x] 🧠 Layout modes on the graph: **Free** (draggable) · **⌆ Tree** (hierarchical layers by
      edge direction — trunk/branches/roots) · **❉ Radial** (roots at centre, derived outward).
      Segmented control top-left of the graph pane; selecting Tree/Radial *is* the "Tidy" action.
- [x] 🧠 Longest-path layering + barycenter cross-reduction, computed from edges (ignores
      `contradicts`/`loops_back_to` so cycles don't break depth); nodes **animate** into place
      (CSS transition, only during a tidy pass) and stay **draggable** afterward. Positions persist.
- [x] 🐙 **Polish pass** — width-aware sibling spacing (shared `chipW` method) + 3-pass down/up
      barycenter so dense layers don't overlap; radial rings grow their radius when circumference
      can't fit the chips. → [COPILOT_TASKS.md T10](COPILOT_TASKS.md)
- [ ] 🧠 Force-directed relax option (light) to de-overlap dense clusters before tidying.
- [x] 🧠 Persist a per-node `pinned` flag so a tidy pass respects user-placed anchors — `n.pinned`
      (toggled from the graph context menu, inspector, or orbit detail; persists inside `nodes`);
      `applyGraphLayout` keeps pinned nodes at their user-placed positions.

---

## 4 · Ender's Game / tactical-tablet aesthetic

*Lean into the command-tablet feel instead of fighting it.*

- [ ] 🐙 A cohesive HUD chrome: thin corner brackets, hairline grid, monospace telemetry
      readouts along the frame; muted slate + gold + signal-green already match the logo.
- [ ] 🐙 "Command tone" microcopy — events read like orders/telemetry ("NODE 47 · COHERENCE +0.12",
      "FORMATION ALPHA FOLDED"), which the terminal ticker already half-does.
- [x] 🧠 A subtle scanline/vignette + boot sequence on load — command-tablet glass (hairline
      scanlines + soft vignette over the stage) and a ~2s telemetry boot sequence (5 staggered
      lines, ends in "READY"); click/Esc skips, `prefers-reduced-motion` suppresses it entirely,
      and the first-run tour waits for boot to finish.
- [ ] 🐙 Sound design (opt-in): soft sonar pings on mastery, a low thrum on view-switch.

---

## 5 · Synchronized tactical displays

*Make the four views feel like linked Battle School terminals, not four widgets.*

- [x] 🧠 **Command pulse** — `pulseNode(id)` flashes the same concept in every view at once: a
      gold ring pulse on the Graph node **and** a bright burst + comet on the Orbit planet.
      Wired into reflect · grow · master · connect · deliberate add.
- [x] 🧠 **Data-flow cues** — the synchronized node flash (Graph ↔ Orbit) plus, in Split view,
      three gold data-packets that streak across the linked panes whenever a command pulse
      propagates (`dataFlow` keyframes, keyed to `pulse.key`, reduced-motion aware).
- [x] 🧠 **Shared selection & highlight** — cross-view "target lock" (`setHover` / `state.hover`):
      hovering a graph chip, a book concept link, or an orbit planet (raycast on pointermove)
      softly highlights the same concept in all three — gold outline on the chip, full underline
      in the prose, glow + scale on the planet.
- [x] 🧠 A one-frame "sync flash" on the frame border when all views recompute from a state write —
      keyed off the event counter (`syncKey`), reduced-motion aware.

---

## 6 · Terminal as the central command authority

*Lean harder into the REPL being the most powerful way to drive the system.*

- [ ] 🧠 **Macro / tactic recording** — `record "tactic name"` … `stop`; replay with `run "tactic"`.
      Store as a serializable command list (composes with the module `.json` export format).
- [ ] 🧠 **Voice orders** — extend the existing 🎙 dictation to natural commands: "Reflect on node 47",
      "Fold cluster Alpha", "Begin a new book on plasma control". (Intent-map onto existing verbs.)
- [x] 🐙 Command palette / autocomplete + history (↑/↓) + `?` inline help per command.
- [ ] 🧠 `explain last` — narrate what the previous command changed in the graph (teaching aid).

---

## 7 · Mastery & reflection — command qualification

*Make mastery feel like progress toward qualification, earned only by deliberate reflection.*

- [x] 🧠 A per-chapter/book **Coherence (readiness) score** 0–100 that rises *only* through
      genuine explain-back (`evaluateUnderstanding`), decays slightly with unreviewed drift —
      `nodeCoherence` / `chapterCoherence` / `bookCoherence`: confidence alone caps a node at 45%;
      a substantive Assess stamps `state.explained`+`explainedAt`, lifting the ceiling; unreviewed
      stamps decay 2%/day after a week (floor 70%); confusion subtracts. Live readout in the
      status bar (◈ n% coherence, grey→green→gold at 45/80).
- [ ] 🐙 Surface it as a thin readiness meter on the chapter face + book spine (green→gold, matches
      rings). The value comes from `chapterCoherence(chapter)` / `bookCoherence()` — already live.
- [ ] 🧠 "Qualification" gates: a book unlocks a badge / new capability when coherence clears a bar.
- [x] 🧠 Tie the Orbit ring count to coherence tier so mastery is *visible* across views ([§5](#5--synchronized-tactical-displays)) —
      mastered planets get the full triple-ring crown only once explained-back; un-assessed mastery
      wears 2 bands (applies live in `orbitMastered` and on rebuild).

---

## 8 · Graph as the tactical map

- [ ] 🧠 **Formations** — group nodes into named clusters; move/collapse/colour as a unit.
- [x] 🐙 **Orders via right-click / context menu** — reflect, connect, fold, pin, "send to Orbit".
- [ ] 🧠 **Replay / undo stack** — a visual history of graph edits you can scrub (how the graph evolved).
- [ ] 🧠 Tree/branch/root layout — see [§3b](#3b--graph-auto-layout--tree-with-branches--roots).

---

## 9 · Orbit as the strategic overview

- [x] 🧠 **Lock / pin high-priority concepts** — pinned planets stay prominent (brighter, larger,
      keep their label even with labels off) and pulse when you zoom out (>880 cam-z); others dim.
      Toggle via ⌖ Pin in the orbit detail modal, the graph inspector, or the node context menu.
- [ ] 🧠 "Strategic zoom" — zooming out clusters planets by book/shell into labelled constellations.
- [ ] 🧠 Pinned set drives the [command pulse](#5--synchronized-tactical-displays) priority.

---

## 10 · EHR simulator — strengthen the built-in guide

*Make the guide excellent without breaking the simulation flow.*

- [ ] 🧠 **Context-aware guide** — the guide button opens to the panel you're on (on the magnetic-field
      panel → jump to "Why M ≈ 1 matters" with an animated helix-alignment explainer).
- [ ] 🧠 **Hypothesis Explorer** — a one-click "Test the Hypothesis" preset that stages the sim to
      sweep **M** and watch coupling % change live. Turns the guide into an interactive lesson.
- [ ] 🐙 **Diagnostic "?" tooltips** — every live readout (Langmuir probes, turbulence, …) gets a
      plain-language "what this number means + why it matters for the match number."

---

## 11 · IKOS ↔ EHR integration  *(low-hanging fruit)*

- [ ] 🧠 **Export an EHR run → IKOS node.** A structured "mission log" node capturing key params,
      M value, coupling results, and your reflection notes — a first-class node in the graph.
- [ ] 🧠 **EHR module for IKOS** — seed core plasma/helicon concepts + the match-number hypothesis
      as an installable graph package (same format as the 20 bundled modules) to explore/reflect on.
- [ ] 🧠 **Reflection → nodes.** "Reflect: why did coupling drop when I changed acoustic depth?"
      becomes a reflection node linked to the mission-log node (uses the existing reflection loop).
- [ ] 👤 **Decide the contract:** a minimal shared **event/data schema** (a "run" + a "reflection")
      so EHR and IKOS speak the same shape — the seam that makes convergence ([§12](#12--convergence--cme-os--echouniverse)) cheap later.

---

## 12 · Convergence — CME OS + echoUniverse

*IKOS as the reflective/command layer; EHR-style sims and echoUniverse plug into it.*
The solo-dev risk here is **fragmentation before convergence** — so define the seam early.

- [ ] 🧠 **Minimal unifying abstraction first** — a shared **event bus + data model** (nodes, edges,
      runs, reflections, events) that all three speak. Build this *before* merging UIs.
- [ ] 🧠 Position IKOS as the **shell/OS layer**: sims and echoUniverse register as "modules/apps"
      via the existing module system (`{ nodes, edges, rules, trust, permissions, capability }`).
- [?] 👤 **Open questions to pin down** (answers shape the architecture):
  - What does **echoUniverse** actually do today — an expansion of the Orbit view, a broader
    simulation/universe engine, or something else?
  - What does **CME OS** mean in practice — "Command & Control", or "Cognitive Mastery Environment"?
  - Is the end-state mental model: **IKOS = the desktop/OS layer** that the simulators and
    echoUniverse plug into? (If yes, the module/capability system is already 80% of the socket.)

---

## 13 · Distribution — Amazon Appstore (Fire tablets)

*Researched 2026-07: what "putting IKOS on the Kindle store" actually means in practice.*

**Lay of the land:**
- **Kindle e-readers can't run apps.** The Kindle store (KDP) publishes e-books only — Kindle
  "active content" is long dead, and e-ink can't do WebGL/WebGPU anyway. Not a target.
- **The real target is Fire tablets via the Amazon Appstore.** Amazon shut the Appstore down on
  non-Amazon Android devices (Aug 2025) and on Windows 11 — it now serves Fire devices.
  A developer account is free.
- **HTML5/web-app submission is discontinued.** Amazon retired the Creator Service and the
  web-app (hosted/packaged URL) submission path; new listings must be **Android APKs**
  (Fire OS is Android-based). Existing web-app listings can only be updated, not created.

**The path — IKOS is well-shaped for this (one self-contained `index.html`):**

- [ ] 🧠 Wrap the bundle in a minimal Android WebView shell — Capacitor is least-friction
      (`webDir` → the bundle), or a hand-rolled single-Activity WebView. **No TWA/Bubblewrap** —
      Fire OS ships no Chrome, so Trusted Web Activities won't fly.
- [ ] 🧠 Fire-OS pass: Android back button closes the top modal/sheet instead of exiting;
      confirm the classic-WebGL fallback engages (Amazon's WebView has no WebGPU — the
      triple fallback already covers it); localStorage persists in WebView, but the §3
      IndexedDB migration makes it sturdier.
- [x] 🧠 Touch gestures (§2) — prerequisite, shipped this pass.
- [ ] 👤 Amazon Developer account (free) + listing assets: 512px icon, screenshots, content
      rating questionnaire, privacy answers (easy — everything is local, nothing collected).
- [x] 🧠 PWA — the web deploy is now installable with no store at all: `manifest.webmanifest`
      (standalone, slate/gold), icons rendered from the loader-mark SVG by a dependency-free
      `scripts/make-icons.mjs` (`npm run icons`; any + maskable + apple-touch), and `sw.js` —
      network-first navigations (fresh deploys land immediately), stale-while-revalidate for
      same-origin + the three.js CDNs so **Book/Graph/Terminal/Orbit all work offline** after
      first load. `build.mjs` injects the manifest link + SW registration into the shell
      idempotently; `vercel.json` serves `sw.js`/manifest with `must-revalidate`.
- [?] 👤 Decide: price (free?), and whether the all-rights-reserved source-visible stance
      changes for a store build.

Docs: [Fire tablet web apps FAQ](https://developer.amazon.com/docs/fire-tablets/ft-webapp-faq.html) ·
[web-app submission discontinued](https://developer.amazon.com/docs/web-based-apps/developer-console-faq.html) ·
[Appstore submission](https://developer.amazon.com/docs/app-submission/understanding-submission.html)

---

## Dividing work: Claude + Copilot

> **Hand-off ready:** the 🐙 items are written up as paste-ready briefs in
> **[COPILOT_TASKS.md](COPILOT_TASKS.md)** — drop each `Prompt` block into Copilot Chat
> (or a GitHub issue assigned to `@copilot`).

Yes — split it, and it lowers total Claude usage. Rough rule:

- **Hand to 🐙 Copilot** (in-editor, cheap, no orchestration): the `[ ] 🐙` items — `.gitignore`,
  `package.json`, CSS/responsive passes (§2), context-menu wiring (§8), tooltips (§10),
  command history/autocomplete (§6), microcopy (§4). These are local and well-specified.
- **Keep for 🧠 Claude**: anything touching the render pipeline / three.js (§1, §3 canvas+instancing,
  §3b layout), the state model, trust, cross-view sync (§5), macros/voice intent (§6), and the
  convergence seam (§11–12). These need whole-file context and cross-cutting reasoning.
- **Workflow that saves the most tokens:** you (or Copilot) implement `🐙` items directly against
  the source `.dc.html`; batch a set, then have Claude do a single `node build.mjs` + review pass
  instead of round-tripping each change. Claude owns the bundle rebuild + verification so the two
  streams don't collide in `index.html`.

> Note: I (Claude) can't drive Copilot or hand tasks to it directly — you route the `🐙` items to it.
> This split is a suggestion; anything marked 🐙 is safe for either.
