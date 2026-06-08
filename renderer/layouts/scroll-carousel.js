"use strict";

const { escHtml } = require("../shell/head");

/**
 * Renders a scroll-driven card carousel section.
 * Cards slide horizontally as the user scrolls through a tall section.
 * Text panel updates below the cards on each active card.
 *
 * @param {object} section - HSE section definition
 * @returns {string} HTML string
 */
function renderScrollCarousel(section) {
  const cards = section.carousel_cards || [];
  const title = section.title || "";
  const intro = section.intro || "";

  const cardsHtml = cards
    .map((card, i) => {
      const img = card.image || {};
      const num = card.number || String(i + 1).padStart(2, "0");

      return `<article class="hse-sc__card${i === 0 ? " is-active" : ""}" data-index="${i}">
      ${
        img.url
          ? `<div class="hse-sc__media">
        <img src="${escHtml(img.url)}" alt="${escHtml(img.alt || "")}" loading="lazy">
      </div>`
          : ""
      }
      <div class="hse-sc__number">${escHtml(num)}</div>
      <div class="hse-sc__content" hidden>
        ${escHtml(card.text || "")
          .split("\n\n")
          .map((p) => `<p>${p}</p>`)
          .join("")}
      </div>
    </article>`;
    })
    .join("\n");

  const headerHtml =
    title || intro
      ? `
    <div class="hse-sc__header">
      ${title ? `<h2 class="hse-sc__title hse-reveal">${escHtml(title)}</h2>` : ""}
      ${intro ? `<p class="hse-sc__intro hse-reveal">${escHtml(intro)}</p>` : ""}
    </div>`
      : "";

  return `<section
  class="hse-section hse-section--scroll-carousel"
  id="${escHtml(section.id)}"
  data-layout="scroll-carousel"
  data-card-count="${cards.length}">

  <div class="hse-sc__sticky">
    ${headerHtml}

    <div class="hse-sc__progress-wrap">
      <div class="hse-sc__progress"><span></span></div>
    </div>

    <div class="hse-sc__viewport">
      <div class="hse-sc__track">
        ${cardsHtml}
      </div>
    </div>

    <div class="hse-sc__text">
      <div class="hse-sc__text-item is-active"></div>
    </div>

    <div class="hse-sc__controls">
      <button type="button" class="hse-sc__prev" aria-label="Previous card">←</button>
      <button type="button" class="hse-sc__next" aria-label="Next card">→</button>
    </div>
  </div>

</section>`;
}

module.exports = { renderScrollCarousel };
