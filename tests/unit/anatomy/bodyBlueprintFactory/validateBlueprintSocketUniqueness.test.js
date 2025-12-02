/**
 * @file Unit tests for validateBlueprintSocketUniqueness function
 *
 * Tests blueprint-level socket collision pre-validation that provides
 * early and helpful error messages before entity creation begins.
 */

import { describe, it, expect } from '@jest/globals';
import { validateBlueprintSocketUniqueness } from '../../../../src/anatomy/bodyBlueprintFactory/slotResolutionOrchestrator.js';
import { ValidationError } from '../../../../src/errors/validationError.js';

describe('validateBlueprintSocketUniqueness', () => {
  describe('collision detection', () => {
    it('should throw ValidationError when two slots use same socket on same parent', () => {
      const blueprint = {
        slots: {
          body: { entityDefinition: 'torso' },
          left_arm: { parent: 'body', socket: 'shoulder', entityDefinition: 'arm' },
          right_arm: { parent: 'body', socket: 'shoulder', entityDefinition: 'arm' },
        },
      };

      expect(() => {
        validateBlueprintSocketUniqueness(blueprint);
      }).toThrow(ValidationError);
    });

    it('should include socket ID in error message', () => {
      const blueprint = {
        slots: {
          body: { entityDefinition: 'torso' },
          left_arm: { parent: 'body', socket: 'shoulder', entityDefinition: 'arm' },
          right_arm: { parent: 'body', socket: 'shoulder', entityDefinition: 'arm' },
        },
      };

      expect(() => {
        validateBlueprintSocketUniqueness(blueprint);
      }).toThrow(/socket 'shoulder'/);
    });

    it('should include parent slot key in error message', () => {
      const blueprint = {
        slots: {
          torso: { entityDefinition: 'body' },
          child1: { parent: 'torso', socket: 'attachment_point', entityDefinition: 'part' },
          child2: { parent: 'torso', socket: 'attachment_point', entityDefinition: 'part' },
        },
      };

      expect(() => {
        validateBlueprintSocketUniqueness(blueprint);
      }).toThrow(/on parent 'torso'/);
    });

    it('should include both conflicting slot keys in error message', () => {
      const blueprint = {
        slots: {
          parent_slot: { entityDefinition: 'body' },
          first_child: { parent: 'parent_slot', socket: 'socket_a', entityDefinition: 'part' },
          second_child: { parent: 'parent_slot', socket: 'socket_a', entityDefinition: 'part' },
        },
      };

      let caughtError;
      try {
        validateBlueprintSocketUniqueness(blueprint);
      } catch (err) {
        caughtError = err;
      }

      expect(caughtError).toBeInstanceOf(ValidationError);
      expect(caughtError.message).toContain('first_child');
      expect(caughtError.message).toContain('second_child');
    });
  });

  describe('valid blueprints', () => {
    it('should allow same socket ID on different parent instances', () => {
      const blueprint = {
        slots: {
          body: { entityDefinition: 'torso' },
          left_leg: { parent: 'body', socket: 'hip_left', entityDefinition: 'leg' },
          right_leg: { parent: 'body', socket: 'hip_right', entityDefinition: 'leg' },
          left_foot: { parent: 'left_leg', socket: 'ankle', entityDefinition: 'foot' },
          right_foot: { parent: 'right_leg', socket: 'ankle', entityDefinition: 'foot' },
        },
      };

      expect(() => {
        validateBlueprintSocketUniqueness(blueprint);
      }).not.toThrow();
    });

    it('should allow different sockets on same parent', () => {
      const blueprint = {
        slots: {
          body: { entityDefinition: 'torso' },
          left_arm: { parent: 'body', socket: 'left_shoulder', entityDefinition: 'arm' },
          right_arm: { parent: 'body', socket: 'right_shoulder', entityDefinition: 'arm' },
          head: { parent: 'body', socket: 'neck', entityDefinition: 'head' },
        },
      };

      expect(() => {
        validateBlueprintSocketUniqueness(blueprint);
      }).not.toThrow();
    });
  });

  describe('edge cases', () => {
    it('should skip slots without parent property', () => {
      const blueprint = {
        slots: {
          root: { entityDefinition: 'body' },
          child1: { parent: 'root', socket: 'socket_a', entityDefinition: 'part' },
        },
      };

      expect(() => {
        validateBlueprintSocketUniqueness(blueprint);
      }).not.toThrow();
    });

    it('should skip slots without socket property', () => {
      const blueprint = {
        slots: {
          root: { entityDefinition: 'body' },
          child_no_socket: { parent: 'root', entityDefinition: 'part' },
        },
      };

      expect(() => {
        validateBlueprintSocketUniqueness(blueprint);
      }).not.toThrow();
    });

    it('should handle empty slots object', () => {
      const blueprint = {
        slots: {},
      };

      expect(() => {
        validateBlueprintSocketUniqueness(blueprint);
      }).not.toThrow();
    });

    it('should handle undefined slots', () => {
      const blueprint = {};

      expect(() => {
        validateBlueprintSocketUniqueness(blueprint);
      }).not.toThrow();
    });

    it('should handle null slots gracefully', () => {
      const blueprint = { slots: null };

      expect(() => {
        validateBlueprintSocketUniqueness(blueprint);
      }).not.toThrow();
    });
  });

  describe('error message quality', () => {
    it('should provide actionable guidance in error message', () => {
      const blueprint = {
        slots: {
          body: { entityDefinition: 'torso' },
          arm1: { parent: 'body', socket: 'shoulder', entityDefinition: 'arm' },
          arm2: { parent: 'body', socket: 'shoulder', entityDefinition: 'arm' },
        },
      };

      expect(() => {
        validateBlueprintSocketUniqueness(blueprint);
      }).toThrow(/Each socket can only attach one child per parent/);
    });
  });
});
