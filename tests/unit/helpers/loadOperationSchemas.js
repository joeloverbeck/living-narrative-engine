/* eslint-env node */
const fs = require('fs');
const path = require('path');

/**
 * Registers all individual operation schemas with AJV.
 *
 * @param {import('ajv').default} ajv - AJV instance
 */
function loadOperationSchemas(ajv) {
  const dir = path.join(
    __dirname,
    '..',
    '..',
    '..',
    'data',
    'schemas',
    'operations'
  );
  for (const file of fs.readdirSync(dir)) {
    const schema = require(path.join(dir, file));
    const id = `http://example.com/schemas/operations/${file}`;
    ajv.addSchema(schema, id);
  }
}

module.exports = loadOperationSchemas;
