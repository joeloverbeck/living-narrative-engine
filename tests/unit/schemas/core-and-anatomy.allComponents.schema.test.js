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

describe('JSON-Schema – core/anatomy component data contracts', () => {
  /** @type {Record<string, unknown>} */
  const validPayloads = {
    'core:actor': {},
    'core:apparent_age': { minAge: 25, maxAge: 35 },
    'core:armed': { equippedItemId: 'entity:weapon_123', readyState: 'drawn' },
    'core:current_actor': {},
    'core:player': {},
    'core:player_type': { type: 'human' },
    'core:description': { text: 'desc' },
    'core:dilemmas': { text: 'Am I doing the right thing?' },
    'core:dislikes': { text: 'dislike' },
    'core:fears': { text: 'fear' },
    'core:hungry': {
      severity: 40,
      since: '2024-05-05T12:00:00Z',
    },
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
    'core:weight': { weight: 5.5 },
    'movement:exits': [],
    'anatomy:part': { subType: 'leg' },
    'anatomy:sockets': {
      sockets: [
        {
          id: 'front_left_ankle',
          orientation: 'left_front',
          allowedTypes: ['foot'],
        },
      ],
    },
    'anatomy:joint': { parentId: 'entity-123', socketId: 'ankle' },
    'anatomy:body': { recipeId: 'anatomy:human_female' },
    'anatomy:blueprintSlot': { slotId: 'left_breast' },
    'anatomy:prehensile': { strength: 'moderate', dexterity: 'precise' },
    'anatomy:suckered': { rows: 2, adhesion: 'strong' },
    'anatomy:can_grab': { locked: false },
    'anatomy:requires_grabbing': { handsRequired: 2 },
    'anatomy:part_health': {
      currentHealth: 100,
      maxHealth: 100,
      state: 'healthy',
      turnsInState: 0,
    },
    'anatomy:visibility_rules': {
      clothingSlotId: 'torso_lower',
      nonBlockingLayers: ['underwear', 'base'],
      reason: 'Visible when lower layers do not block',
    },
    'core:owned_by': { ownerId: 'entity-123' },
    'core:material': { material: 'cotton' },
    'core:mouth_engagement': { locked: false },
    'core:gender': { value: 'male' },
    'core:participation': { participating: true },
    'core:conspicuous': {},
    'anatomy:bleeding': { severity: 'minor', remainingTurns: 3, tickDamage: 5 },
    'anatomy:burning': { remainingTurns: 3, tickDamage: 5, stackedCount: 1 },
    'anatomy:fractured': { sourceDamageType: 'blunt', appliedAtHealth: 50 },
    'anatomy:dismembered': { sourceDamageType: 'slashing' },
    'anatomy:poisoned': { remainingTurns: 3, tickDamage: 5 },
    'anatomy:stunned': { remainingTurns: 2 },
    'anatomy:vital_organ': { organType: 'heart' },
    'anatomy:dying': {
      turnsRemaining: 3,
      causeOfDying: 'overall_health_critical',
    },
    'anatomy:dead': {
      causeOfDeath: 'vital_organ_destroyed',
      deathTimestamp: 1733143200,
    },
    'anatomy:damage_propagation': {
      rules: [{ childSocketId: 'heart_socket', baseProbability: 0.3 }],
    },
    'anatomy:embedded': {},
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
    'core:weight': { weight: -1 }, // Invalid: negative weight not allowed
    'movement:exits': {},
    'anatomy:part': {},
    'anatomy:sockets': {},
    'anatomy:joint': {},
    'anatomy:body': {},
    'anatomy:blueprintSlot': {},
    'anatomy:prehensile': { strength: 'invalid_strength' },
    'anatomy:suckered': { rows: -1 },
    'anatomy:can_grab': {}, // Missing required 'locked' field
    'anatomy:requires_grabbing': {}, // Missing required 'handsRequired' field
    'anatomy:part_health': { state: 'invalid_state' }, // Invalid enum value, missing required fields
    'anatomy:visibility_rules': {
      clothingSlotId: 123,
      nonBlockingLayers: 'base',
    },
    'core:owned_by': {},
    'core:material': { material: 'invalid_material_not_in_enum' },
    'core:mouth_engagement': { locked: 'not-a-boolean' },
    'core:gender': {},
    'core:armed': { readyState: 'holstered' },
    'core:hungry': { severity: 200 },
    'core:participation': {}, // Missing required 'participating' field
    'core:conspicuous': { extra: true },
    'anatomy:bleeding': { severity: 'invalid' },
    'anatomy:burning': { remainingTurns: -1 },
    'anatomy:fractured': {},
    'anatomy:dismembered': {}, // Missing required sourceDamageType
    'anatomy:poisoned': { tickDamage: 'high' },
    'anatomy:stunned': {},
    'anatomy:vital_organ': { organType: 'kidney' }, // Invalid enum value
    'anatomy:dying': { turnsRemaining: -1 }, // Missing required causeOfDying, invalid minimum
    'anatomy:dead': { vitalOrganDestroyed: 'heart' }, // Missing required causeOfDeath and deathTimestamp
    'anatomy:damage_propagation': { rules: 'not_an_array' }, // Invalid type
    'anatomy:embedded': { extra: true }, // additionalProperties: false
  };

  // Additional test cases for DISBODPARSPA-001: anatomy:part definitionId field
  describe('anatomy:part - definitionId field (DISBODPARSPA-001)', () => {
    test('✓ valid with definitionId', () => {
      const payload = { subType: 'foot', definitionId: 'anatomy:human_foot' };
      const ok = validators['anatomy:part'](payload);
      if (!ok) console.error(validators['anatomy:part'].errors);
      expect(ok).toBe(true);
    });

    test('✓ valid with orientation and definitionId', () => {
      const payload = {
        subType: 'arm',
        orientation: 'left',
        definitionId: 'anatomy:human_arm',
      };
      const ok = validators['anatomy:part'](payload);
      if (!ok) console.error(validators['anatomy:part'].errors);
      expect(ok).toBe(true);
    });

    test('✓ valid with all optional fields', () => {
      const payload = {
        subType: 'torso',
        orientation: 'mid',
        hit_probability_weight: 5.0,
        definitionId: 'anatomy:human_torso',
      };
      const ok = validators['anatomy:part'](payload);
      if (!ok) console.error(validators['anatomy:part'].errors);
      expect(ok).toBe(true);
    });

    test('✗ invalid - definitionId must be string', () => {
      const payload = { subType: 'leg', definitionId: 123 };
      expect(validators['anatomy:part'](payload)).toBe(false);
    });

    test('✓ backward compatibility - valid without definitionId', () => {
      // This test explicitly documents backward compatibility
      const payload = { subType: 'head' };
      const ok = validators['anatomy:part'](payload);
      expect(ok).toBe(true);
    });
  });

  // HEACALOVE-001: anatomy:part health_calculation_weight field
  describe('anatomy:part - health_calculation_weight field (HEACALOVE-001)', () => {
    test('✓ valid with health_calculation_weight', () => {
      const payload = { subType: 'torso', health_calculation_weight: 5.0 };
      const ok = validators['anatomy:part'](payload);
      if (!ok) console.error(validators['anatomy:part'].errors);
      expect(ok).toBe(true);
    });

    test('✓ valid with health_calculation_weight at minimum (0)', () => {
      const payload = { subType: 'cosmetic', health_calculation_weight: 0 };
      const ok = validators['anatomy:part'](payload);
      if (!ok) console.error(validators['anatomy:part'].errors);
      expect(ok).toBe(true);
    });

    test('✓ valid with health_calculation_weight as decimal', () => {
      const payload = { subType: 'finger', health_calculation_weight: 0.5 };
      const ok = validators['anatomy:part'](payload);
      if (!ok) console.error(validators['anatomy:part'].errors);
      expect(ok).toBe(true);
    });

    test('✓ valid with all optional fields including health_calculation_weight', () => {
      const payload = {
        subType: 'heart',
        orientation: 'mid',
        hit_probability_weight: 2.0,
        definitionId: 'anatomy:human_heart',
        health_calculation_weight: 10.0,
      };
      const ok = validators['anatomy:part'](payload);
      if (!ok) console.error(validators['anatomy:part'].errors);
      expect(ok).toBe(true);
    });

    test('✗ invalid - health_calculation_weight must be number', () => {
      const payload = { subType: 'leg', health_calculation_weight: 'high' };
      expect(validators['anatomy:part'](payload)).toBe(false);
    });

    test('✗ invalid - health_calculation_weight cannot be negative', () => {
      const payload = { subType: 'arm', health_calculation_weight: -1.0 };
      expect(validators['anatomy:part'](payload)).toBe(false);
    });

    test('✓ backward compatibility - valid without health_calculation_weight', () => {
      // This test explicitly documents backward compatibility
      const payload = { subType: 'leg', hit_probability_weight: 1.5 };
      const ok = validators['anatomy:part'](payload);
      expect(ok).toBe(true);
    });
  });

  // HEACALOVE-002: anatomy:vital_organ healthCapThreshold and healthCapValue fields
  describe('anatomy:vital_organ - health cap properties (HEACALOVE-002)', () => {
    test('✓ valid with healthCapThreshold', () => {
      const payload = { organType: 'heart', healthCapThreshold: 25 };
      const ok = validators['anatomy:vital_organ'](payload);
      if (!ok) console.error(validators['anatomy:vital_organ'].errors);
      expect(ok).toBe(true);
    });

    test('✓ valid with healthCapValue', () => {
      const payload = { organType: 'brain', healthCapValue: 35 };
      const ok = validators['anatomy:vital_organ'](payload);
      if (!ok) console.error(validators['anatomy:vital_organ'].errors);
      expect(ok).toBe(true);
    });

    test('✓ valid with both health cap properties', () => {
      const payload = {
        organType: 'spine',
        healthCapThreshold: 15,
        healthCapValue: 40,
      };
      const ok = validators['anatomy:vital_organ'](payload);
      if (!ok) console.error(validators['anatomy:vital_organ'].errors);
      expect(ok).toBe(true);
    });

    test('✓ valid with all properties including deathMessage', () => {
      const payload = {
        organType: 'heart',
        deathMessage: 'The heart gives out.',
        healthCapThreshold: 20,
        healthCapValue: 30,
      };
      const ok = validators['anatomy:vital_organ'](payload);
      if (!ok) console.error(validators['anatomy:vital_organ'].errors);
      expect(ok).toBe(true);
    });

    test('✓ valid with healthCapThreshold at minimum (0)', () => {
      const payload = { organType: 'heart', healthCapThreshold: 0 };
      const ok = validators['anatomy:vital_organ'](payload);
      if (!ok) console.error(validators['anatomy:vital_organ'].errors);
      expect(ok).toBe(true);
    });

    test('✓ valid with healthCapThreshold at maximum (100)', () => {
      const payload = { organType: 'brain', healthCapThreshold: 100 };
      const ok = validators['anatomy:vital_organ'](payload);
      if (!ok) console.error(validators['anatomy:vital_organ'].errors);
      expect(ok).toBe(true);
    });

    test('✓ valid with healthCapValue at minimum (0)', () => {
      const payload = { organType: 'spine', healthCapValue: 0 };
      const ok = validators['anatomy:vital_organ'](payload);
      if (!ok) console.error(validators['anatomy:vital_organ'].errors);
      expect(ok).toBe(true);
    });

    test('✓ valid with healthCapValue at maximum (100)', () => {
      const payload = { organType: 'heart', healthCapValue: 100 };
      const ok = validators['anatomy:vital_organ'](payload);
      if (!ok) console.error(validators['anatomy:vital_organ'].errors);
      expect(ok).toBe(true);
    });

    test('✗ invalid - healthCapThreshold must be number', () => {
      const payload = { organType: 'heart', healthCapThreshold: 'low' };
      expect(validators['anatomy:vital_organ'](payload)).toBe(false);
    });

    test('✗ invalid - healthCapValue must be number', () => {
      const payload = { organType: 'brain', healthCapValue: 'critical' };
      expect(validators['anatomy:vital_organ'](payload)).toBe(false);
    });

    test('✗ invalid - healthCapThreshold below minimum', () => {
      const payload = { organType: 'spine', healthCapThreshold: -5 };
      expect(validators['anatomy:vital_organ'](payload)).toBe(false);
    });

    test('✗ invalid - healthCapThreshold above maximum', () => {
      const payload = { organType: 'heart', healthCapThreshold: 101 };
      expect(validators['anatomy:vital_organ'](payload)).toBe(false);
    });

    test('✗ invalid - healthCapValue below minimum', () => {
      const payload = { organType: 'brain', healthCapValue: -10 };
      expect(validators['anatomy:vital_organ'](payload)).toBe(false);
    });

    test('✗ invalid - healthCapValue above maximum', () => {
      const payload = { organType: 'spine', healthCapValue: 150 };
      expect(validators['anatomy:vital_organ'](payload)).toBe(false);
    });

    test('✓ backward compatibility - valid without health cap properties', () => {
      // This test explicitly documents backward compatibility
      const payload = { organType: 'heart' };
      const ok = validators['anatomy:vital_organ'](payload);
      expect(ok).toBe(true);
    });

    test('✓ backward compatibility - valid with only deathMessage (no health cap)', () => {
      const payload = { organType: 'brain', deathMessage: 'Brain death.' };
      const ok = validators['anatomy:vital_organ'](payload);
      expect(ok).toBe(true);
    });
  });

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
