/* eslint-env node */
/* eslint-disable no-undef */
const fs = require('fs');
const path = require('path');

/**
 * Registers all individual operation schemas with AJV.
 *
 * @param {import('ajv').default} ajv - AJV instance
 */
function loadOperationSchemas(ajv) {
  // First, load the base-operation schema that operation schemas depend on
  const baseSchemaPath = path.join(
    __dirname,
    '..',
    '..',
    '..',
    'data',
    'schemas',
    'base-operation.schema.json'
  );
  const baseSchema = require(baseSchemaPath);
  ajv.addSchema(
    baseSchema,
    'http://example.com/schemas/base-operation.schema.json'
  );

  // Then load all individual operation schemas
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
