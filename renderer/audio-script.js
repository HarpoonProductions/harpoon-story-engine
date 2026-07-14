'use strict';

/**
 * Harpoon Story Engine — Audio script builder.
 *
 * Converts story content to an SSML document for AWS Polly.
 * Extracts: publication title, headline, byline, summary, then
 * section crossheads and body paragraphs in order.
 *
 * Excluded: pull quotes (repeated from body), image captions,
 * stats, cards, video, and any purely visual layout blocks.
 */

// Layouts that contribute nothing useful to a narrated reading
const SKIP_LAYOUTS = new Set([
  'image', 'hero', 'hero_video', 'video', 'frame_scrubber',
  'panoramic_scroll', 'reveal_crossfade', 'sticky_steps',
  'stats', 'cards', 'pull_quote', 'fullbleed_quote',
  'cover',  // cover is handled separately from the meta fields
]);

// Layouts where we read title + body but skip images/captions
const PANELS_LAYOUT = new Set(['panels', 'text_panels']);

/**
 * Build an SSML string from a story content object.
 * @param {object} content  Parsed content.json
 * @returns {string}        SSML wrapped in <speak>
 */
function buildAudioScript(content) {
  const meta     = content.meta     || {};
  const cover    = content.cover    || {};
  const sections = content.sections || [];

  const parts = [];

  // ── Cover / publication header ──────────────────────────────────
  const coverSection = sections.find(s => s.layout === 'cover') || cover;

  const title      = meta.title    || coverSection.headline || '';
  const headlineEm = coverSection.headline_em || '';
  const byline     = coverSection.byline || meta.byline || '';
  const summary    = coverSection.body   || coverSection.summary || '';
  const client     = meta.client   || '';
  const eventName  = meta.event    || '';

  // Opening ident — publication context
  if (client || eventName) {
    const ident = [client, eventName].filter(Boolean).join(', ');
    parts.push(`<p>${x(ident)}.</p>`);
    parts.push(`<break time="400ms"/>`);
  }

  // Headline
  const fullHeadline = headlineEm ? `${title} ${headlineEm}` : title;
  if (fullHeadline) {
    parts.push(`<p><prosody rate="90%" pitch="+2%">${x(fullHeadline)}</prosody></p>`);
    parts.push(`<break time="600ms"/>`);
  }

  // Byline
  if (byline) {
    parts.push(`<p>By ${x(byline)}.</p>`);
    parts.push(`<break time="400ms"/>`);
  }

  // Summary / intro
  if (summary) {
    parts.push(`<p>${x(stripHtml(summary))}</p>`);
  }

  parts.push(`<break time="1200ms"/>`);

  // ── Sections ────────────────────────────────────────────────────
  const bodySections = sections.filter(s => s.layout !== 'cover');

  for (const section of bodySections) {
    if (SKIP_LAYOUTS.has(section.layout)) continue;

    const sectionParts = [];

    // Crosshead
    const crosshead = section.nav_label || section.title || '';
    if (crosshead) {
      sectionParts.push(`<p><prosody rate="95%" pitch="+1%"><emphasis level="moderate">${x(crosshead)}</emphasis></prosody></p>`);
      sectionParts.push(`<break time="500ms"/>`);
    }

    // Intro paragraph
    if (section.intro) {
      sectionParts.push(`<p>${x(stripHtml(section.intro))}</p>`);
    }

    // Body blocks
    if (section.blocks) {
      for (const block of section.blocks) {
        const text = extractBlockText(block);
        if (text) sectionParts.push(`<p>${x(text)}</p>`);
      }
    }

    // Fallback: plain body field
    if (!section.blocks && section.body) {
      sectionParts.push(`<p>${x(stripHtml(section.body))}</p>`);
    }

    // Panels layout — title + body per panel, skip images
    if (PANELS_LAYOUT.has(section.layout) && section.panels) {
      for (const panel of section.panels) {
        if (panel.title) sectionParts.push(`<p><emphasis level="moderate">${x(panel.title)}</emphasis></p>`);
        if (panel.body)  sectionParts.push(`<p>${x(stripHtml(panel.body))}</p>`);
      }
    }

    if (sectionParts.length > 0) {
      parts.push(...sectionParts);
      parts.push(`<break time="900ms"/>`);
    }
  }

  return `<speak>\n${parts.join('\n')}\n</speak>`;
}

// ── Helpers ───────────────────────────────────────────────────────

function extractBlockText(block) {
  if (!block) return '';
  // Skip purely visual block types
  const skipTypes = new Set(['image', 'video', 'caption', 'pull_quote', 'stat', 'divider']);
  if (skipTypes.has(block.type)) return '';
  // Rich text or plain body
  return stripHtml(block.text || block.body || block.content || '').trim();
}

function stripHtml(str) {
  if (!str) return '';
  return str
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<\/p>/gi, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

// Escape for SSML — must not contain raw & < >
function x(str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

module.exports = { buildAudioScript };
