/**
 * @file Schema validation tests for anatomy mod components.
 * Tests that anatomy component data schemas validate correctly with AJV.
 */

import { describe, test, expect } from '@jest/globals';
import {
  createAjvInstance,
  loadComponentValidators,
  generateComponentTests,
  getModComponentsPath,
} from './schemaTestUtils.js';

const ajv = createAjvInstance();
const validators = loadComponentValidators(getModComponentsPath('anatomy'), ajv);

/** @type {Record<string, unknown>} */
const validPayloads = {
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
  'anatomy:bleeding': { severity: 'minor', remainingTurns: 3, tickDamage: 5 },
  'anatomy:burning': { remainingTurns: 3, tickDamage: 5, stackedCount: 1 },
  'anatomy:fractured': { sourceDamageType: 'blunt', appliedAtHealth: 50 },
  'anatomy:dismembered': { sourceDamageType: 'slashing' },
  'anatomy:poisoned': { remainingTurns: 3, tickDamage: 5 },
  'anatomy:stunned': { remainingTurns: 2 },
  'anatomy:vital_organ': { organType: 'heart', killOnDestroy: true },
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
  'anatomy:has_rigid_structure': {},
  'anatomy:provides_hearing': {},
  'anatomy:provides_sight': {},
  'anatomy:provides_smell': {},
  'anatomy:provides_thinking': {},
};

/** @type {Record<string, unknown>} */
const invalidPayloads = {
  'anatomy:part': {},
  'anatomy:sockets': {},
  'anatomy:joint': {},
  'anatomy:body': {},
  'anatomy:blueprintSlot': {},
  'anatomy:prehensile': { strength: 'invalid_strength' },
  'anatomy:suckered': { rows: -1 },
  'anatomy:can_grab': {},
  'anatomy:requires_grabbing': {},
  'anatomy:part_health': { state: 'invalid_state' },
  'anatomy:visibility_rules': {
    clothingSlotId: 123,
    nonBlockingLayers: 'base',
  },
  'anatomy:bleeding': { severity: 'invalid' },
  'anatomy:burning': { remainingTurns: -1 },
  'anatomy:fractured': {},
  'anatomy:dismembered': {},
  'anatomy:poisoned': { tickDamage: 'high' },
  'anatomy:stunned': {},
  'anatomy:vital_organ': { organType: 'kidney' },
  'anatomy:dying': { turnsRemaining: -1 },
  'anatomy:dead': { vitalOrganDestroyed: 'heart' },
  'anatomy:damage_propagation': { rules: 'not_an_array' },
  'anatomy:embedded': { extra: true },
  'anatomy:has_rigid_structure': { structureType: 'wood' },
  'anatomy:provides_hearing': { extra: true },
  'anatomy:provides_sight': { extra: true },
  'anatomy:provides_smell': { extra: true },
  'anatomy:provides_thinking': { extra: true },
};

describe('JSON-Schema – anatomy component data contracts', () => {
  generateComponentTests(validators, validPayloads, invalidPayloads);

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
      const payload = { subType: 'leg', hit_probability_weight: 1.5 };
      const ok = validators['anatomy:part'](payload);
      expect(ok).toBe(true);
    });
  });

  // HEACALOVE-002: anatomy:vital_organ health cap properties
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

  describe('anatomy:vital_organ - killOnDestroy flag', () => {
    test('✓ valid when killOnDestroy is explicitly false', () => {
      const payload = { organType: 'heart', killOnDestroy: false };
      const ok = validators['anatomy:vital_organ'](payload);
      if (!ok) console.error(validators['anatomy:vital_organ'].errors);
      expect(ok).toBe(true);
    });

    test('✗ invalid when killOnDestroy is not boolean', () => {
      const payload = { organType: 'brain', killOnDestroy: 'yes' };
      expect(validators['anatomy:vital_organ'](payload)).toBe(false);
    });
  });
});
