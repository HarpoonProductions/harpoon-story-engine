# Harpoon Story Engine

A renderer that converts a single JSON content file into a complete HTML publication. One schema. Any story.

---

## How it works

1. A project's content lives in `projects/<project-id>/content.json`
2. That file conforms to `schema/content.schema.json`
3. Running the renderer produces a complete HTML publication in `output/<project-id>/`
4. Pushing to `main` triggers automatic render and deployment to S3 via GitHub Actions

---

## Quick start

```bash
npm install

# Render an example
node render.js examples/opera-example.json

# Render a real project
node render.js projects/my-project/content.json --out ./output/my-project

# Run the test suite
node test.js
```

---

## Project structure

```
harpoon-story-engine/
├── schema/
│   └── content.schema.json     ← The authoritative content schema (v1.2)
├── examples/
│   ├── opera-example.json      ← Full example: report register
│   └── cricket-example.json    ← Full example: narrative register
├── projects/                   ← Live client projects (one folder each)
│   └── <project-id>/
│       └── content.json
├── renderer/
│   ├── index.js                ← Orchestrator
│   ├── validate.js             ← AJV schema validator
│   ├── render-cover.js         ← Cover renderer
│   ├── shell/
│   │   ├── head.js             ← <head> block
│   │   └── nav.js              ← Navigation
│   ├── layouts/                ← One file per layout type
│   │   ├── default.js
│   │   ├── sticky-steps.js
│   │   ├── stackable-cards.js
│   │   ├── cascading-slides.js
│   │   ├── fullbleed-quote.js
│   │   ├── parallax.js
│   │   └── reveal-crossfade.js
│   └── blocks/                 ← Reusable block renderers
│       ├── image.js
│       ├── pull-quote.js
│       ├── stat-block.js
│       ├── photo-cluster.js
│       ├── toggle-panels.js
│       ├── accordion.js
│       ├── cards.js
│       ├── contributors.js
│       └── briefing-engine.js
├── css/
│   ├── tokens.css              ← Design tokens (override per-project via <style>)
│   ├── base.css                ← Reset + typography
│   ├── nav.css
│   ├── cover.css
│   ├── layouts/                ← One file per layout
│   └── blocks/                 ← One file per block type
├── output/                     ← Gitignored — renderer writes here
├── render.js                   ← CLI entry point
└── test.js                     ← Test suite
```

---

## Starting a new project

1. Create `projects/<project-id>/content.json`
2. Follow the schema in `schema/content.schema.json`
3. Use `examples/` as reference for any block or layout type
4. Run `node render.js projects/<project-id>/content.json` to preview locally
5. Push to `main` to deploy

---

## GitHub Actions secrets required

| Secret | Description |
|--------|-------------|
| `AWS_ACCESS_KEY_ID` | IAM key with S3 write access |
| `AWS_SECRET_ACCESS_KEY` | Corresponding secret |
| `AWS_REGION` | e.g. `eu-west-2` |
| `S3_BUCKET` | Target bucket name |
| `DELIVERY_DOMAIN` | Public domain, e.g. `stories.harpoon.productions` |

---

## Schema version

Current: **v1.2** — see `schema/content.schema.json` for full documentation.  
Change log is maintained within the schema's `description` field.

---

*Harpoon Productions Ltd*
