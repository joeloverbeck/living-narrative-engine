/**
 * @file Integration tests for hybrid actor+target forbidden component validation
 * @description Validates that actions with BOTH actor and target forbidden components
 * are properly validated using multi-target format logic.
 *
 * This test suite addresses the bug where actions with both actor and target
 * forbidden components were incorrectly routed to legacy validation, which only
 * checked the target role and ignored actor forbidden components.
 *
 * REGRESSION TEST: Ensures TargetComponentValidator correctly routes actions with
 * both actor and target forbidden components to multi-target validation logic.
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { TargetComponentValidator } from '../../../src/actions/validation/TargetComponentValidator.js';

// Import action definitions
import kissCheeAction from '../../../data/mods/kissing/actions/kiss_cheek.action.json';
import kissNeckAction from '../../../data/mods/kissing/actions/kiss_neck_sensually.action.json';
import kissForeheadAction from '../../../data/mods/kissing/actions/kiss_forehead_gently.action.json';

/**
 * Test suite for hybrid actor+target forbidden component validation
 */
describe('Hybrid Actor+Target Forbidden Components Validation', () => {
  let validator;
  let mockLogger;
  let mockEntityManager;

  beforeEach(() => {
    // Create mock logger
    mockLogger = {
      info: () => {},
      warn: () => {},
      error: () => {},
      debug: () => {},
    };

    // Create mock entity manager
    mockEntityManager = {
      getEntityInstance: () => null,
      hasComponent: () => false,
      getAllComponentTypesForEntity: (entityId) => {
        // Return components based on entity ID for test scenarios
        if (entityId === 'target_giving_blowjob') {
          return ['core:actor', 'sex-states:giving_blowjob'];
        }
        if (entityId === 'target_normal') {
          return ['core:actor'];
        }
        if (entityId === 'target_receiving_blowjob') {
          return ['core:actor', 'sex-states:receiving_blowjob'];
        }
        return [];
      },
    };

    validator = new TargetComponentValidator({
      logger: mockLogger,
      entityManager: mockEntityManager,
    });
  });

  describe('Action structure validation', () => {
    it('kiss_cheek should have giving_blowjob forbidden for BOTH actor and target', () => {
      expect(kissCheeAction.forbidden_components.actor).toContain(
        'sex-states:giving_blowjob'
      );
      expect(kissCheeAction.forbidden_components.target).toContain(
        'sex-states:giving_blowjob'
      );
    });

    it('kiss_neck_sensually should have giving_blowjob forbidden for BOTH actor and target', () => {
      expect(kissNeckAction.forbidden_components.actor).toContain(
        'sex-states:giving_blowjob'
      );
      // Updated per issue: now also has target forbidden
      expect(kissNeckAction.forbidden_components.target).toContain(
        'sex-states:giving_blowjob'
      );
    });

    it('kiss_forehead_gently should have giving_blowjob forbidden for BOTH actor and target', () => {
      expect(kissForeheadAction.forbidden_components.actor).toContain(
        'sex-states:giving_blowjob'
      );
      expect(kissForeheadAction.forbidden_components.target).toContain(
        'sex-states:giving_blowjob'
      );
    });
  });

  describe('Target validation with giving_blowjob component', () => {
    it('should REJECT target with giving_blowjob component (kiss_cheek)', () => {
      const targetEntities = {
        target: { id: 'target_giving_blowjob' },
      };

      const result = validator.validateTargetComponents(
        kissCheeAction,
        targetEntities
      );

      expect(result.valid).toBe(false);
      expect(result.reason).toContain('forbidden component');
      expect(result.reason).toContain('sex-states:giving_blowjob');
    });

    it('should ACCEPT target WITHOUT giving_blowjob component (kiss_cheek)', () => {
      const targetEntities = {
        target: { id: 'target_normal' },
      };

      const result = validator.validateTargetComponents(
        kissCheeAction,
        targetEntities
      );

      expect(result.valid).toBe(true);
    });

    it('should REJECT target with giving_blowjob component (kiss_forehead)', () => {
      const targetEntities = {
        target: { id: 'target_giving_blowjob' },
      };

      const result = validator.validateTargetComponents(
        kissForeheadAction,
        targetEntities
      );

      expect(result.valid).toBe(false);
      expect(result.reason).toContain('forbidden component');
      expect(result.reason).toContain('sex-states:giving_blowjob');
    });

    it('should ACCEPT target WITHOUT giving_blowjob component (kiss_forehead)', () => {
      const targetEntities = {
        target: { id: 'target_normal' },
      };

      const result = validator.validateTargetComponents(
        kissForeheadAction,
        targetEntities
      );

      expect(result.valid).toBe(true);
    });
  });

  describe('Differentiation: receiving vs giving blowjob', () => {
    it('should ACCEPT target with receiving_blowjob (not giving_blowjob)', () => {
      const targetEntities = {
        target: { id: 'target_receiving_blowjob' },
      };

      const result = validator.validateTargetComponents(
        kissCheeAction,
        targetEntities
      );

      // Should be valid because target has receiving_blowjob, not giving_blowjob
      expect(result.valid).toBe(true);
    });
  });

  describe('Format detection regression tests', () => {
    it('should use multi-target validation for actions with BOTH actor and target forbidden components', () => {
      // This test verifies the fix for the bug where actions with both
      // actor and target forbidden components were incorrectly routed to
      // legacy validation (which only checks target role)

      const actionWithBoth = {
        id: 'test:hybrid_action',
        forbidden_components: {
          actor: ['test:component_a'],
          target: ['test:component_b'],
        },
      };

      const targetEntities = {
        target: { id: 'target_with_b', components: ['test:component_b'] },
      };

      // Mock getAllComponentTypesForEntity for this specific case
      const originalGetComponents =
        mockEntityManager.getAllComponentTypesForEntity;
      mockEntityManager.getAllComponentTypesForEntity = (entityId) => {
        if (entityId === 'target_with_b') {
          return ['test:component_b'];
        }
        return originalGetComponents(entityId);
      };

      const result = validator.validateTargetComponents(
        actionWithBoth,
        targetEntities
      );

      // Should fail validation because target has forbidden component
      expect(result.valid).toBe(false);

      // Restore mock
      mockEntityManager.getAllComponentTypesForEntity = originalGetComponents;
    });

    it('should use legacy validation for actions with ONLY target forbidden components (no actor)', () => {
      const actionLegacy = {
        id: 'test:legacy_action',
        forbidden_components: {
          target: ['test:component_x'],
        },
      };

      const targetEntities = {
        target: { id: 'target_with_x', components: ['test:component_x'] },
      };

      // Mock getAllComponentTypesForEntity
      const originalGetComponents =
        mockEntityManager.getAllComponentTypesForEntity;
      mockEntityManager.getAllComponentTypesForEntity = (entityId) => {
        if (entityId === 'target_with_x') {
          return ['test:component_x'];
        }
        return originalGetComponents(entityId);
      };

      const result = validator.validateTargetComponents(
        actionLegacy,
        targetEntities
      );

      // Should fail validation (legacy path still works)
      expect(result.valid).toBe(false);

      // Restore mock
      mockEntityManager.getAllComponentTypesForEntity = originalGetComponents;
    });
  });

  describe('Legacy action compatibility', () => {
    it('should validate target forbidden components using primary role for legacy actions', () => {
      // Simulate a legacy action with forbidden_components.target
      const legacyAction = {
        id: 'test:legacy_with_target_forbidden',
        forbidden_components: {
          actor: ['test:component_a'],
          target: ['sex-states:giving_blowjob'],
        },
      };

      // Legacy actions populate resolvedTargets.primary, not resolvedTargets.target
      const targetEntities = {
        primary: [{ id: 'target_giving_blowjob' }],
        // target role is empty (as it is for legacy actions)
      };

      // Mock getAllComponentTypesForEntity
      const originalGetComponents =
        mockEntityManager.getAllComponentTypesForEntity;
      mockEntityManager.getAllComponentTypesForEntity = (entityId) => {
        if (entityId === 'target_giving_blowjob') {
          return ['core:actor', 'sex-states:giving_blowjob'];
        }
        return originalGetComponents(entityId);
      };

      const result = validator.validateTargetComponents(
        legacyAction,
        targetEntities
      );

      // Should fail validation because primary target has forbidden component
      expect(result.valid).toBe(false);
      expect(result.reason).toContain('forbidden component');
      expect(result.reason).toContain('sex-states:giving_blowjob');

      // Restore mock
      mockEntityManager.getAllComponentTypesForEntity = originalGetComponents;
    });

    it('should ACCEPT legacy action when primary target does NOT have forbidden component', () => {
      const legacyAction = {
        id: 'test:legacy_with_target_forbidden',
        forbidden_components: {
          actor: ['test:component_a'],
          target: ['sex-states:giving_blowjob'],
        },
      };

      // Legacy actions with normal target (no giving_blowjob)
      const targetEntities = {
        primary: [{ id: 'target_normal' }],
      };

      const originalGetComponents =
        mockEntityManager.getAllComponentTypesForEntity;
      mockEntityManager.getAllComponentTypesForEntity = (entityId) => {
        if (entityId === 'target_normal') {
          return ['core:actor'];
        }
        return originalGetComponents(entityId);
      };

      const result = validator.validateTargetComponents(
        legacyAction,
        targetEntities
      );

      // Should pass validation
      expect(result.valid).toBe(true);

      mockEntityManager.getAllComponentTypesForEntity = originalGetComponents;
    });
  });

  describe('Edge cases', () => {
    it('should handle missing forbidden_components gracefully', () => {
      const actionNoForbidden = {
        id: 'test:no_forbidden',
      };

      const targetEntities = {
        target: { id: 'any_target' },
      };

      const result = validator.validateTargetComponents(
        actionNoForbidden,
        targetEntities
      );

      // Should pass validation when no forbidden components defined
      expect(result.valid).toBe(true);
    });

    it('should handle null targetEntities gracefully', () => {
      const result = validator.validateTargetComponents(kissCheeAction, null);

      // Should pass validation when no target entities provided
      expect(result.valid).toBe(true);
    });

    it('should handle undefined targetEntities gracefully', () => {
      const result = validator.validateTargetComponents(
        kissCheeAction,
        undefined
      );

      // Should pass validation when no target entities provided
      expect(result.valid).toBe(true);
    });

    it('should handle empty target entity gracefully', () => {
      const targetEntities = {
        target: null,
      };

      const result = validator.validateTargetComponents(
        kissCheeAction,
        targetEntities
      );

      // Should pass validation when target is null
      expect(result.valid).toBe(true);
    });
  });

  describe('Multi-target format support', () => {
    it('should validate primary/secondary/tertiary target roles', () => {
      const multiTargetAction = {
        id: 'test:multi_target',
        forbidden_components: {
          primary: ['test:forbidden_primary'],
          secondary: ['test:forbidden_secondary'],
        },
      };

      const targetEntities = {
        primary: [{ id: 'primary_with_forbidden' }],
        secondary: [{ id: 'secondary_normal' }],
      };

      // Mock getAllComponentTypesForEntity
      const originalGetComponents =
        mockEntityManager.getAllComponentTypesForEntity;
      mockEntityManager.getAllComponentTypesForEntity = (entityId) => {
        if (entityId === 'primary_with_forbidden') {
          return ['test:forbidden_primary'];
        }
        if (entityId === 'secondary_normal') {
          return ['other:component'];
        }
        return originalGetComponents(entityId);
      };

      const result = validator.validateTargetComponents(
        multiTargetAction,
        targetEntities
      );

      // Should fail because primary target has forbidden component
      expect(result.valid).toBe(false);

      // Restore mock
      mockEntityManager.getAllComponentTypesForEntity = originalGetComponents;
    });
  });
});
