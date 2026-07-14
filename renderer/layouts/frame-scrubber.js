'use strict';

const { escHtml } = require('../shell/head');

function renderFrameScrubber(section) {
  const sc      = section.scrubber || {};
  const panels  = section.scrubber_panels || [];

  const baseUrl    = sc.base_url    || '';
  const frameCount = sc.frame_count || 60;
  const prefix     = sc.frame_prefix || 'frame-';
  const digits     = sc.frame_digits || 3;
  const scrollLen  = sc.scroll_length || 5;
  const poster     = sc.poster || '';

  const textsHtml = panels.map((panel, i) => {
    const tx = panel.text_position ? panel.text_position.x : null;
    const ty = panel.text_position ? panel.text_position.y : null;
    const posStyle = (tx !== null && ty !== null) ? `style="--tx:${tx}%;--ty:${ty}%"` : '';
    return `<div class="hse-fs__text-item${i === 0 ? ' is-active' : ''}"
         data-frame-start="${panel.frame_start || 0}"
         data-frame-end="${panel.frame_end || frameCount}"
         ${posStyle}>
      ${panel.text        ? `<p class="hse-fs__text">${escHtml(panel.text)}</p>` : ''}
      ${panel.attribution ? `<span class="hse-fs__attribution hse-label">${escHtml(panel.attribution)}</span>` : ''}
    </div>`;
  }).join('\n');

  const titleHtml = section.title
    ? `<div class="hse-fs__header">
        <h2 class="hse-fs__title">${escHtml(section.title)}</h2>
      </div>`
    : '';

  return `<section
  class="hse-section hse-section--frame-scrubber"
  id="${escHtml(section.id)}"
  data-layout="frame-scrubber"
  data-base-url="${escHtml(baseUrl)}"
  data-frame-count="${frameCount}"
  data-frame-prefix="${escHtml(prefix)}"
  data-frame-digits="${digits}"
  ${poster ? `data-poster="${escHtml(poster)}"` : ''}
  style="--scroll-length:${scrollLen}">

  <div class="hse-fs__sticky">
    <canvas class="hse-fs__canvas"
            role="img"
            aria-label="${escHtml(section.title || 'Animated sequence')}"></canvas>

    <div class="hse-fs__gradient" aria-hidden="true"></div>

    ${titleHtml}

    <div class="hse-fs__texts" aria-live="polite">
      ${textsHtml}
    </div>

    <div class="hse-fs__progress-bar" aria-hidden="true"><span></span></div>
  </div>

</section>`;
}

module.exports = { renderFrameScrubber };
