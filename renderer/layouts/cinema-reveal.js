'use strict';

const { escHtml, parseVideoUrl } = require('../shell/head');

function renderCinemaReveal(section) {
  const cinema  = section.cinema || {};
  const video   = parseVideoUrl(cinema.url);
  const aspect  = (cinema.aspect || '16/9').replace('/', '-');
  const caption = cinema.caption || '';

  const title = section.title
    ? `<h2 class="hse-section-title hse-reveal">${escHtml(section.title)}</h2>`
    : '';

  const intro = section.intro
    ? section.intro.split(/\n\n+/).map(p => `<p class="hse-section-intro hse-reveal">${escHtml(p.trim())}</p>`).join('\n    ')
    : '';

  let mediaHtml = '';
  if (video) {
    if (video.type === 'mp4') {
      mediaHtml = `<video class="hse-cr__video"
        src="${escHtml(video.embedUrl)}"
        playsinline muted loop
        ${cinema.poster ? `poster="${escHtml(cinema.poster)}"` : ''}></video>`;
    } else {
      mediaHtml = `<iframe class="hse-cr__iframe"
        src="${escHtml(video.embedUrl)}"
        allow="autoplay; fullscreen; picture-in-picture"
        allowfullscreen
        title="${escHtml(section.title || 'Video')}"></iframe>`;
    }
  }

  return `<section
  class="hse-section hse-section--cinema-reveal"
  id="${escHtml(section.id)}"
  data-layout="cinema-reveal">

  <div class="hse-cr__sticky">
    ${title || intro ? `<div class="hse-cr__header">
      <div class="hse-inner--text">
        ${title}
        ${intro}
      </div>
    </div>` : ''}

    <div class="hse-cr__card" data-aspect="${escHtml(aspect)}">
      <div class="hse-cr__frame">
        ${mediaHtml}
      </div>
    </div>

    ${caption ? `<p class="hse-cr__caption">${escHtml(caption)}</p>` : ''}
  </div>

</section>`;
}

module.exports = { renderCinemaReveal };
