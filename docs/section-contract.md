# Section Contract

Every section layout must follow these rules so that it works with the other sections and with the printable page, the PDF and the audio version. They adapt the *HSE Custom Section Contract* draft (v0.1, 21 Oct 2026) to the built-in layouts.

A rule only counts when a test checks it. The **Checked** column says where; "planned" means not yet.

| Rule | A section must | Checked |
| --- | --- | --- |
| R1 One root | Render inside one `<section data-layout="<name>">`, adding nothing elsewhere on the page | `test.js` Layout registry |
| R2 Scoped styles | Start every CSS selector with the layout's own class | planned |
| R3 Theme tokens | Take colours, fonts and spacing from `--hse-*` variables | planned (warning) |
| R4 No fixed escape | Avoid `position: fixed`; pin through the engine | planned |
| R5 Engine lifecycle | Start its script from one function in `js/runtime.js`, named in the registry | `test.js` Layout registry |
| R6 No own scroll listeners | Use ScrollTrigger, not `window` scroll events | planned |
| R7 Analytics through the engine | Make no direct Plausible calls | planned |
| R8 Declared network only | Load nothing from undeclared hosts | planned |
| R9 Content in fields | Take every word from the content, nothing hard-coded | human review |
| R10 Readable | Have a reader that returns every word shown on screen | `test.js` Every word on screen is read |
| R11 Phone floor | Work at 320px wide with no sideways scroll | `test.js` Phone, reduced motion and Ctrl+P |
| R12 Reduced motion | Show all its text when motion is turned off | `test.js` Phone, reduced motion and Ctrl+P |
| R13 Prints from the live page | Show all its text under Ctrl+P | `test.js` Phone, reduced motion and Ctrl+P |
| R14 Existing stories unchanged | Leave existing stories rendering exactly as before, unless the change is opt-in | `test.js` Existing stories unchanged |

## Adding a layout

1. Add an entry to `renderer/layouts/registry.js`: renderer, stylesheet, runtime functions.
2. Run `node test.js`. Each failure names the next thing to add:
    - the layout name in the `layout` enum of `schema/content.schema.json`
    - a reader in `renderer/readable.js`
    - its stylesheet in `css/layouts/` (a new layout's stylesheet is linked only on pages that use it)
    - its `setup…()` and reduced-motion functions in `js/runtime.js`, if it has a script
    - an `<option>` and panel in `editor/editor.html`
    - a sample story in `test/fixtures/<name>.json`, every word a unique `QQ…` marker
3. If a word on screen deliberately isn't read aloud or printed, list it in the sample section's `_not_read` with the reason.
4. Run `npm run snapshots:update` to record the new sample.
5. The browser checks open the sample in headless Chrome (`node scripts/browser-checks.js <name>` runs just one). If a word doesn't print or doesn't show with motion off, fix it in `css/print.css` or the layout's `prefers-reduced-motion` CSS.

## Changing a layout

`test.js` fails if any existing story renders differently: the page, the printable page, the PDF or the audio.

- `npm run snapshots:diff` shows what changed against `origin/main`.
- `npm run snapshots:diff:live` shows the same for every live story in Supabase (needs `.env`). Frozen stories are skipped.
- If the change is meant to happen, run `npm run snapshots:update` and say in the PR which stories change. A change to how existing stories look should normally be opt-in, behind a new field.
