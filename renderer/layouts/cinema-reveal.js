'use strict';

const { escHtml } = require('../shell/head');

function parseVideoUrl(url) {
  if (!url) return null;
  const yt = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  if (yt) return { type: 'youtube', embedUrl: `https://www.youtube.com/embed/${yt[1]}?playsinline=1&rel=0` };
  const vimeo = url.match(/vimeo\.com\/(\d+)/);
  if (vimeo) return { type: 'vimeo', embedUrl: `https://player.vimeo.com/video/${vimeo[1]}?playsinline=1` };
  if (/\.(mp4|webm|mov)(\?|$)/i.test(url)) return { type: 'mp4', embedUrl: url };
  return { type: 'iframe', embedUrl: url };
}

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
