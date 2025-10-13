/**
 * @file Unit tests for TargetRequiredComponentsValidator
 * @see src/actions/validation/TargetRequiredComponentsValidator.js
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import TargetRequiredComponentsValidator from '../../../../src/actions/validation/TargetRequiredComponentsValidator.js';

describe('TargetRequiredComponentsValidator', () => {
  let validator;
  let mockLogger;

  beforeEach(() => {
    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    };

    validator = new TargetRequiredComponentsValidator({ logger: mockLogger });
  });

  describe('constructor', () => {
    it('should validate logger dependency', () => {
      expect(() => {
        new TargetRequiredComponentsValidator({ logger: null });
      }).toThrow();
    });

    it('should accept valid logger', () => {
      expect(() => {
        new TargetRequiredComponentsValidator({ logger: mockLogger });
      }).not.toThrow();
    });
  });

  describe('validateTargetRequirements - valid cases', () => {
    it('should return valid when no required_components defined', () => {
      const actionDef = { id: 'test:action' };
      const targetEntities = {};

      const result = validator.validateTargetRequirements(actionDef, targetEntities);

      expect(result).toEqual({ valid: true });
    });

    it('should return valid when required_components is empty object', () => {
      const actionDef = {
        id: 'test:action',
        required_components: {},
      };
      const targetEntities = {};

      const result = validator.validateTargetRequirements(actionDef, targetEntities);

      expect(result).toEqual({ valid: true });
    });

    it('should return valid when actor has all required components', () => {
      const actionDef = {
        id: 'test:action',
        required_components: {
          actor: ['positioning:closeness'],
        },
      };
      const targetEntities = {
        actor: {
          id: 'player',
          components: { 'positioning:closeness': {} },
        },
      };

      const result = validator.validateTargetRequirements(actionDef, targetEntities);

      expect(result).toEqual({ valid: true });
    });

    it('should return valid when primary target has all required components', () => {
      const actionDef = {
        id: 'test:straddle',
        required_components: {
          primary: ['positioning:sitting_on', 'positioning:closeness'],
        },
      };
      const targetEntities = {
        primary: {
          id: 'npc1',
          components: {
            'positioning:sitting_on': { furniture: 'chair1' },
            'positioning:closeness': { entity: 'player' },
          },
        },
      };

      const result = validator.validateTargetRequirements(actionDef, targetEntities);

      expect(result).toEqual({ valid: true });
    });

    it('should return valid when secondary target has all required components', () => {
      const actionDef = {
        id: 'test:action',
        required_components: {
          secondary: ['core:actor'],
        },
      };
      const targetEntities = {
        secondary: {
          id: 'npc2',
          components: { 'core:actor': {} },
        },
      };

      const result = validator.validateTargetRequirements(actionDef, targetEntities);

      expect(result).toEqual({ valid: true });
    });

    it('should return valid when tertiary target has all required components', () => {
      const actionDef = {
        id: 'test:action',
        required_components: {
          tertiary: ['items:portable'],
        },
      };
      const targetEntities = {
        tertiary: {
          id: 'item1',
          components: { 'items:portable': { weight: 5 } },
        },
      };

      const result = validator.validateTargetRequirements(actionDef, targetEntities);

      expect(result).toEqual({ valid: true });
    });

    it('should return valid for legacy target format', () => {
      const actionDef = {
        id: 'test:action',
        required_components: {
          target: ['positioning:closeness'],
        },
      };
      const targetEntities = {
        target: {
          id: 'npc1',
          components: { 'positioning:closeness': {} },
        },
      };

      const result = validator.validateTargetRequirements(actionDef, targetEntities);

      expect(result).toEqual({ valid: true });
    });

    it('should return valid when multiple targets all have required components', () => {
      const actionDef = {
        id: 'test:action',
        required_components: {
          primary: ['positioning:closeness'],
          secondary: ['core:actor'],
        },
      };
      const targetEntities = {
        primary: {
          id: 'npc1',
          components: { 'positioning:closeness': {} },
        },
        secondary: {
          id: 'npc2',
          components: { 'core:actor': {} },
        },
      };

      const result = validator.validateTargetRequirements(actionDef, targetEntities);

      expect(result).toEqual({ valid: true });
    });

    it('should return valid when at least one candidate in target array has required components', () => {
      const actionDef = {
        id: 'test:action',
        required_components: {
          primary: ['positioning:closeness'],
        },
      };
      const targetEntities = {
        primary: [
          {
            id: 'npc1',
            components: { 'positioning:closeness': {} },
          },
          {
            id: 'npc2',
            components: {},
          },
        ],
      };

      const result = validator.validateTargetRequirements(actionDef, targetEntities);

      expect(result).toEqual({ valid: true });
    });
  });

  describe('validateTargetRequirements - invalid cases', () => {
    it('should return invalid when primary target missing required component', () => {
      const actionDef = {
        id: 'test:straddle',
        required_components: {
          primary: ['positioning:sitting_on', 'positioning:closeness'],
        },
      };
      const targetEntities = {
        primary: {
          id: 'npc1',
          components: {
            'positioning:closeness': {},
            // Missing positioning:sitting_on
          },
        },
      };

      const result = validator.validateTargetRequirements(actionDef, targetEntities);

      expect(result).toEqual({
        valid: false,
        reason: 'Target (primary) must have component: positioning:sitting_on',
      });
    });

    it('should return invalid when secondary target missing required component', () => {
      const actionDef = {
        id: 'test:action',
        required_components: {
          secondary: ['core:actor', 'positioning:closeness'],
        },
      };
      const targetEntities = {
        secondary: {
          id: 'npc2',
          components: { 'core:actor': {} },
          // Missing positioning:closeness
        },
      };

      const result = validator.validateTargetRequirements(actionDef, targetEntities);

      expect(result).toEqual({
        valid: false,
        reason: 'Target (secondary) must have component: positioning:closeness',
      });
    });

    it('should return invalid when target entity has no components field', () => {
      const actionDef = {
        id: 'test:action',
        required_components: {
          primary: ['positioning:closeness'],
        },
      };
      const targetEntities = {
        primary: { id: 'npc1' }, // No components field
      };

      const result = validator.validateTargetRequirements(actionDef, targetEntities);

      expect(result).toEqual({
        valid: false,
        reason: 'Target (primary) must have component: positioning:closeness',
      });
    });

    it('should return invalid when no candidates in target array satisfy required components', () => {
      const actionDef = {
        id: 'test:action',
        required_components: {
          primary: ['positioning:closeness'],
        },
      };
      const targetEntities = {
        primary: [
          {
            id: 'npc1',
            components: {},
          },
          {
            id: 'npc2',
            components: {},
          },
        ],
      };

      const result = validator.validateTargetRequirements(actionDef, targetEntities);

      expect(result).toEqual({
        valid: false,
        reason: 'Target (primary) must have component: positioning:closeness',
      });
    });

    it('should return invalid when target entity is missing', () => {
      const actionDef = {
        id: 'test:action',
        required_components: {
          primary: ['positioning:closeness'],
        },
      };
      const targetEntities = {}; // No primary target

      const result = validator.validateTargetRequirements(actionDef, targetEntities);

      expect(result).toEqual({
        valid: false,
        reason: 'No primary target available for validation',
      });
    });

    it('should return invalid for legacy target format missing component', () => {
      const actionDef = {
        id: 'test:action',
        required_components: {
          target: ['positioning:closeness', 'positioning:sitting_on'],
        },
      };
      const targetEntities = {
        target: {
          id: 'npc1',
          components: { 'positioning:closeness': {} },
          // Missing positioning:sitting_on
        },
      };

      const result = validator.validateTargetRequirements(actionDef, targetEntities);

      expect(result).toEqual({
        valid: false,
        reason: 'Target (target) must have component: positioning:sitting_on',
      });
    });

    it('should fail on first missing component when multiple targets invalid', () => {
      const actionDef = {
        id: 'test:action',
        required_components: {
          primary: ['positioning:closeness'],
          secondary: ['core:actor'],
        },
      };
      const targetEntities = {
        primary: {
          id: 'npc1',
          components: {}, // Missing positioning:closeness
        },
        secondary: {
          id: 'npc2',
          components: {}, // Missing core:actor
        },
      };

      const result = validator.validateTargetRequirements(actionDef, targetEntities);

      // Should fail on first check (primary since legacy target is checked first, then primary)
      expect(result.valid).toBe(false);
      expect(result.reason).toBeDefined();
    });
  });

  describe('validateTargetRequirements - edge cases', () => {
    it('should handle empty required components array', () => {
      const actionDef = {
        id: 'test:action',
        required_components: {
          primary: [],
        },
      };
      const targetEntities = {
        primary: { id: 'npc1', components: {} },
      };

      const result = validator.validateTargetRequirements(actionDef, targetEntities);

      expect(result).toEqual({ valid: true });
    });

    it('should handle null target entity gracefully', () => {
      const actionDef = {
        id: 'test:action',
        required_components: {
          primary: ['positioning:closeness'],
        },
      };
      const targetEntities = {
        primary: null,
      };

      const result = validator.validateTargetRequirements(actionDef, targetEntities);

      expect(result.valid).toBe(false);
      expect(result.reason).toContain('primary');
    });

    it('should log debug messages for validation', () => {
      const actionDef = {
        id: 'test:action',
        required_components: {
          primary: ['positioning:closeness'],
        },
      };
      const targetEntities = {
        primary: {
          id: 'npc1',
          components: {},
        },
      };

      validator.validateTargetRequirements(actionDef, targetEntities);

      expect(mockLogger.debug).toHaveBeenCalled();
    });
  });
});
