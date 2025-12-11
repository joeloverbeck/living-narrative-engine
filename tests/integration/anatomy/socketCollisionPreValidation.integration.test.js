/**
 * @file Integration test for socket collision pre-validation
 *
 * Tests that socket collisions are detected at blueprint level before
 * entity creation begins, providing early and helpful error messages.
 */

import { describe, it, expect } from '@jest/globals';
import { validateBlueprintSocketUniqueness } from '../../../src/anatomy/bodyBlueprintFactory/slotResolutionOrchestrator.js';
import { ValidationError } from '../../../src/errors/validationError.js';

describe('Socket Collision Pre-Validation (integration)', () => {
  describe('pre-validation catches collision before entity creation', () => {
    it('should detect collision in realistic humanoid blueprint', () => {
      // Realistic blueprint where modder accidentally uses same socket ID
      const blueprint = {
        id: 'anatomy:humanoid',
        slots: {
          body: { entityDefinition: 'anatomy:human_body' },
          // Correct: different sockets for different arms
          left_arm: {
            parent: 'body',
            socket: 'shoulder_left',
            entityDefinition: 'anatomy:arm',
          },
          // ERROR: accidentally using same socket as left_arm
          right_arm: {
            parent: 'body',
            socket: 'shoulder_left',
            entityDefinition: 'anatomy:arm',
          },
          head: {
            parent: 'body',
            socket: 'neck',
            entityDefinition: 'anatomy:head',
          },
          left_leg: {
            parent: 'body',
            socket: 'hip_left',
            entityDefinition: 'anatomy:leg',
          },
          right_leg: {
            parent: 'body',
            socket: 'hip_right',
            entityDefinition: 'anatomy:leg',
          },
        },
      };

      expect(() => {
        validateBlueprintSocketUniqueness(blueprint);
      }).toThrow(ValidationError);
    });

    it('should detect collision in creature with symmetrical parts (chicken bug scenario)', () => {
      // This mimics the original chicken bug scenario
      // where left and right legs use the same socket IDs for their children
      const blueprint = {
        id: 'anatomy:chicken',
        slots: {
          body: { entityDefinition: 'anatomy-creatures:chicken_body' },
          left_leg: {
            parent: 'body',
            socket: 'hip_left',
            entityDefinition: 'anatomy-creatures:chicken_leg',
          },
          right_leg: {
            parent: 'body',
            socket: 'hip_right',
            entityDefinition: 'anatomy-creatures:chicken_leg',
          },
          // These should use different sockets on their respective parents
          // This is VALID because they have different parents (left_leg vs right_leg)
          left_foot: {
            parent: 'left_leg',
            socket: 'ankle',
            entityDefinition: 'anatomy-creatures:chicken_foot',
          },
          right_foot: {
            parent: 'right_leg',
            socket: 'ankle',
            entityDefinition: 'anatomy-creatures:chicken_foot',
          },
          // These are ALSO valid - different parents
          left_spur: {
            parent: 'left_leg',
            socket: 'spur_joint',
            entityDefinition: 'anatomy:spur',
          },
          right_spur: {
            parent: 'right_leg',
            socket: 'spur_joint',
            entityDefinition: 'anatomy:spur',
          },
        },
      };

      // This should NOT throw - same socket names on different parent instances is OK
      expect(() => {
        validateBlueprintSocketUniqueness(blueprint);
      }).not.toThrow();
    });

    it('should detect collision when same parent has duplicate socket usage', () => {
      // Blueprint with collision: two children trying to use same socket on same parent
      const blueprint = {
        id: 'anatomy:creature',
        slots: {
          body: { entityDefinition: 'anatomy:body' },
          left_leg: {
            parent: 'body',
            socket: 'hip_left',
            entityDefinition: 'anatomy:leg',
          },
          // Two feet trying to attach to same socket on left_leg
          foot1: {
            parent: 'left_leg',
            socket: 'ankle',
            entityDefinition: 'anatomy:foot',
          },
          foot2: {
            parent: 'left_leg',
            socket: 'ankle',
            entityDefinition: 'anatomy:extra_foot',
          },
        },
      };

      expect(() => {
        validateBlueprintSocketUniqueness(blueprint);
      }).toThrow(ValidationError);

      expect(() => {
        validateBlueprintSocketUniqueness(blueprint);
      }).toThrow(/foot1/);

      expect(() => {
        validateBlueprintSocketUniqueness(blueprint);
      }).toThrow(/foot2/);
    });
  });

  describe('error message identifies conflicting slot keys', () => {
    it('should include all relevant information for debugging', () => {
      const blueprint = {
        slots: {
          torso: { entityDefinition: 'body' },
          appendage_alpha: {
            parent: 'torso',
            socket: 'attachment_point',
            entityDefinition: 'limb',
          },
          appendage_beta: {
            parent: 'torso',
            socket: 'attachment_point',
            entityDefinition: 'limb',
          },
        },
      };

      let error;
      try {
        validateBlueprintSocketUniqueness(blueprint);
      } catch (err) {
        error = err;
      }

      expect(error).toBeInstanceOf(ValidationError);
      // Socket ID
      expect(error.message).toContain('attachment_point');
      // Parent slot key
      expect(error.message).toContain('torso');
      // Both conflicting slot keys
      expect(error.message).toContain('appendage_alpha');
      expect(error.message).toContain('appendage_beta');
      // Actionable guidance
      expect(error.message).toContain('Each socket can only attach one child');
    });
  });

  describe('complex hierarchies', () => {
    it('should validate deeply nested blueprint correctly', () => {
      const blueprint = {
        slots: {
          root: { entityDefinition: 'base' },
          level1_a: {
            parent: 'root',
            socket: 'socket_1',
            entityDefinition: 'part',
          },
          level1_b: {
            parent: 'root',
            socket: 'socket_2',
            entityDefinition: 'part',
          },
          level2_aa: {
            parent: 'level1_a',
            socket: 'child_socket',
            entityDefinition: 'subpart',
          },
          level2_ab: {
            parent: 'level1_a',
            socket: 'child_socket_2',
            entityDefinition: 'subpart',
          },
          level2_ba: {
            parent: 'level1_b',
            socket: 'child_socket',
            entityDefinition: 'subpart',
          },
          level2_bb: {
            parent: 'level1_b',
            socket: 'child_socket_2',
            entityDefinition: 'subpart',
          },
          level3_aaa: {
            parent: 'level2_aa',
            socket: 'tiny_socket',
            entityDefinition: 'tiny',
          },
          level3_bba: {
            parent: 'level2_bb',
            socket: 'tiny_socket',
            entityDefinition: 'tiny',
          },
        },
      };

      // Valid structure - no collisions
      expect(() => {
        validateBlueprintSocketUniqueness(blueprint);
      }).not.toThrow();
    });

    it('should detect collision at any level of hierarchy', () => {
      const blueprint = {
        slots: {
          root: { entityDefinition: 'base' },
          level1_a: {
            parent: 'root',
            socket: 'socket_1',
            entityDefinition: 'part',
          },
          level2_aa: {
            parent: 'level1_a',
            socket: 'child_socket',
            entityDefinition: 'subpart',
          },
          // Collision at level 2 - same parent, same socket
          level2_ab: {
            parent: 'level1_a',
            socket: 'child_socket',
            entityDefinition: 'collision',
          },
        },
      };

      expect(() => {
        validateBlueprintSocketUniqueness(blueprint);
      }).toThrow(ValidationError);
    });
  });
});
