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

      const result = validator.validateTargetRequirements(
        actionDef,
        targetEntities
      );

      expect(result).toEqual({ valid: true });
    });

    it('should return valid when required_components is empty object', () => {
      const actionDef = {
        id: 'test:action',
        required_components: {},
      };
      const targetEntities = {};

      const result = validator.validateTargetRequirements(
        actionDef,
        targetEntities
      );

      expect(result).toEqual({ valid: true });
    });

    it('should return valid when actor has all required components', () => {
      const actionDef = {
        id: 'test:action',
        required_components: {
          actor: ['personal-space-states:closeness'],
        },
      };
      const targetEntities = {
        actor: {
          id: 'player',
          components: { 'personal-space-states:closeness': {} },
        },
      };

      const result = validator.validateTargetRequirements(
        actionDef,
        targetEntities
      );

      expect(result).toEqual({ valid: true });
    });

    it('should return valid when primary target has all required components', () => {
      const actionDef = {
        id: 'test:straddle',
        required_components: {
          primary: ['positioning:sitting_on', 'personal-space-states:closeness'],
        },
      };
      const targetEntities = {
        primary: {
          id: 'npc1',
          components: {
            'positioning:sitting_on': { furniture: 'chair1' },
            'personal-space-states:closeness': { entity: 'player' },
          },
        },
      };

      const result = validator.validateTargetRequirements(
        actionDef,
        targetEntities
      );

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

      const result = validator.validateTargetRequirements(
        actionDef,
        targetEntities
      );

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

      const result = validator.validateTargetRequirements(
        actionDef,
        targetEntities
      );

      expect(result).toEqual({ valid: true });
    });

    it('should return valid for legacy target format', () => {
      const actionDef = {
        id: 'test:action',
        required_components: {
          target: ['personal-space-states:closeness'],
        },
      };
      const targetEntities = {
        target: {
          id: 'npc1',
          components: { 'personal-space-states:closeness': {} },
        },
      };

      const result = validator.validateTargetRequirements(
        actionDef,
        targetEntities
      );

      expect(result).toEqual({ valid: true });
    });

    it('should return valid when multiple targets all have required components', () => {
      const actionDef = {
        id: 'test:action',
        required_components: {
          primary: ['personal-space-states:closeness'],
          secondary: ['core:actor'],
        },
      };
      const targetEntities = {
        primary: {
          id: 'npc1',
          components: { 'personal-space-states:closeness': {} },
        },
        secondary: {
          id: 'npc2',
          components: { 'core:actor': {} },
        },
      };

      const result = validator.validateTargetRequirements(
        actionDef,
        targetEntities
      );

      expect(result).toEqual({ valid: true });
    });

    it('should return valid when at least one candidate in target array has required components', () => {
      const actionDef = {
        id: 'test:action',
        required_components: {
          primary: ['personal-space-states:closeness'],
        },
      };
      const targetEntities = {
        primary: [
          {
            id: 'npc1',
            components: { 'personal-space-states:closeness': {} },
          },
          {
            id: 'npc2',
            components: {},
          },
        ],
      };

      const result = validator.validateTargetRequirements(
        actionDef,
        targetEntities
      );

      expect(result).toEqual({ valid: true });
    });
  });

  describe('validateTargetRequirements - invalid cases', () => {
    it('should return invalid when primary target missing required component', () => {
      const actionDef = {
        id: 'test:straddle',
        required_components: {
          primary: ['positioning:sitting_on', 'personal-space-states:closeness'],
        },
      };
      const targetEntities = {
        primary: {
          id: 'npc1',
          components: {
            'personal-space-states:closeness': {},
            // Missing positioning:sitting_on
          },
        },
      };

      const result = validator.validateTargetRequirements(
        actionDef,
        targetEntities
      );

      expect(result).toEqual({
        valid: false,
        reason: 'Target (primary) must have component: positioning:sitting_on',
      });
    });

    it('should return invalid when secondary target missing required component', () => {
      const actionDef = {
        id: 'test:action',
        required_components: {
          secondary: ['core:actor', 'personal-space-states:closeness'],
        },
      };
      const targetEntities = {
        secondary: {
          id: 'npc2',
          components: { 'core:actor': {} },
          // Missing personal-space-states:closeness
        },
      };

      const result = validator.validateTargetRequirements(
        actionDef,
        targetEntities
      );

      expect(result).toEqual({
        valid: false,
        reason: 'Target (secondary) must have component: personal-space-states:closeness',
      });
    });

    it('should return invalid when target entity has no components field', () => {
      const actionDef = {
        id: 'test:action',
        required_components: {
          primary: ['personal-space-states:closeness'],
        },
      };
      const targetEntities = {
        primary: { id: 'npc1' }, // No components field
      };

      const result = validator.validateTargetRequirements(
        actionDef,
        targetEntities
      );

      expect(result).toEqual({
        valid: false,
        reason: 'Target (primary) must have component: personal-space-states:closeness',
      });
    });

    it('should return invalid when no candidates in target array satisfy required components', () => {
      const actionDef = {
        id: 'test:action',
        required_components: {
          primary: ['personal-space-states:closeness'],
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

      const result = validator.validateTargetRequirements(
        actionDef,
        targetEntities
      );

      expect(result).toEqual({
        valid: false,
        reason: 'Target (primary) must have component: personal-space-states:closeness',
      });
    });

    it('should return invalid when target entity is missing', () => {
      const actionDef = {
        id: 'test:action',
        required_components: {
          primary: ['personal-space-states:closeness'],
        },
      };
      const targetEntities = {}; // No primary target

      const result = validator.validateTargetRequirements(
        actionDef,
        targetEntities
      );

      expect(result).toEqual({
        valid: false,
        reason: 'No primary target available for validation',
      });
    });

    it('should return invalid for legacy target format missing component', () => {
      const actionDef = {
        id: 'test:action',
        required_components: {
          target: ['personal-space-states:closeness', 'positioning:sitting_on'],
        },
      };
      const targetEntities = {
        target: {
          id: 'npc1',
          components: { 'personal-space-states:closeness': {} },
          // Missing positioning:sitting_on
        },
      };

      const result = validator.validateTargetRequirements(
        actionDef,
        targetEntities
      );

      expect(result).toEqual({
        valid: false,
        reason: 'Target (target) must have component: positioning:sitting_on',
      });
    });

    it('should fail on first missing component when multiple targets invalid', () => {
      const actionDef = {
        id: 'test:action',
        required_components: {
          primary: ['personal-space-states:closeness'],
          secondary: ['core:actor'],
        },
      };
      const targetEntities = {
        primary: {
          id: 'npc1',
          components: {}, // Missing personal-space-states:closeness
        },
        secondary: {
          id: 'npc2',
          components: {}, // Missing core:actor
        },
      };

      const result = validator.validateTargetRequirements(
        actionDef,
        targetEntities
      );

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

      const result = validator.validateTargetRequirements(
        actionDef,
        targetEntities
      );

      expect(result).toEqual({ valid: true });
    });

    it('should handle null target entity gracefully', () => {
      const actionDef = {
        id: 'test:action',
        required_components: {
          primary: ['personal-space-states:closeness'],
        },
      };
      const targetEntities = {
        primary: null,
      };

      const result = validator.validateTargetRequirements(
        actionDef,
        targetEntities
      );

      expect(result.valid).toBe(false);
      expect(result.reason).toContain('primary');
    });

    it('should handle completely missing target entities', () => {
      const actionDef = {
        id: 'test:action',
        required_components: {
          primary: ['personal-space-states:closeness'],
        },
      };

      const result = validator.validateTargetRequirements(actionDef, null);

      expect(result).toEqual({
        valid: false,
        reason: 'No target entities available for primary validation',
      });
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'No target entities provided for primary validation'
      );
    });

    it('should handle undefined target entities', () => {
      const actionDef = {
        id: 'test:action',
        required_components: {
          primary: ['personal-space-states:closeness'],
        },
      };

      const result = validator.validateTargetRequirements(actionDef, undefined);

      expect(result).toEqual({
        valid: false,
        reason: 'No target entities available for primary validation',
      });
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'No target entities provided for primary validation'
      );
    });

    it('should handle empty target candidate arrays', () => {
      const actionDef = {
        id: 'test:action',
        required_components: {
          primary: ['personal-space-states:closeness'],
        },
      };
      const targetEntities = {
        primary: [],
      };

      const result = validator.validateTargetRequirements(
        actionDef,
        targetEntities
      );

      expect(result).toEqual({
        valid: false,
        reason: 'No primary target available for validation',
      });
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'Empty primary target array for required components validation'
      );
    });

    it('should report when target candidate array only contains falsy entries', () => {
      const actionDef = {
        id: 'test:action',
        required_components: {
          primary: ['personal-space-states:closeness'],
        },
      };
      const targetEntities = {
        primary: [null, undefined, false],
      };

      const result = validator.validateTargetRequirements(
        actionDef,
        targetEntities
      );

      expect(result).toEqual({
        valid: false,
        reason: 'No primary target available for validation',
      });
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'Invalid primary target candidate encountered during required components validation'
      );
    });

    it('should skip null candidates within the target list', () => {
      const actionDef = {
        id: 'test:action',
        required_components: {
          primary: ['personal-space-states:closeness'],
        },
      };
      const targetEntities = {
        primary: [
          null,
          {
            id: 'npc-valid',
            components: { 'personal-space-states:closeness': {} },
          },
        ],
      };

      const result = validator.validateTargetRequirements(
        actionDef,
        targetEntities
      );

      expect(result).toEqual({ valid: true });
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'Invalid primary target candidate encountered during required components validation'
      );
    });

    it('should skip candidates without an entity reference', () => {
      const actionDef = {
        id: 'test:action',
        required_components: {
          primary: ['personal-space-states:closeness'],
        },
      };
      const targetEntities = {
        primary: [
          { entity: null },
          {
            entity: {
              id: 'npc-valid',
              components: { 'personal-space-states:closeness': {} },
            },
          },
        ],
      };

      const result = validator.validateTargetRequirements(
        actionDef,
        targetEntities
      );

      expect(result).toEqual({ valid: true });
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'Resolved primary target candidate lacks entity reference'
      );
    });

    it('should unwrap candidates exposing an entity property', () => {
      const actionDef = {
        id: 'test:action',
        required_components: {
          primary: ['personal-space-states:closeness'],
        },
      };
      const targetEntities = {
        primary: [
          {
            entity: {
              id: 'wrapped-npc',
              components: { 'personal-space-states:closeness': {} },
            },
          },
        ],
      };

      const result = validator.validateTargetRequirements(
        actionDef,
        targetEntities
      );

      expect(result).toEqual({ valid: true });
      expect(mockLogger.debug).not.toHaveBeenCalledWith(
        'Resolved primary target candidate lacks entity reference'
      );
    });

    it('should report when wrapper candidates expose falsy entities', () => {
      const actionDef = {
        id: 'test:action',
        required_components: {
          primary: ['personal-space-states:closeness'],
        },
      };
      const targetEntities = {
        primary: [{ entity: null }, { entity: undefined }],
      };

      const result = validator.validateTargetRequirements(
        actionDef,
        targetEntities
      );

      expect(result).toEqual({
        valid: false,
        reason: 'No primary target available for validation',
      });
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'Resolved primary target candidate lacks entity reference'
      );
    });

    it('should recover when hasComponent throws and still validate other candidates', () => {
      const actionDef = {
        id: 'test:action',
        required_components: {
          primary: ['personal-space-states:closeness'],
        },
      };
      const targetEntities = {
        primary: [
          {
            hasComponent: () => {
              throw new Error('hasComponent failed');
            },
          },
          {
            id: 'npc-valid',
            components: { 'personal-space-states:closeness': {} },
          },
        ],
      };

      const result = validator.validateTargetRequirements(
        actionDef,
        targetEntities
      );

      expect(result).toEqual({ valid: true });
      expect(mockLogger.debug).toHaveBeenCalledWith(
        "Error checking hasComponent('personal-space-states:closeness') on primary target unknown: hasComponent failed"
      );
    });

    it('should log missing component when entity id is unavailable', () => {
      const actionDef = {
        id: 'test:action',
        required_components: {
          primary: ['personal-space-states:closeness'],
        },
      };
      const targetEntities = {
        primary: {
          components: {},
        },
      };

      const result = validator.validateTargetRequirements(
        actionDef,
        targetEntities
      );

      expect(result).toEqual({
        valid: false,
        reason: 'Target (primary) must have component: personal-space-states:closeness',
      });
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'Target entity unknown missing required component: personal-space-states:closeness'
      );
    });

    it('should log debug messages for validation', () => {
      const actionDef = {
        id: 'test:action',
        required_components: {
          primary: ['personal-space-states:closeness'],
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
