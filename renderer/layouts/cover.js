'use strict';

const { renderCover } = require('../render-cover');

function renderCoverLayout(section) {
  return renderCover(section);
}

module.exports = { renderCoverLayout };
