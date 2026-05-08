'use strict';

const fs  = require('fs');
const path = require('path');
const Ajv  = require('ajv');

const ajv    = new Ajv({ allErrors: true });
const schema = JSON.parse(
  fs.readFileSync(path.join(__dirname, '../schema/content.schema.json'), 'utf8')
);
const _validate = ajv.compile(schema);

/**
 * Validate a content object against the HSE schema.
 * @param {object} content
 * @returns {Array} Array of AJV error objects (empty = valid)
 */
function validate(content) {
  const valid = _validate(content);
  return valid ? [] : (_validate.errors || []);
}

module.exports = { validate };
