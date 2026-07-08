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
- [ ] 🐙 Add a `package.json` with `"build": "node build.mjs"` and `"dev": "npx serve ."` scripts. → [COPILOT_TASKS.md T1](COPILOT_TASKS.md)
- [ ] 🐙 Add a tiny CI check (GitHub Action): `node build.mjs` must run clean and the
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
- [ ] 🧠 Wire cosmic events to *state* changes, not just ambient: a comet on `on_mastery`,
      a fold implosion when a cluster collapses, a bright birth-flash when a reflection node spawns.
- [ ] 🧠 Ring detail: subtle radial banding texture (TSL on the WebGPU path, canvas texture on WebGL),
      a faint shadow the ring casts on the planet.
- [ ] 🧠 Moons carry meaning: size/colour a moon by the *edge type* it represents, and let a moon
      be clickable to fly to the connected concept (turns decoration into navigation).
- [ ] 🧠 Perf guard: cap total rings+moons past N nodes; drop to LOD billboards when zoomed out
      (see [§3 capacity](#3--scale--performance)).

---

## 2 · Mobile-responsive design

- [ ] 🐙 Audit fixed pixel widths / `min-width` in the four views; convert to `clamp()` / `%` / `dvh`.
- [ ] 🐙 Collapse the 4-up Split layout to a **swipeable single view** with a bottom tab bar
      (Book · Graph · Terminal · Orbit) under ~720px.
- [ ] 🐙 Touch targets ≥ 44px; terminal input avoids the iOS zoom-on-focus (font-size ≥ 16px).
- [ ] 🧠 Graph/Orbit gestures: pinch-zoom + one-finger pan already partly work via pointer events —
      verify on touch, add momentum, prevent page scroll capture.
- [ ] 🐙 Detail modal + Modules browser: full-screen sheets on mobile instead of floating cards.
- [ ] 🐙 Respect `prefers-reduced-motion` (dampen orbit spin, page-flip, comet spawns).

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
- [ ] 🧠 Label & ring/moon LOD tied to camera distance / zoom.
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
- [ ] 🐙 **Polish pass** — width-aware sibling spacing (use `chipW`) + multi-pass barycenter so
      dense layers don't overlap; fix radial ring crowding. → [COPILOT_TASKS.md T10](COPILOT_TASKS.md)
- [ ] 🧠 Force-directed relax option (light) to de-overlap dense clusters before tidying.
- [ ] 🧠 Persist a per-node `pinned` flag so a tidy pass respects user-placed anchors.

---

## 4 · Ender's Game / tactical-tablet aesthetic

*Lean into the command-tablet feel instead of fighting it.*

- [ ] 🐙 A cohesive HUD chrome: thin corner brackets, hairline grid, monospace telemetry
      readouts along the frame; muted slate + gold + signal-green already match the logo.
- [ ] 🐙 "Command tone" microcopy — events read like orders/telemetry ("NODE 47 · COHERENCE +0.12",
      "FORMATION ALPHA FOLDED"), which the terminal ticker already half-does.
- [ ] 🧠 A subtle scanline/vignette + boot sequence on load (skippable, reduced-motion aware).
- [ ] 🐙 Sound design (opt-in): soft sonar pings on mastery, a low thrum on view-switch.

---

## 5 · Synchronized tactical displays

*Make the four views feel like linked Battle School terminals, not four widgets.*

- [x] 🧠 **Command pulse** — `pulseNode(id)` flashes the same concept in every view at once: a
      gold ring pulse on the Graph node **and** a bright burst + comet on the Orbit planet.
      Wired into reflect · grow · master · connect · deliberate add.
- [~] 🧠 **Data-flow cues** — partial: the synchronized node flash (Graph ↔ Orbit) lands; still
      want faint connector lines/particles *between* the panes when an action propagates.
- [ ] 🧠 **Shared selection & highlight** — one `selected` id already exists; ensure a hover in
      any view softly highlights the same concept everywhere (cross-view "target lock").
- [ ] 🧠 A one-frame "sync flash" on the frame border when all views recompute from a state write.

---

## 6 · Terminal as the central command authority

*Lean harder into the REPL being the most powerful way to drive the system.*

- [ ] 🧠 **Macro / tactic recording** — `record "tactic name"` … `stop`; replay with `run "tactic"`.
      Store as a serializable command list (composes with the module `.json` export format).
- [ ] 🧠 **Voice orders** — extend the existing 🎙 dictation to natural commands: "Reflect on node 47",
      "Fold cluster Alpha", "Begin a new book on plasma control". (Intent-map onto existing verbs.)
- [ ] 🐙 Command palette / autocomplete + history (↑/↓) + `?` inline help per command.
- [ ] 🧠 `explain last` — narrate what the previous command changed in the graph (teaching aid).

---

## 7 · Mastery & reflection — command qualification

*Make mastery feel like progress toward qualification, earned only by deliberate reflection.*

- [ ] 🧠 A per-chapter/book **Coherence (readiness) score** 0–100 that rises *only* through
      genuine explain-back (`evaluateUnderstanding`), decays slightly with unreviewed drift.
- [ ] 🐙 Surface it as a thin readiness meter on the chapter face + book spine (green→gold, matches rings).
- [ ] 🧠 "Qualification" gates: a book unlocks a badge / new capability when coherence clears a bar.
- [ ] 🧠 Tie the Orbit ring count to coherence tier so mastery is *visible* across views ([§5](#5--synchronized-tactical-displays)).

---

## 8 · Graph as the tactical map

- [ ] 🧠 **Formations** — group nodes into named clusters; move/collapse/colour as a unit.
- [ ] 🐙 **Orders via right-click / context menu** — reflect, connect, fold, pin, "send to Orbit".
- [ ] 🧠 **Replay / undo stack** — a visual history of graph edits you can scrub (how the graph evolved).
- [ ] 🧠 Tree/branch/root layout — see [§3b](#3b--graph-auto-layout--tree-with-branches--roots).

---

## 9 · Orbit as the strategic overview

- [ ] 🧠 **Lock / pin high-priority concepts** — pinned planets stay prominent (brighter, larger,
      keep their label) and pulse when you zoom out; others dim.
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
