# graduation.guide integration — architecture design

*Design reference, not yet implemented. Written [current session] after auditing the actual state of this repo against the graduation.guide product brief (see `harpoon.productions` / `graduation-guides` repo, `BRIEF.md`). No renderer, schema, or pipeline code in this repo has been changed to produce this document — it exists so the eventual migration starts from an agreed design instead of re-deriving one.*

---

## Why this exists

`graduation-guides` (a separate repo) contains a working proof-of-concept Imperial College graduation guide, built as a fully standalone HTML/CSS/JS template with its own Node build script — no dependency on this engine. That's the wrong shape for the long term: per Harpoon's three-tier doctrine, a Tier 3 product like graduation.guide should *not* implement rendering, PWA, or analytics independently — it should describe intent (schema + data) and depend on this Engine (Tier 2) to produce the experience, drawing on Platform Core (Tier 1: CSS tokens, Plausible analytics) where this repo already provides it.

This doc records the target design for that dependency, based on a direct audit of this codebase (file:line citations below), so a future migration task can execute against a real plan rather than assumptions.

---

## Current state of this repo (audited, not assumed)

- **Section model has no `oneOf`.** `schema/content.schema.json`'s `sections` is one flat polymorphic object; `layout` is just an enum string, and each layout renderer picks the fields it cares about. Dispatch happens in `renderer/index.js:210-255` (`renderSectionHtml` switch) — the only real extension point in the renderer today.
- **`render()` is hardwired** to `{meta, config, cover, sections}` (`renderer/index.js:41-42`; `buildPage`, lines 94-168, unconditionally maps over `sections`). There is no hook for a sibling top-level content shape.
- **No search / URL-param / tabbed-state infrastructure exists anywhere.** Checked `js/runtime.js` (1543 lines) and all of `renderer/` — nothing. The closest analogs, `renderer/blocks/toggle-panels.js` and `renderer/blocks/accordion.js` (runtime wiring at `js/runtime.js:603-631` and `:669-745`), are open/close-a-handful-of-items patterns, not filter-search over thousands of records.
- **Brand tokens are real and correct.** `css/tokens.css` (base) + `css/tokens-imperial.css` (already exists: genuine Imperial navy `#003e74`, light blue `#6aaae4`, ImperialText typeface) + `tokens/registry.json` (maps a `token_set` id to label/fonts/logo). Selected per-project via `meta.token_set`.
- **Plausible analytics is wired, with a live bug.** `renderer/shell/head.js:55` hardcodes `https://analytics.harpoonproductions.com/js/script.js` — the old domain — regardless of what `config.analytics.plausible_domain` is set to (that config only supplies `data-domain`, not the script host). This silently affects every story this engine renders today, independent of graduation.guide. **Recommend fixing as its own small task, not bundled into this migration.**
- **`config.pwa` is a schema stub only** (`schema/content.schema.json:117-138`: `{enabled, theme_color, background_color, offline_sections[]}`). Only `theme_color` is implemented, as a `<meta>` tag (`renderer/shell/head.js:58-59`). No manifest generation, no service worker, anywhere in the codebase.
- **The editor is not schema-driven**, despite `ARCHITECTURE.md`'s claim that "editor skins are configuration, not engineering." `editor.js:70` and `:505-511` serve `schema/content.schema.json` at `GET /api/schema`, but nothing in `editor.html` or `editor/*` ever fetches it. Every field is hand-bound HTML (e.g. `editor.html:2026-2068`), and the layout picker is a hardcoded 7-option `<select>` (`editor.html:1281-1300`). A graduation-guide authoring UI would be real new engineering, not configuration.
- **The deploy pipeline reads from Supabase, not git.** `.github/workflows/render-deploy.yml` runs `node fetch-content.js "$PROJECT_ID"`, which pulls from a `story_engine_projects` Supabase table and writes it into `projects/<id>/content.json` at build time — the committed `projects/` folders in this repo are dev-preview snapshots, not the CI source of truth. A large per-institution payload (Imperial's proof of concept is ~1.3MB / 5,373 student records) needs a decision on how it reaches that table, or a pipeline extension — not resolved here.
- **`test.js` is fixture-hardcoded** to `examples/opera-example.json` and `examples/cricket-example.json`, asserting against the existing layout/block vocabulary by string match. It does not generalize to a new content shape.

---

## Design decision: a new content "kind," not a shoehorned section

A ceremony chooser (exactly one ceremony visible at a time, switched by click, not scroll position) plus search that spans every ceremony simultaneously is architecturally a tabbed data application, not a scrolling narrative. Forcing it into the `sections`/`layout` vocabulary — built for sequential scroll-reveal — would stretch that abstraction past what it was designed for. Instead:

- Add a top-level `content.kind` field, defaulting to `"story"` for backward compatibility with every existing project. `"graduation-guide"` selects a new render path.
- `renderer/index.js`'s `render()` branches on `content.kind` *before* touching `sections`, delegating to a new module — e.g. `renderer/kinds/graduation-guide.js` — instead of going through `renderSectionHtml`.
- A new schema file, `schema/graduation.schema.json`, lives in this repo. The content model itself doesn't need to be invented: it already exists, drafted and validated against the real Imperial replica data, at `graduation-guides/schema/graduation.schema.json` in the product repo. It should be promoted here largely as-is — the work is re-hosting it as the schema this engine renders, not redesigning it.

### Reused from this engine, unmodified

- `css/tokens.css` + `css/tokens-imperial.css` via the existing `meta.token_set` mechanism (replaces the guessed `#232333`/`#40E0CF` currently in the standalone POC's data file with the real, correct brand values already sitting in this repo).
- The `config.analytics.plausible_domain` pattern — once the stale-domain bug above is fixed.
- `config.pwa`, as the seed for real implementation (below) — built once, shared by both the `story` kind and the `graduation-guide` kind.
- The already-built, already browser-verified template CSS and `graduation-search.js` logic from the POC repo (`graduation-guides/templates/graduation-guide.html`, `graduation-guides/assets/graduation-search.js`) are directly portable into the new renderer module as source material once migration starts — re-skinned with real tokens, re-plugged into this engine's dispatch instead of a standalone build script.

### Genuinely new work (confirmed by audit, not assumed reusable)

- The renderer module itself (`renderer/kinds/graduation-guide.js` + paired CSS).
- Runtime JS for chooser-select, cross-ceremony search, and `?student_name=&ceremony=` deep-linking — nothing today covers any of this.
- Real PWA support: manifest.json generation + a basic offline service worker. graduation.guide's non-negotiable offline-first requirement (5,000 people on dead cell towers at Royal Albert Hall — see product `BRIEF.md`) is the concrete forcing function the product brief's own Extraction Principle anticipated: the second Engine client that actually needs Platform Core capability the first client only stubbed.
- A parallel test file (e.g. `test-graduation-guide.js`) — `test.js` doesn't generalize to a new content shape.
- Editor support: **out of scope for v1.** The product brief already specifies the producer workflow as registrar CSV → JSON → build → deploy, not an interactive editor UI; the extraction-script pattern already built in the product repo (`graduation-guides/scripts/extract-imperial-data.js`) covers this without new editor engineering.
- A resolved answer for how a large per-institution JSON payload reaches the Supabase-backed deploy pipeline, or an extension to that pipeline to support it directly. Open question, not resolved here.

---

## What moves where, at migration time (not now)

- **Stays in `graduation-guides`:** `BRIEF.md`, `data/<institution>.json` (or moves here / to Supabase — open question above), `scripts/extract-imperial-data.js`.
- **Superseded by this design, not deleted:** `graduation-guides/templates/graduation-guide.html`, `graduation-guides/assets/graduation-search.js`, `graduation-guides/scripts/build.js` — kept running as the working, verified POC until migration is actually scheduled; source material for the renderer module described above.
- **New, in this repo:** `schema/graduation.schema.json`, `renderer/kinds/graduation-guide.js`, paired CSS, new runtime JS, PWA manifest/service-worker generation, a parallel test file.

---

*Harpoon Productions Ltd*
