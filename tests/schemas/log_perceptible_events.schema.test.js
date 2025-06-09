// tests/schemas/log_perceptible_events.schema.test.js

import { test, expect, describe, beforeAll } from '@jest/globals';

const Ajv = require('ajv');
const addFormats = require('ajv-formats');
const path = require('path');

// Schemas
const ruleSchema = require('../../data/schemas/rule.schema.json');
const commonSchema = require('../../data/schemas/common.schema.json');
const operationSchema = require('../../data/schemas/operation.schema.json');
const jsonLogicSchema = require('../../data/schemas/json-logic.schema.json');

// Rule under test
const rule = require('../../data/mods/core/rules/log_perceptible_events.rule.json');

describe('core/rules/log_perceptible_events.rule.json', () => {
  let ajv;

  beforeAll(() => {
    ajv = new Ajv({ allErrors: true });
    addFormats(ajv);

    // Register dependent schemas under their canonical $id so $refs resolve
    ajv.addSchema(
      commonSchema,
      'http://example.com/schemas/common.schema.json'
    );
    ajv.addSchema(
      operationSchema,
      'http://example.com/schemas/operation.schema.json'
    );
    ajv.addSchema(
      jsonLogicSchema,
      'http://example.com/schemas/json-logic.schema.json'
    );
  });

  test('validates against the System Rule schema', () => {
    const valid = ajv.validate(ruleSchema, rule);
    if (!valid) {
      console.error('AJV validation errors:', ajv.errors);
    }
    expect(valid).toBe(true);
  });
});
