/* eslint-env node */
/**
 * @description Registers condition-related schemas with AJV for testing.
 * @param {import('ajv').default} ajv - AJV instance
 * @returns {void}
 */
function loadConditionSchemas(ajv) {
  const containerSchema = require('../..//data/schemas/condition-container.schema.json');
  const conditionSchema = require('../..//data/schemas/condition.schema.json');
  ajv.addSchema(
    containerSchema,
    'http://example.com/schemas/condition-container.schema.json'
  );
  ajv.addSchema(
    conditionSchema,
    'http://example.com/schemas/condition.schema.json'
  );
}
module.exports = loadConditionSchemas;
