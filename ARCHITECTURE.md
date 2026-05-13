# Harpoon Story Engine
## Architecture & Strategic Brief — May 2026

---

### What it is

The Harpoon Story Engine is a schema-driven publishing platform. A single JSON file — conforming to a documented schema — describes the complete content of a digital publication. A renderer reads that file and produces a fully styled, interactive HTML publication. A local editor provides a dual-viewport authoring environment with live preview on both mobile and desktop simultaneously.

It is not a CMS. It is not a page builder. It is a publishing engine: a clean separation between content, presentation, and delivery.

---

### The three layers

**Content — the JSON schema**
Every publication is a single `content.json` file. The schema defines every possible element: cover, sections, block types, brand tokens, delivery configuration. The schema is versioned, documented, and machine-validatable. Content is completely portable — it can be rendered by any conforming renderer, stored anywhere, diffed in git, and edited by any tool that speaks JSON.

**Presentation — the renderer**
The renderer reads a content file and produces HTML. It is a Node.js module with no opinion about where it runs: a local terminal, a GitHub Action, an API route in Edition OS. CSS is fully tokenised — every colour, typeface, spacing value, and motion parameter is a CSS custom property, overridden per-project at render time from `meta.accent_color`. A new section type — from ideation to deployed, tested, schema-validated — takes one to two hours. No other authoring engine can match that velocity because no other authoring engine separates content from presentation this cleanly.

**Delivery — the pipeline**
Pushing a content file to the `projects/` folder in the repository triggers a GitHub Action that validates, renders, and deploys to S3, with CloudFront serving the output globally over HTTPS. CloudFront cache invalidation is automatic. The entire pipeline — edit, push, live — completes in under two minutes.

---

### The editor

The Story Engine editor is a local web application (`node editor.js`). It runs at `http://localhost:3001`. It requires no installation beyond Node.js.

The authoring environment shows two live previews simultaneously: mobile (375px, actual size, scrollable) on the left, desktop (1280px, scaled) on the right. Every keystroke triggers an autosave after 500 milliseconds. The renderer runs, both preview panes reload. There is no save button. There is no publish step beyond a git push.

This is the inversion that Shorthand has never made. Shorthand is a desktop-first authoring tool with a mobile preview. The Story Engine editor treats mobile as the primary viewport. Authors see mobile consequences of every decision in real time, not as an afterthought at the end of a session. Given that 75% or more of traffic to editorial publications arrives on mobile, this is not a cosmetic difference — it is a structural one.

---

### The token system

Each project supplies two brand colours in its `meta` block. The renderer injects these as CSS custom properties at the root level, overriding the base token values. Every styled element in the publication — navigation, cover, statistics, pull quotes, section headers, interactive components — inherits from those two values. A complete rebrand of a publication requires changing two hex codes.

For client-specific deployments, a token file (`tokens-imperial.css`, `tokens-ecb.css`) encodes the full brand identity: typefaces, spacing rhythm, motion curves, colour palette. The editor selects the appropriate token file. The renderer applies it. One build system produces publications that look and feel like native client properties.

---

### Extensibility

**New section types** are self-contained: a renderer module (`renderer/layouts/new-type.js`), a CSS file (`css/layouts/new-type.css`), a schema addition, and a runtime JS block. The pattern is established, the scaffolding exists, the test suite validates automatically. One to two hours from concept to deployed section type.

**New schemas** define new product types. A Graduation Guide schema has a completely different content model to an annual report — ceremony dates, graduate profiles, department pages, degree classifications. A new schema, a new renderer, a new editor skin: the pipeline is identical, the authoring experience is purpose-built for the content type.

**Editor skins** are configuration, not engineering. A Graduation Guide editor is the same application with a different schema loaded, a different section type menu, a different token file pre-selected, and client-specific field labels. The underlying engine does not change.

---

### What this enables

| Product | Description |
|---------|-------------|
| **Story Engine Core** | The platform itself — schema, renderer, editor, pipeline |
| **Story Engine for [Client]** | A skinned editor with client tokens, schema variant, and direct deployment to client CDN |
| **Graduation Guide Engine** | Purpose-built schema and editor for university graduation content — ceremonies, graduates, departments |
| **Prospectus Engine** | Schema and editor for institutional prospectuses — courses, entry requirements, campus life |
| **White-label Story Engine** | Licensed to agencies as a publishing platform under their own brand |

Each of these is schema and configuration work built on the same foundation. The engine does not change.

---

### The strategic position

Shorthand charges £30,000–£100,000 per year for an enterprise licence. It produces desktop-first publications with a proprietary content model and no export pathway. Content created in Shorthand is owned by Shorthand.

The Story Engine produces publications from an open, documented JSON schema. Content is stored in git. It can be rendered by any conforming renderer. It deploys to infrastructure the client controls. The authoring environment is mobile-first by design.

The competitive advantage is not feature parity with Shorthand. It is architectural correctness: clean separation of content from presentation, a documented and portable content model, and a development velocity that no proprietary platform can match. A new section type takes an afternoon. A new product variant takes a week.

---

### Current status — May 2026

- Schema v1.2 — 7 layout types, 9 block types, fully documented
- Renderer v1.1 — all layouts rendering, all interactions wired, 116 automated tests
- Pipeline — GitHub Actions → S3 → CloudFront, HTTPS, automatic cache invalidation
- Editor v1.2 — home screen, dual-viewport live preview, autosave, section management
- Live — `https://stories.har.pn` serving opera and cricket example publications

**Immediate next steps**
- Block-level editors for cards, sticky steps, accordion items, and photo clusters
- Schema variants for graduation and prospectus content types
- Client token files for Imperial College London and The FA
- Edition OS integration as the project catalogue layer

---

*Harpoon Productions Ltd — harpoon.productions*
