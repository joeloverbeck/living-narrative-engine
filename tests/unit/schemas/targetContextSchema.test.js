import { describe, test, expect, beforeAll } from '@jest/globals';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import targetContextSchema from '../../../data/schemas/target-context.schema.json';

describe('Target Context Schema Validation', () => {
  /** @type {import('ajv').ValidateFunction} */
  let validate;

  beforeAll(() => {
    const ajv = new Ajv({ strict: false, allErrors: true });
    addFormats(ajv);
    validate = ajv.compile(targetContextSchema);
  });

  describe('Base Context Validation', () => {
    test('✓ should validate minimal valid context', () => {
      const context = {
        actor: { id: 'player', components: {} },
        location: { id: 'room', components: {} },
        game: { turnNumber: 0 },
      };

      const isValid = validate(context);
      if (!isValid) console.error('Validation errors:', validate.errors);
      expect(isValid).toBe(true);
    });

    test('❌ should require actor, location, and game', () => {
      const invalid = {
        actor: { id: 'player', components: {} },
        // missing location and game
      };

      const isValid = validate(invalid);
      expect(isValid).toBe(false);
      expect(validate.errors).toBeDefined();
    });

    test('✓ should validate context with game state properties', () => {
      const context = {
        actor: { id: 'player', components: {} },
        location: { id: 'room', components: {} },
        game: {
          turnNumber: 42,
          timeOfDay: 'afternoon',
          weather: 'sunny',
        },
      };

      const isValid = validate(context);
      if (!isValid) console.error('Validation errors:', validate.errors);
      expect(isValid).toBe(true);
    });
  });

  describe('Target Context Validation', () => {
    test('✓ should validate context with target', () => {
      const context = {
        actor: { id: 'player', components: {} },
        target: { id: 'npc', components: {} },
        location: { id: 'room', components: {} },
        game: { turnNumber: 1 },
      };

      const isValid = validate(context);
      if (!isValid) console.error('Validation errors:', validate.errors);
      expect(isValid).toBe(true);
    });

    test('✓ should validate context with targets object', () => {
      const context = {
        actor: { id: 'player', components: {} },
        targets: {
          primary: [{ id: 'item1', components: {} }],
          secondary: [{ id: 'npc1', components: {} }],
        },
        location: { id: 'room', components: {} },
        game: { turnNumber: 1 },
      };

      const isValid = validate(context);
      if (!isValid) console.error('Validation errors:', validate.errors);
      expect(isValid).toBe(true);
    });

    test('✓ should validate context with both target and targets', () => {
      const context = {
        actor: { id: 'player', components: {} },
        target: { id: 'npc', components: {} },
        targets: {
          primary: [{ id: 'npc', components: {} }],
        },
        location: { id: 'room', components: {} },
        game: { turnNumber: 1 },
      };

      const isValid = validate(context);
      if (!isValid) console.error('Validation errors:', validate.errors);
      expect(isValid).toBe(true);
    });
  });

  describe('Entity Reference Validation', () => {
    test('❌ should require id and components in entity references', () => {
      const invalid = {
        actor: { id: 'player' }, // missing components
        location: { components: {} }, // missing id
        game: { turnNumber: 0 },
      };

      const isValid = validate(invalid);
      expect(isValid).toBe(false);
      expect(validate.errors).toBeDefined();
    });

    test('✓ should accept complex component structures', () => {
      const context = {
        actor: {
          id: 'player',
          components: {
            'core:inventory': { items: ['sword', 'potion'] },
            'core:stats': { health: 100, mana: 50 },
          },
        },
        location: {
          id: 'room',
          components: {
            'core:description': { name: 'Town Square' },
          },
        },
        game: { turnNumber: 5 },
      };

      const isValid = validate(context);
      if (!isValid) console.error('Validation errors:', validate.errors);
      expect(isValid).toBe(true);
    });
  });
});
