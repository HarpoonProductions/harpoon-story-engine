'use strict';

const { escHtml } = require('../shell/head');
const { renderImage } = require('./image');

/**
 * Renders a toggle_panels array as a tabbed interface.
 * @param {Array} panels  - array of HSE toggle_panel definitions
 * @returns {string} HTML string
 */
function renderTogglePanels(panels) {
  if (!panels || panels.length === 0) return '';

  const buttons = panels.map((panel, i) =>
    `<button
  class="hse-toggle__btn${i === 0 ? ' is-active' : ''}"
  data-panel="${escHtml(panel.id)}"
  aria-selected="${i === 0 ? 'true' : 'false'}"
  role="tab">
  ${panel.icon ? `<span class="hse-toggle__btn-icon" aria-hidden="true">◆</span>` : ''}
  ${escHtml(panel.label)}
</button>`
  ).join('\n');

  const panelItems = panels.map((panel, i) =>
    `<div
  class="hse-toggle__panel${i === 0 ? ' is-active' : ''}"
  id="panel-${escHtml(panel.id)}"
  role="tabpanel"
  hidden="${i === 0 ? 'false' : 'true'}">
  <div class="hse-toggle__panel-inner">
    <div class="hse-toggle__panel-body">${panel.body || ''}</div>
    ${panel.image ? renderImage(panel.image, 'hse-toggle__panel-image') : ''}
  </div>
</div>`
  ).join('\n');

  return `<div class="hse-toggle" role="tablist">
  <div class="hse-toggle__buttons">
    ${buttons}
  </div>
  <div class="hse-toggle__panels">
    ${panelItems}
  </div>
</div>`;
}

module.exports = { renderTogglePanels };
