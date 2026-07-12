'use strict';

const { escHtml } = require('../shell/head');
const { renderBackground } = require('../blocks/background');

/**
 * Renders a two-column text section.
 *
 * Blocks are split at the first `column-break` marker; everything before
 * goes in the left column, everything after in the right. If no break is
 * present all blocks sit in the left column (single-column mode).
 *
 * Block types: p | image | html | column-break
 * split: integer 10–90 representing left-column width %. Default 50.
 */
function renderTwoColumn(section) {
  const { wrapperAttrs, bgHtml } = renderBackground(section.background);
  const tc     = section.two_column || {};
  const blocks = tc.blocks || [];
  const split  = Math.min(90, Math.max(10, parseInt(tc.split, 10) || 50));
  const rest   = 100 - split;

  const title = section.title
    ? `<h2 class="hse-heading hse-reveal">${escHtml(section.title)}</h2>`
    : '';

  const intro = section.intro
    ? section.intro.split(/\n\n+/).map(p =>
        `<p class="hse-section-intro hse-reveal">${escHtml(p.trim())}</p>`
      ).join('\n      ')
    : '';

  // Split at first column-break marker
  const breakIdx = blocks.findIndex(b => b.type === 'column-break');
  const leftBlocks  = breakIdx === -1 ? blocks : blocks.slice(0, breakIdx);
  const rightBlocks = breakIdx === -1 ? []     : blocks.slice(breakIdx + 1);

  function renderBlock(block) {
    switch (block.type) {
      case 'image': {
        const focal = block.focal ? ` style="object-position:${escHtml(block.focal)}"` : '';
        const cap   = block.caption
          ? `<figcaption class="hse-tc__caption">${escHtml(block.caption)}</figcaption>`
          : '';
        return `<figure class="hse-tc__image hse-reveal">
        <img src="${escHtml(block.url || '')}" alt="${escHtml(block.alt || '')}"${focal} loading="lazy">
        ${cap}
      </figure>`;
      }
      case 'html':
        return `<div class="hse-tc__embed">${block.code || ''}</div>`;
      default: // p
        return `<p class="hse-tc__para hse-reveal">${escHtml(block.text || '')}</p>`;
    }
  }

  const leftHtml  = leftBlocks.map(renderBlock).join('\n      ');
  const rightHtml = rightBlocks.map(renderBlock).join('\n      ');

  return `<section
  class="hse-section hse-section--two-column${wrapperAttrs}"
  id="${escHtml(section.id)}"
  data-layout="two-column">
  ${bgHtml}
  <div class="hse-inner">
    ${title || intro ? `<header class="hse-section-header">
      ${title}
      ${intro}
    </header>` : ''}
    <div class="hse-tc__grid" style="--hse-tc-left:${split}fr;--hse-tc-right:${rest}fr">
      <div class="hse-tc__col hse-tc__col--left">
        ${leftHtml || ''}
      </div>
      <div class="hse-tc__col hse-tc__col--right">
        ${rightHtml || ''}
      </div>
    </div>
  </div>
</section>`;
}

module.exports = { renderTwoColumn };
