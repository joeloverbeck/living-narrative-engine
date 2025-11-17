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

const coreComponentDir = path.resolve(
  __dirname,
  '../../../data/mods/core/components'
);

const anatomyComponentDir = path.resolve(
  __dirname,
  '../../../data/mods/anatomy/components'
);

// Load core components
fs.readdirSync(coreComponentDir)
  .filter((f) => f.endsWith('.json'))
  .forEach((file) => {
    const { id, validate } = compileComponentSchema(
      path.join(coreComponentDir, file),
      ajv
    );
    validators[id] = validate;
  });

// Load anatomy components
fs.readdirSync(anatomyComponentDir)
  .filter((f) => f.endsWith('.json'))
  .forEach((file) => {
    const { id, validate } = compileComponentSchema(
      path.join(anatomyComponentDir, file),
      ajv
    );
    validators[id] = validate;
  });

describe('JSON-Schema – core component data contracts', () => {
  /** @type {Record<string, unknown>} */
  const validPayloads = {
    'core:actor': {},
    'core:apparent_age': { minAge: 25, maxAge: 35 },
    'core:current_actor': {},
    'core:player': {},
    'core:player_type': { type: 'human' },
    'core:description': { text: 'desc' },
    'core:dilemmas': { text: 'Am I doing the right thing?' },
    'core:dislikes': { text: 'dislike' },
    'core:fears': { text: 'fear' },
    'core:internal_tensions': { text: 'I want freedom but crave security' },
    'core:known_to': { entities: [] },
    'core:likes': { text: 'like' },
    'core:motivations': { text: 'I need to prove my worth to myself' },
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
    'core:strengths': { text: 'I am good at problem solving' },
    'core:visible': { isVisible: true },
    'core:weaknesses': { text: 'I tend to be impatient' },
    "movement:exits": [],
    'anatomy:part': { subType: 'leg' },
    'anatomy:sockets': {
      sockets: [
        { id: 'front_left_ankle', orientation: 'left_front', allowedTypes: ['foot'] },
      ],
    },
    'anatomy:joint': { parentId: 'entity-123', socketId: 'ankle' },
    'anatomy:body': { recipeId: 'anatomy:human_female' },
    'anatomy:blueprintSlot': { slotId: 'left_breast' },
    'anatomy:prehensile': { strength: 'moderate', dexterity: 'precise' },
    'anatomy:suckered': { rows: 2, adhesion: 'strong' },
    'core:owned_by': { ownerId: 'entity-123' },
    'core:material': { material: 'cotton' },
    'core:mouth_engagement': { locked: false },
    'core:gender': { value: 'male' },
    'core:participation': { participating: true },
  };

  /** @type {Record<string, unknown>} */
  const invalidPayloads = {
    'core:actor': { extra: true },
    'core:apparent_age': {},
    'core:current_actor': { extra: true },
    'core:player': { extra: true },
    'core:player_type': { type: 'invalid_type' },
    'core:description': {},
    'core:dilemmas': {},
    'core:dislikes': {},
    'core:fears': {},
    'core:internal_tensions': {},
    'core:known_to': {},
    'core:likes': {},
    'core:motivations': {},
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
    'core:strengths': {},
    'core:visible': {},
    'core:weaknesses': {},
    "movement:exits": {},
    'anatomy:part': {},
    'anatomy:sockets': {},
    'anatomy:joint': {},
    'anatomy:body': {},
    'anatomy:blueprintSlot': {},
    'anatomy:prehensile': { strength: 'invalid_strength' },
    'anatomy:suckered': { rows: -1 },
    'core:owned_by': {},
    'core:material': { material: 'invalid_material_not_in_enum' },
    'core:mouth_engagement': { locked: 'not-a-boolean' },
    'core:gender': {},
    'core:participation': {}, // Missing required 'participating' field
  };

  Object.entries(validators).forEach(([id, validate]) => {
    // eslint-disable-next-line jest/valid-title
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
