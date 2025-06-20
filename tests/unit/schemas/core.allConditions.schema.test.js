import fs from 'fs';
import path from 'path';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import { describe, beforeAll, test, expect } from '@jest/globals';
import conditionSchema from '../../../data/schemas/condition.schema.json';
import commonSchema from '../../../data/schemas/common.schema.json';
import jsonLogicSchema from '../../../data/schemas/json-logic.schema.json';
import conditionContainerSchema from '../../../data/schemas/condition-container.schema.json';

const conditionDir = path.resolve(
  __dirname,
  '../../../data/mods/core/conditions'
);

/** @type {import('ajv').ValidateFunction} */
let validate;

beforeAll(() => {
  const ajv = new Ajv({ allErrors: true });
  addFormats(ajv);
  ajv.addSchema(commonSchema, 'http://example.com/schemas/common.schema.json');
  ajv.addSchema(
    jsonLogicSchema,
    'http://example.com/schemas/json-logic.schema.json'
  );
  ajv.addSchema(
    conditionContainerSchema,
    'http://example.com/schemas/condition-container.schema.json'
  );
  validate = ajv.compile(conditionSchema);
});

describe('JSON-Schema – core condition definitions', () => {
  fs.readdirSync(conditionDir)
    .filter((f) => f.endsWith('.json'))
    .forEach((file) => {
      const data = JSON.parse(
        fs.readFileSync(path.join(conditionDir, file), 'utf8')
      );

      test(`${data.id} should be a valid condition definition`, () => {
        const ok = validate(data);
        if (!ok) {
          console.error(`Validation errors for ${data.id}:`, validate.errors);
        }
        expect(ok).toBe(true);
      });
    });
});
