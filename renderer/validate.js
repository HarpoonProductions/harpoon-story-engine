'use strict';

const fs  = require('fs');
const path = require('path');
const Ajv  = require('ajv');

const ajv    = new Ajv({ allErrors: true });
const schema = JSON.parse(
  fs.readFileSync(path.join(__dirname, '../schema/content.schema.json'), 'utf8')
);
const _validate = ajv.compile(schema);

const magazineCoverSchema = JSON.parse(
  fs.readFileSync(path.join(__dirname, '../schema/magazine-cover.schema.json'), 'utf8')
);
const _validateMagazineCover = ajv.compile(magazineCoverSchema);

const graduationSchema = JSON.parse(
  fs.readFileSync(path.join(__dirname, '../schema/graduation.schema.json'), 'utf8')
);
const _validateGraduation = ajv.compile(graduationSchema);

/**
 * Validate a content object against the HSE schema. Dispatches to the
 * graduation-guide schema when content.kind selects that render path.
 * @param {object} content
 * @returns {Array} Array of AJV error objects (empty = valid)
 */
function validate(content) {
  if (content && content.kind === 'graduation-guide') {
    const valid = _validateGraduation(content);
    return valid ? [] : (_validateGraduation.errors || []);
  }
  const valid = _validate(content);
  return valid ? [] : (_validate.errors || []);
}

/**
 * Validate a magazine cover object against the HSE magazine-cover schema.
 * @param {object} cover
 * @returns {Array} Array of AJV error objects (empty = valid)
 */
function validateMagazineCover(cover) {
  const valid = _validateMagazineCover(cover);
  return valid ? [] : (_validateMagazineCover.errors || []);
}

module.exports = { validate, validateMagazineCover };
