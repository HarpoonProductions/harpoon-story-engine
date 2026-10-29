'use strict';

/**
 * Harpoon Story Engine — Audio script builder.
 *
 * Converts story content to an SSML document for AWS Polly.
 * Extracts: publication title, headline, byline, summary, then each
 * section's crosshead and words in order, as read by readable.js (the same
 * content the print page and PDF use).
 *
 * Excluded: pull quotes that repeat the body, captions, stats and images.
 * Quotes that are a section's main content (full-bleed quotes, crossfade
 * and panoramic text) are read.
 */

const { readSection } = require('./readable');

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
    parts.push(`<p><prosody rate="85%">${x(fullHeadline)}</prosody></p>`);
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
    const { label, title, intro, items } = readSection(section);
    const sectionParts = [];

    // Crosshead
    const crosshead = label || title;
    if (crosshead) {
      sectionParts.push(`<p><prosody rate="90%">${x(crosshead)}</prosody></p>`);
      sectionParts.push(`<break time="500ms"/>`);
    }

    // Intro paragraphs
    for (const p of intro) sectionParts.push(`<p>${x(stripHtml(p))}</p>`);

    // Body
    for (const item of items) sectionParts.push(...speakItem(item));

    // A crosshead alone is not worth a pause in the narration
    if (sectionParts.length > 2 || (sectionParts.length && !crosshead)) {
      parts.push(...sectionParts);
      parts.push(`<break time="900ms"/>`);
    }
  }

  return `<speak>\n${parts.join('\n')}\n</speak>`;
}

// ── Helpers ───────────────────────────────────────────────────────

function speakItem(item) {
  switch (item.kind) {
    case 'heading':
      return [`<p><prosody rate="90%">${x(stripHtml(item.text))}</prosody></p>`];
    case 'text':
      if (item.style === 'caption') return [];
      return [`<p>${x(stripHtml(item.text))}</p>`];
    case 'quote':
      if (!item.standalone) return [];
      return [`<p>${x(stripHtml(item.text))}${item.attribution ? ` <break time="300ms"/>${x(stripHtml(item.attribution))}.` : ''}</p>`];
    case 'items':
      return item.items.flatMap(i => {
        const heading = [i.meta, i.title].filter(Boolean).join('. ');
        return [
          heading ? `<p><prosody rate="90%">${x(stripHtml(heading))}</prosody></p>` : '',
          i.body  ? `<p>${x(stripHtml(i.body))}</p>` : '',
        ].filter(Boolean);
      });
    default:
      // stats and images are not read aloud
      return [];
  }
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
