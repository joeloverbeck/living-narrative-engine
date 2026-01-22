/**
 * @file Schema validation tests for locations mod components.
 * Tests that locations component data schemas validate correctly with AJV.
 */

import { describe, test, expect } from '@jest/globals';
import {
  createAjvInstance,
  loadComponentValidators,
  generateComponentTests,
  getModComponentsPath,
} from './schemaTestUtils.js';

const ajv = createAjvInstance();
const validators = loadComponentValidators(
  getModComponentsPath('locations'),
  ajv
);

/** @type {Record<string, unknown>} */
const validPayloads = {
  'locations:exits': [],
  'locations:description_in_darkness': {
    text: 'The darkness is oppressive, but you can hear distant dripping.',
  },
  'locations:naturally_dark': {},
  'locations:sensorial_links': { targets: ['location:tavern_main_hall'] },
};

/** @type {Record<string, unknown>} */
const invalidPayloads = {
  'locations:exits': {},
  'locations:description_in_darkness': {},
  'locations:naturally_dark': { extra: true },
  'locations:sensorial_links': {},
};

describe('JSON-Schema – locations component data contracts', () => {
  generateComponentTests(validators, validPayloads, invalidPayloads);

  describe('locations:exits - detailed validation', () => {
    test('✓ valid with single exit', () => {
      const payload = [
        { direction: 'north', target: 'locations:forest_clearing' },
      ];
      const ok = validators['locations:exits'](payload);
      if (!ok) console.error(validators['locations:exits'].errors);
      expect(ok).toBe(true);
    });

    test('✓ valid with exit and blocker', () => {
      const payload = [
        {
          direction: 'enter the cellar',
          target: 'locations:cellar',
          blocker: 'doors:cellar_door',
        },
      ];
      const ok = validators['locations:exits'](payload);
      if (!ok) console.error(validators['locations:exits'].errors);
      expect(ok).toBe(true);
    });

    test('✓ valid with multiple exits', () => {
      const payload = [
        { direction: 'north', target: 'locations:forest' },
        { direction: 'south', target: 'locations:village' },
        { direction: 'west', target: 'locations:river', blocker: null },
      ];
      const ok = validators['locations:exits'](payload);
      if (!ok) console.error(validators['locations:exits'].errors);
      expect(ok).toBe(true);
    });

    test('✗ invalid - exit missing direction', () => {
      const payload = [{ target: 'locations:forest' }];
      expect(validators['locations:exits'](payload)).toBe(false);
    });

    test('✗ invalid - exit missing target', () => {
      const payload = [{ direction: 'north' }];
      expect(validators['locations:exits'](payload)).toBe(false);
    });

    test('✗ invalid - exit with extra properties', () => {
      const payload = [
        { direction: 'north', target: 'locations:forest', extra: true },
      ];
      expect(validators['locations:exits'](payload)).toBe(false);
    });
  });

  describe('locations:sensorial_links - detailed validation', () => {
    test('✓ valid with mode property', () => {
      const payload = {
        targets: ['location:tavern_main_hall'],
        mode: 'both',
      };
      const ok = validators['locations:sensorial_links'](payload);
      if (!ok) console.error(validators['locations:sensorial_links'].errors);
      expect(ok).toBe(true);
    });

    test('✓ valid with multiple targets', () => {
      const payload = {
        targets: ['location:room_a', 'location:room_b', 'location:room_c'],
      };
      const ok = validators['locations:sensorial_links'](payload);
      if (!ok) console.error(validators['locations:sensorial_links'].errors);
      expect(ok).toBe(true);
    });

    test('✗ invalid - targets not an array', () => {
      const payload = { targets: 'location:room_a' };
      expect(validators['locations:sensorial_links'](payload)).toBe(false);
    });
  });
});
