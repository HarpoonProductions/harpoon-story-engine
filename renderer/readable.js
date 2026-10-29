'use strict';

/**
 * Harpoon Story Engine — Readable content.
 *
 * One place that says what each layout contains in words, so the print
 * page, the PDF and the audio narration all read the same thing.
 * Every layout the renderer knows must have an entry in READERS;
 * test.js fails the build when one is missing. A reader reads only the
 * fields its layout shows on screen, so leftovers from a layout change
 * in the editor stay out of print and audio.
 *
 * A reader takes a section and returns a flat list of items:
 *
 *   { kind: 'heading', text, level }          level 2–4
 *   { kind: 'text',    text, style }          style: lead | caption | mono | quote | undefined
 *   { kind: 'quote',   text, attribution, standalone }
 *   { kind: 'stats',   items: [{ value, label }] }
 *   { kind: 'items',   items: [{ title, body, meta }] }
 *   { kind: 'image',   url, alt, caption }    only images flagged print_include
 *
 * Each output decides how to present an item. Audio, for example, skips
 * stats, images and pull quotes that repeat the body (standalone: false).
 *
 * Built-in layouts are the first users of the "alternates" idea in the
 * Custom Section Contract: the engine reads what a section declares,
 * never the visual layout itself.
 */

// ── Readers, one per layout ──────────────────────────────────────

const READERS = {
  // The cover is read by each output's own cover/masthead code.
  'cover': () => [],

  'default': section => [
    ...printImage(section.hero_image),
    ...pullQuote(section.pull_quote),
    ...stats(section.stat_block),
    ...panels(section.toggle_panels, p => p.label),
    ...panels(section.accordion_items, p => p.title),
    ...cards(section.cards),
    ...photoClusters(section.photo_clusters),
    ...printImage(section.interstitial_image),
    ...contributors(section.contributors),
  ],

  'text': section => blocks(section.blocks),

  'parallax': section => [
    ...printImage(section.hero_image),
    ...(section.body ? [text(section.body)] : []),
    ...pullQuote(section.pull_quote),
    ...stats(section.stat_block),
    ...photoClusters(section.photo_clusters),
  ],

  'sticky-steps': section => [
    ...list((section.sticky_steps || []).map((s, i) => ({
      title: s.title || `Step ${i + 1}`,
      body:  s.body,
    }))),
    ...(section.sticky_steps || []).flatMap(s => printImage(s.image)),
  ],

  'stackable-cards':  section => cards(section.cards),
  'cascading-slides': section => cards(section.cards),

  'fullbleed-quote': section => [
    ...printImage(section.hero_image),
    ...pullQuote(section.pull_quote, true),
  ],

  'reveal-crossfade': section => [
    ...(section.crossfade_images || []).flatMap(img => printImage(img)),
    ...(section.crossfade_phases || [])
      .filter(p => p.text)
      .map(p => quote(p.text, p.attribution, true)),
  ],

  'scroll-carousel': section => list((section.carousel_cards || []).map(c => ({
    title: c.number,
    body:  c.text,
  }))),

  'panoramic-scroll': section => [
    ...printImage(section.panoramic_image),
    ...(section.panoramic_panels || []).flatMap(p => [
      ...printImage(p.image),
      ...(p.text ? [quote(p.text, p.attribution, true)] : []),
    ]),
  ],

  'frame-scrubber': section => (section.scrubber_panels || [])
    .filter(p => p.text)
    .map(p => quote(p.text, p.attribution, true)),

  'cinema-reveal': section => section.cinema?.caption
    ? [text(section.cinema.caption, 'caption')] : [],

  'split-reveal': section => {
    const sr = section.split_reveal || {};
    const heading = [sr.heading_em, sr.heading].filter(Boolean).join(' ');
    return [
      ...(heading ? [{ kind: 'heading', text: heading, level: 3 }] : []),
      ...printImage(sr.image),
      ...(sr.blocks || []).flatMap(b => b.type === 'image-row'
        ? (b.images || []).flatMap(img => printImage(img))
        : (b.text ? [text(b.text)] : [])),
    ];
  },

  'two-column': section => ((section.two_column || {}).blocks || []).flatMap(b => {
    if (b.type === 'image') return printImage(b);
    if (b.type === 'html' || b.type === 'column-break') return [];
    return b.text ? [text(b.text)] : [];
  }),

  'timeline': section => list((section.timeline_entries || []).map(e => ({
    title: e.heading,
    meta:  e.date,
    body:  e.body,
  }))).concat((section.timeline_entries || []).flatMap(e => printImage(e.image))),

  // Arbitrary HTML can't be read reliably. Only its caption is used.
  'custom-html': section => section.custom_html?.caption
    ? [text(section.custom_html.caption, 'caption')] : [],
};

// Layouts that show section.intro on screen. Others can carry a stale
// intro left over from a layout change in the editor; it stays unread.
const SHOWS_INTRO = new Set([
  'default', 'text', 'parallax', 'sticky-steps', 'stackable-cards',
  'cascading-slides', 'scroll-carousel', 'cinema-reveal', 'two-column',
]);

/**
 * The words in a section, in reading order.
 * @returns {{ label: string, title: string, intro: string[], items: object[] }}
 */
function readSection(section) {
  const layout = section.layout || 'default';
  const reader = READERS[layout];
  if (!reader) {
    console.warn(`[readable] No reader for layout "${layout}" (section ${section.id}); using default`);
  }
  return {
    label: section.nav_label || '',
    title: section.title || '',
    intro: section.intro && SHOWS_INTRO.has(layout)
      ? section.intro.split(/\n\n+/).map(p => p.trim()).filter(Boolean)
      : [],
    items: (reader || READERS.default)(section).filter(Boolean),
  };
}

function hasReader(layout) {
  return Object.prototype.hasOwnProperty.call(READERS, layout);
}

// ── Item builders ────────────────────────────────────────────────

function text(str, style) {
  return { kind: 'text', text: str, style };
}

function quote(str, attribution, standalone = false) {
  return { kind: 'quote', text: str, attribution: attribution || '', standalone };
}

function list(items) {
  const clean = items.filter(i => i.title || i.body);
  return clean.length ? [{ kind: 'items', items: clean }] : [];
}

function blocks(arr) {
  return (arr || []).filter(b => b.text).map(b => {
    if (['h2', 'h3', 'h4'].includes(b.tag)) {
      return { kind: 'heading', text: b.text, level: Number(b.tag[1]) };
    }
    if (b.tag === 'blockquote') return text(b.text, 'quote');
    return text(b.text, ['lead', 'caption', 'mono'].includes(b.style) ? b.style : undefined);
  });
}

function pullQuote(pq, standalone = false) {
  return pq?.text ? [quote(pq.text, pq.attribution, standalone)] : [];
}

function stats(arr) {
  return arr?.length ? [{ kind: 'stats', items: arr }] : [];
}

function panels(arr, titleOf) {
  return [
    ...list((arr || []).map(p => ({ title: titleOf(p), body: p.body || p.content }))),
    ...(arr || []).flatMap(p => printImage(p.image)),
  ];
}

function cards(arr) {
  return [
    ...list((arr || []).map(c => ({ title: c.title || c.tag, body: c.body }))),
    ...(arr || []).flatMap(c => printImage(c.image)),
  ];
}

function photoClusters(arr) {
  return (arr || []).flatMap(c => (c.images || []).flatMap(img => printImage(img)));
}

function contributors(arr) {
  return list((arr || []).map(c => ({
    title: [c.name, c.title].filter(Boolean).join(', '),
    body:  c.bio,
  })));
}

// Only images an editor has ticked "Include in print & PDF" for.
function printImage(img) {
  if (!img || !img.url || img.print_include !== true) return [];
  return [{ kind: 'image', url: img.url, alt: img.alt || '', caption: img.caption || '' }];
}

module.exports = { readSection, hasReader, READERS };
