/* eslint-env node */
const fs = require('fs');
const path = require('path');

/**
 * Registers all individual operation schemas with AJV.
 *
 * @param {import('ajv').default} ajv - AJV instance
 */
function loadOperationSchemas(ajv) {
  const baseDir = path.join(__dirname, '..', '..', '..', 'data', 'schemas');
  const dir = path.join(baseDir, 'operations');

  // Load the shared base schema first so operation schemas can reference it
  const baseSchema = require(path.join(baseDir, 'operation-base.schema.json'));
  ajv.addSchema(
    baseSchema,
    'http://example.com/schemas/operation-base.schema.json'
  );
  for (const file of fs.readdirSync(dir)) {
    const schema = require(path.join(dir, file));
    const id = `http://example.com/schemas/operations/${file}`;
    ajv.addSchema(schema, id);
  }
}

module.exports = loadOperationSchemas;
