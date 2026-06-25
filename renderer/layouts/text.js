'use strict';

const { escHtml } = require('../shell/head');
const { renderBackground } = require('../blocks/background');

/**
 * Renders a section using the text layout.
 * Supports flexible text blocks with individual tag, alignment and style.
 *
 * @param {object} section - HSE section definition
 * @returns {string} HTML string
 */
function renderText(section) {
  const { wrapperAttrs, bgHtml } = renderBackground(section.background);
  const blocks = section.blocks || [];

  const colorBleed = section.color_bleed ? ' hse-section--color-bleed' : '';

  const blockHtml = blocks.map(block => {
    const tag    = ['p','h2','h3','h4','blockquote'].includes(block.tag) ? block.tag : 'p';
    const align  = ['left','center','right'].includes(block.align) ? block.align : 'left';
    const style  = ['lead','caption','display','mono'].includes(block.style) ? block.style : '';

    const classes = [
      'hse-text-block',
      `hse-text-block--${tag}`,
      align !== 'left' ? `hse-text-block--${align}` : '',
      style ? `hse-text-block--${style}` : '',
      'hse-reveal',
    ].filter(Boolean).join(' ');

    // Preserve line breaks — double newline becomes paragraph break within block
    const text = escHtml(block.text || '').replace(/\n\n/g, '</p><p>').replace(/\n/g, '<br>');

    return `<${tag} class="${classes}">${text}</${tag}>`;
  }).join('\n  ');

  const title = section.title
    ? `<h2 class="hse-heading hse-reveal">${escHtml(section.title)}</h2>`
    : '';

  const intro = section.intro
    ? section.intro.split(/\n\n+/).map(p => `<p class="hse-section-intro hse-reveal">${escHtml(p.trim())}</p>`).join('\n    ')
    : '';

  return `<section class="hse-section hse-section--text${colorBleed}${wrapperAttrs}" id="${escHtml(section.id)}" data-layout="text">
  ${bgHtml}
  <div class="hse-inner hse-inner--text">
    ${title ? `<header class="hse-section-header">${title}</header>` : ''}
    ${intro}
    <div class="hse-text-blocks">
      ${blockHtml}
    </div>
  </div>
</section>`;
}

module.exports = { renderText };
