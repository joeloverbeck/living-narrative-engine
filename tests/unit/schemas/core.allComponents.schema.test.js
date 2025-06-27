import fs from 'fs';
import path from 'path';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import { describe, test, expect } from '@jest/globals';
import commonSchema from '../../../data/schemas/common.schema.json';

/**
 * @description Compiles a component's data schema for validation.
 * @param {string} filePath - Absolute path to the component JSON file.
 * @param {Ajv} ajv - Configured Ajv instance.
 * @returns {{ id: string, validate: import('ajv').ValidateFunction }}
 */
function compileComponentSchema(filePath, ajv) {
  const component = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  const dataSchema = { ...component.dataSchema, $id: component.id };
  return { id: component.id, validate: ajv.compile(dataSchema) };
}

/** @type {Record<string, import('ajv').ValidateFunction>} */
const validators = {};

const ajv = new Ajv({ strict: true, allErrors: true });
addFormats(ajv);
ajv.addSchema(commonSchema, commonSchema.$id);

const componentDir = path.resolve(
  __dirname,
  '../../../data/mods/core/components'
);

fs.readdirSync(componentDir)
  .filter((f) => f.endsWith('.json'))
  .forEach((file) => {
    const { id, validate } = compileComponentSchema(
      path.join(componentDir, file),
      ajv
    );
    validators[id] = validate;
  });

describe('JSON-Schema – core component data contracts', () => {
  /** @type {Record<string, unknown>} */
  const validPayloads = {
    'core:actor': {},
    'core:current_actor': {},
    'core:player': {},
    'core:player_type': { type: 'human' },
    'core:description': { text: 'desc' },
    'core:dislikes': { text: 'dislike' },
    'core:fears': { text: 'fear' },
    'core:likes': { text: 'like' },
    'core:personality': { text: 'trait' },
    'core:profile': { text: 'profile' },
    'core:secrets': { text: 'secret' },
    'core:name': { text: 'Alice' },
    'core:following': { leaderId: 'core:leader' },
    'core:leading': { followers: ['core:follower'] },
    'core:movement': { locked: false },
    'core:notes': { notes: [] },
    'core:goals': { goals: [] },
    'core:perception_log': { logEntries: [], maxEntries: 5 },
    'core:portrait': { imagePath: 'image.png', altText: 'desc' },
    'core:position': { locationId: 'core:room' },
    'core:short_term_memory': { thoughts: [], maxEntries: 5 },
    'core:speech_patterns': { patterns: ['hello'] },
    'core:exits': [],
  };

  /** @type {Record<string, unknown>} */
  const invalidPayloads = {
    'core:actor': { extra: true },
    'core:current_actor': { extra: true },
    'core:player': { extra: true },
    'core:player_type': { type: 'invalid_type' },
    'core:description': {},
    'core:dislikes': {},
    'core:fears': {},
    'core:likes': {},
    'core:personality': {},
    'core:profile': {},
    'core:secrets': {},
    'core:name': {},
    'core:following': {},
    'core:leading': { followers: 'nope' },
    'core:movement': {},
    'core:notes': {},
    'core:goals': {},
    'core:perception_log': {},
    'core:portrait': {},
    'core:position': {},
    'core:short_term_memory': {},
    'core:speech_patterns': {},
    'core:exits': {},
  };

  Object.entries(validators).forEach(([id, validate]) => {
    describe(id, () => {
      test('✓ valid payload', () => {
        const payload = validPayloads[id];
        const ok = validate(payload);
        if (!ok) console.error(validate.errors);
        expect(ok).toBe(true);
      });

      test('✗ invalid payload', () => {
        const payload = invalidPayloads[id];
        expect(validate(payload)).toBe(false);
      });
    });
  });
});
