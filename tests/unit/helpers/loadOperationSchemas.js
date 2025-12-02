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
    'schema://living-narrative-engine/base-operation.schema.json'
  );

  // Load the nested-operation schema that operation schemas depend on
  const nestedSchemaPath = path.join(
    __dirname,
    '..',
    '..',
    '..',
    'data',
    'schemas',
    'nested-operation.schema.json'
  );
  const nestedSchema = require(nestedSchemaPath);
  ajv.addSchema(
    nestedSchema,
    'schema://living-narrative-engine/nested-operation.schema.json'
  );

  // Load damage-capability-entry schema that applyDamage operation depends on
  const damageCapabilityEntryPath = path.join(
    __dirname,
    '..',
    '..',
    '..',
    'data',
    'schemas',
    'damage-capability-entry.schema.json'
  );
  const damageCapabilityEntrySchema = require(damageCapabilityEntryPath);
  ajv.addSchema(
    damageCapabilityEntrySchema,
    'schema://living-narrative-engine/damage-capability-entry.schema.json'
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
    const id = `schema://living-narrative-engine/operations/${file}`;
    ajv.addSchema(schema, id);
  }
}

module.exports = loadOperationSchemas;
