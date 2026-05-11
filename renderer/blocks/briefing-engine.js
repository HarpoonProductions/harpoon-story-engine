'use strict';

const { escHtml } = require('../shell/head');

/**
 * Renders a briefing_engine stub block.
 * The full Briefing Engine integration is a separate workstream.
 * This renders the declared interface — chat panel, welcome message,
 * prompt chips — as a static shell ready to be activated.
 *
 * @param {object} be  - HSE briefing_engine definition
 * @returns {string} HTML string
 */
function renderBriefingEngine(be) {
  if (!be || !be.report_id) return '';

  const chips = be.suggested_questions && be.suggested_questions.length > 0
    ? `<div class="hse-be__chips">
        ${be.suggested_questions.map(q =>
          `<button class="hse-be__chip" data-question="${escHtml(q)}">${escHtml(q)}</button>`
        ).join('\n')}
      </div>`
    : '';

  return `<div
  class="hse-briefing-engine"
  data-report-id="${escHtml(be.report_id)}"
  aria-label="${escHtml(be.title)}">

  <div class="hse-be__header">
    <span class="hse-eyebrow">Briefing Engine</span>
    <h3 class="hse-be__title">${escHtml(be.title)}</h3>
  </div>

  <div class="hse-be__chat">
    <div class="hse-be__messages" role="log" aria-live="polite">
      <div class="hse-be__message hse-be__message--agent">
        <p>${escHtml(be.welcome_message || 'Ask me anything about this report.')}</p>
      </div>
    </div>
    ${chips}
    <div class="hse-be__input-row">
      <input
        type="text"
        class="hse-be__input"
        placeholder="Ask a question…"
        aria-label="Ask the Briefing Engine a question">
      <button class="hse-be__send hse-btn hse-btn--primary" aria-label="Send">→</button>
    </div>
  </div>

  <p class="hse-be__notice hse-label">
    Briefing Engine integration pending — report ID: ${escHtml(be.report_id)}
  </p>

</div>`;
}

module.exports = { renderBriefingEngine };
