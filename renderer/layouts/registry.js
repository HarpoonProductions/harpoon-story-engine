'use strict';

/**
 * Harpoon Story Engine — Layout registry.
 *
 * One entry per section layout. It says where each part of the layout
 * lives, so the renderer, the readable content (print, PDF, audio) and the
 * tests all work from the same list. See docs/section-contract.md.
 *
 * Each entry:
 *   render         (section) => HTML for the section, inside one
 *                  <section data-layout="<name>"> root
 *   css            its stylesheet; null when it has none of its own. A new
 *                  layout's stylesheet is linked only on pages that use it
 *   runtime        names of its functions in js/runtime.js, or null when it
 *                  needs no script:
 *                    setup          runs when motion is allowed
 *                    reducedMotion  runs instead when the reader has asked
 *                                   for less motion (null: the layout's own
 *                                   setup or CSS handles it)
 *
 * Its reader (what it says in words) is READERS[name] in renderer/readable.js,
 * its fields are in schema/content.schema.json, and its editor panel is in
 * editor/editor.html. test.js checks all of those exist for every entry.
 *
 * Adding a layout: add an entry here, then run node test.js. Every check
 * it fails names the next file to touch.
 */

const { renderDefault }         = require('./default');
const { renderText }            = require('./text');
const { renderStickySteps }     = require('./sticky-steps');
const { renderFullbleedQuote }  = require('./fullbleed-quote');
const { renderRevealCrossfade } = require('./reveal-crossfade');
const { renderTimeline }        = require('./timeline');
const { renderStackableCards }  = require('./stackable-cards');
const { renderParallax }        = require('./parallax');
const { renderCascadingSlides } = require('./cascading-slides');
const { renderCustomHtml }      = require('./custom-html');
const { renderScrollCarousel }  = require('./scroll-carousel');
const { renderPanoramicScroll } = require('./panoramic-scroll');
const { renderCinemaReveal }    = require('./cinema-reveal');
const { renderFrameScrubber }   = require('./frame-scrubber');
const { renderSplitReveal }     = require('./split-reveal');
const { renderTwoColumn }       = require('./two-column');
const { renderCoverLayout }     = require('./cover');

const LAYOUTS = {
  'cover': {
    render: renderCoverLayout,
    css: 'css/cover.css',
    runtime: { setup: 'setupCoverEntrance', reducedMotion: null },
  },
  'default': {
    render: renderDefault,
    css: 'css/layouts/default.css',
    runtime: null,
  },
  'text': {
    render: renderText,
    css: 'css/layouts/text.css',
    runtime: null,
  },
  'custom-html': {
    render: renderCustomHtml,
    css: 'css/layouts/custom-html.css',
    runtime: { setup: 'setupEmbedScrollLock', reducedMotion: null },
  },
  'scroll-carousel': {
    render: renderScrollCarousel,
    css: 'css/layouts/scroll-carousel.css',
    runtime: { setup: 'setupScrollCarousel', reducedMotion: null },
  },
  'sticky-steps': {
    render: renderStickySteps,
    css: 'css/layouts/sticky-steps.css',
    runtime: { setup: 'setupStickySteps', reducedMotion: 'setupStickyStepsA11y' },
  },
  'stackable-cards': {
    render: renderStackableCards,
    css: 'css/layouts/stackable-cards.css',
    runtime: null,
  },
  'cascading-slides': {
    render: renderCascadingSlides,
    css: 'css/layouts/cascading-slides.css',
    runtime: null,
  },
  'parallax': {
    render: renderParallax,
    css: 'css/layouts/parallax.css',
    runtime: { setup: 'setupParallax', reducedMotion: null },
  },
  'fullbleed-quote': {
    render: renderFullbleedQuote,
    css: 'css/layouts/fullbleed-quote.css',
    runtime: { setup: 'setupFullbleedQuote', reducedMotion: 'setupFullbleedQuoteA11y' },
  },
  'reveal-crossfade': {
    render: renderRevealCrossfade,
    css: 'css/layouts/reveal-crossfade.css',
    runtime: { setup: 'setupRevealCrossfade', reducedMotion: 'setupRevealCrossfadeA11y' },
  },
  'panoramic-scroll': {
    render: renderPanoramicScroll,
    css: 'css/layouts/panoramic-scroll.css',
    runtime: { setup: 'setupPanoramicScroll', reducedMotion: null },
  },
  'cinema-reveal': {
    render: renderCinemaReveal,
    css: 'css/layouts/cinema-reveal.css',
    runtime: { setup: 'setupCinemaReveal', reducedMotion: null },
  },
  'frame-scrubber': {
    render: renderFrameScrubber,
    css: 'css/layouts/frame-scrubber.css',
    runtime: { setup: 'setupFrameScrubber', reducedMotion: null },
  },
  'split-reveal': {
    render: renderSplitReveal,
    css: 'css/layouts/split-reveal.css',
    runtime: { setup: 'setupSplitReveal', reducedMotion: null },
  },
  'timeline': {
    render: renderTimeline,
    css: 'css/layouts/timeline.css',
    runtime: { setup: 'setupTimeline', reducedMotion: 'setupTimelineA11y' },
  },
  'two-column': {
    render: renderTwoColumn,
    css: 'css/layouts/two-column.css',
    runtime: null,
  },
};

// Stylesheets that head.js links by hand on every page, in a fixed place
// (moving them would change the cascade for existing stories). Any other
// layout's stylesheet is linked automatically after these, and only on
// pages that use that layout, so a new layout changes no existing page.
const HAND_LINKED_CSS = new Set([
  'css/cover.css',
  'css/layouts/default.css', 'css/layouts/text.css', 'css/layouts/custom-html.css',
  'css/layouts/scroll-carousel.css', 'css/layouts/sticky-steps.css',
  'css/layouts/stackable-cards.css', 'css/layouts/cascading-slides.css',
  'css/layouts/parallax.css', 'css/layouts/fullbleed-quote.css',
  'css/layouts/reveal-crossfade.css', 'css/layouts/panoramic-scroll.css',
  'css/layouts/cinema-reveal.css', 'css/layouts/frame-scrubber.css',
  'css/layouts/split-reveal.css', 'css/layouts/timeline.css',
  'css/layouts/two-column.css',
]);

/**
 * Stylesheets of layouts added after the registry, in registry order.
 * usedLayouts (a Set of layout names) limits them to those a page uses.
 */
function extraLayoutCss(usedLayouts) {
  return Object.entries(LAYOUTS)
    .filter(([name]) => !usedLayouts || usedLayouts.has(name))
    .map(([, l]) => l.css)
    .filter(css => css && !HAND_LINKED_CSS.has(css));
}

function getLayout(name) {
  return Object.prototype.hasOwnProperty.call(LAYOUTS, name) ? LAYOUTS[name] : null;
}

module.exports = { LAYOUTS, getLayout, extraLayoutCss, HAND_LINKED_CSS };
