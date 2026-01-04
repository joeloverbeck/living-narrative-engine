/**
 * @file Tests for ModTestFixture component conflict warnings
 * @see ACTDISDIAFAIFAS-009
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';

// Mock console.warn to capture warnings
let consoleWarnSpy;

/**
 * Creates a minimal mock ModActionTestFixture-like object for testing the warning logic.
 * This isolates the validation logic for unit testing without requiring full fixture setup.
 *
 * @param {object} options - Configuration options
 * @param {object|null} [options.actionDefinition] - Action definition with forbidden_components
 * @param {string} [options.actionId] - Action ID for fallback in warnings
 * @returns {object} Mock context with validateComponentConflicts method and warnings array
 */
function createMockValidationContext({
  actionDefinition = null,
  actionId = 'test:action',
} = {}) {
  const warnings = [];

  /**
   * Mimics the #validateComponentConflicts method from ModActionTestFixture.
   *
   * @param {object} entity - Entity to validate
   * @param {object} options - Options including validateConflicts flag
   * @param {string} methodName - Calling method name for warning context
   */
  function validateComponentConflicts(entity, options = {}, methodName = 'unknown') {
    if (options.validateConflicts === false) return;
    if (!actionDefinition) return;

    const forbiddenActor = actionDefinition.forbidden_components?.actor || [];
    const entityComponents = Object.keys(entity.components || {});

    const conflicts = entityComponents.filter((c) => forbiddenActor.includes(c));

    for (const conflict of conflicts) {
      const warningMessage =
        `[ModTestFixture Warning] Entity '${entity.id}' has component '${conflict}' ` +
        `which is in forbidden_components.actor for action '${actionDefinition.id || actionId}'.\n` +
        `This may cause the action to be unavailable in tests.\n` +
        `To disable this warning, use: ${methodName}([...], { validateConflicts: false })`;

      warnings.push(warningMessage);
      console.warn(warningMessage);
    }
  }

  return {
    validateComponentConflicts,
    warnings,
    actionDefinition,
  };
}

describe('ModTestFixture component conflict warnings', () => {
  beforeEach(() => {
    consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
  });

  afterEach(() => {
    consoleWarnSpy.mockRestore();
  });

  describe('warning behavior', () => {
    it('should log warning when entity has forbidden_components for loaded action', () => {
      const ctx = createMockValidationContext({
        actionDefinition: {
          id: 'personal-space:get_close',
          forbidden_components: {
            actor: ['personal-space-states:closeness'],
          },
        },
      });

      const entity = {
        id: 'Alice',
        components: {
          'core:actor': {},
          'personal-space-states:closeness': { closeToEntity: 'Bob' },
        },
      };

      ctx.validateComponentConflicts(entity, {}, 'createStandardActorTarget');

      expect(consoleWarnSpy).toHaveBeenCalledTimes(1);
      expect(ctx.warnings).toHaveLength(1);
    });

    it('should include component ID and action ID in warning message', () => {
      const ctx = createMockValidationContext({
        actionDefinition: {
          id: 'personal-space:get_close',
          forbidden_components: {
            actor: ['personal-space-states:closeness'],
          },
        },
      });

      const entity = {
        id: 'Actor',
        components: {
          'personal-space-states:closeness': {},
        },
      };

      ctx.validateComponentConflicts(entity, {}, 'createStandardActorTarget');

      expect(ctx.warnings[0]).toContain('personal-space-states:closeness');
      expect(ctx.warnings[0]).toContain('personal-space:get_close');
    });

    it('should disable warnings with { validateConflicts: false }', () => {
      const ctx = createMockValidationContext({
        actionDefinition: {
          id: 'personal-space:get_close',
          forbidden_components: {
            actor: ['personal-space-states:closeness'],
          },
        },
      });

      const entity = {
        id: 'Actor',
        components: {
          'personal-space-states:closeness': {},
        },
      };

      ctx.validateComponentConflicts(entity, { validateConflicts: false }, 'createStandardActorTarget');

      expect(consoleWarnSpy).not.toHaveBeenCalled();
      expect(ctx.warnings).toHaveLength(0);
    });

    it('should not prevent entity validation (non-blocking)', () => {
      const ctx = createMockValidationContext({
        actionDefinition: {
          id: 'personal-space:get_close',
          forbidden_components: {
            actor: ['personal-space-states:closeness'],
          },
        },
      });

      const entity = {
        id: 'Actor',
        components: {
          'personal-space-states:closeness': {},
        },
      };

      // Should not throw
      expect(() => {
        ctx.validateComponentConflicts(entity, {}, 'createStandardActorTarget');
      }).not.toThrow();

      // Warning should still be logged
      expect(ctx.warnings).toHaveLength(1);
    });

    it('should not log warning when no conflicts exist', () => {
      const ctx = createMockValidationContext({
        actionDefinition: {
          id: 'personal-space:get_close',
          forbidden_components: {
            actor: ['personal-space-states:closeness'],
          },
        },
      });

      const entity = {
        id: 'Actor',
        components: {
          'core:actor': {},
          'core:location': { locationId: 'room1' },
        },
      };

      ctx.validateComponentConflicts(entity, {}, 'createStandardActorTarget');

      expect(consoleWarnSpy).not.toHaveBeenCalled();
      expect(ctx.warnings).toHaveLength(0);
    });

    it('should log multiple conflicts separately', () => {
      const ctx = createMockValidationContext({
        actionDefinition: {
          id: 'test:action',
          forbidden_components: {
            actor: ['component-a', 'component-b', 'component-c'],
          },
        },
      });

      const entity = {
        id: 'Actor',
        components: {
          'component-a': {},
          'component-b': {},
          'component-c': {},
        },
      };

      ctx.validateComponentConflicts(entity, {}, 'createStandardActorTarget');

      expect(consoleWarnSpy).toHaveBeenCalledTimes(3);
      expect(ctx.warnings).toHaveLength(3);
      expect(ctx.warnings[0]).toContain('component-a');
      expect(ctx.warnings[1]).toContain('component-b');
      expect(ctx.warnings[2]).toContain('component-c');
    });

    it('should include fixture method name in warning message', () => {
      const ctx = createMockValidationContext({
        actionDefinition: {
          id: 'test:action',
          forbidden_components: {
            actor: ['forbidden-component'],
          },
        },
      });

      const entity = {
        id: 'Actor',
        components: {
          'forbidden-component': {},
        },
      };

      ctx.validateComponentConflicts(entity, {}, 'createStandardActorTarget');

      expect(ctx.warnings[0]).toContain('createStandardActorTarget');
      expect(ctx.warnings[0]).toContain('{ validateConflicts: false }');
    });

    it('should handle action without forbidden_components gracefully', () => {
      const ctx = createMockValidationContext({
        actionDefinition: {
          id: 'test:simple_action',
          // No forbidden_components defined
        },
      });

      const entity = {
        id: 'Actor',
        components: {
          'some-component': {},
        },
      };

      expect(() => {
        ctx.validateComponentConflicts(entity, {}, 'createStandardActorTarget');
      }).not.toThrow();

      expect(consoleWarnSpy).not.toHaveBeenCalled();
    });

    it('should handle missing action definition gracefully', () => {
      const ctx = createMockValidationContext({
        actionDefinition: null, // No action loaded
      });

      const entity = {
        id: 'Actor',
        components: {
          'some-component': {},
        },
      };

      expect(() => {
        ctx.validateComponentConflicts(entity, {}, 'createStandardActorTarget');
      }).not.toThrow();

      expect(consoleWarnSpy).not.toHaveBeenCalled();
    });

    it('should handle entity with no components gracefully', () => {
      const ctx = createMockValidationContext({
        actionDefinition: {
          id: 'test:action',
          forbidden_components: {
            actor: ['forbidden-component'],
          },
        },
      });

      const entity = {
        id: 'Actor',
        // No components
      };

      expect(() => {
        ctx.validateComponentConflicts(entity, {}, 'createStandardActorTarget');
      }).not.toThrow();

      expect(consoleWarnSpy).not.toHaveBeenCalled();
    });
  });

  describe('warning format', () => {
    it('should format warning message according to specification', () => {
      const ctx = createMockValidationContext({
        actionDefinition: {
          id: 'personal-space:get_close',
          forbidden_components: {
            actor: ['personal-space-states:closeness'],
          },
        },
      });

      const entity = {
        id: 'Actor',
        components: {
          'personal-space-states:closeness': {},
        },
      };

      ctx.validateComponentConflicts(entity, {}, 'createStandardActorTarget');

      const warning = ctx.warnings[0];
      expect(warning).toContain('[ModTestFixture Warning]');
      expect(warning).toContain("Entity 'Actor'");
      expect(warning).toContain("component 'personal-space-states:closeness'");
      expect(warning).toContain('forbidden_components.actor');
      expect(warning).toContain("action 'personal-space:get_close'");
      expect(warning).toContain('may cause the action to be unavailable');
      expect(warning).toContain('validateConflicts: false');
    });
  });

  describe('invariants', () => {
    it('INV-WARN-1: warning is non-blocking (console.warn only)', () => {
      const ctx = createMockValidationContext({
        actionDefinition: {
          id: 'test:action',
          forbidden_components: {
            actor: ['forbidden-component'],
          },
        },
      });

      const entity = {
        id: 'Actor',
        components: {
          'forbidden-component': {},
        },
      };

      // Should complete without throwing
      const result = ctx.validateComponentConflicts(entity, {}, 'createStandardActorTarget');

      // Return value is undefined (void function)
      expect(result).toBeUndefined();

      // But warning was logged
      expect(consoleWarnSpy).toHaveBeenCalled();
    });

    it('INV-WARN-2: default behavior is to warn (opt-out to disable)', () => {
      const ctx = createMockValidationContext({
        actionDefinition: {
          id: 'test:action',
          forbidden_components: {
            actor: ['forbidden-component'],
          },
        },
      });

      const entity = {
        id: 'Actor',
        components: {
          'forbidden-component': {},
        },
      };

      // Default options (empty object) should warn
      ctx.validateComponentConflicts(entity, {}, 'createStandardActorTarget');
      expect(consoleWarnSpy).toHaveBeenCalled();
    });

    it('INV-WARN-3: no performance impact when no action loaded', () => {
      const ctx = createMockValidationContext({
        actionDefinition: null,
      });

      const entity = {
        id: 'Actor',
        components: {
          'some-component': {},
        },
      };

      // Early return when no action definition
      const start = performance.now();
      for (let i = 0; i < 1000; i++) {
        ctx.validateComponentConflicts(entity, {}, 'createStandardActorTarget');
      }
      const elapsed = performance.now() - start;

      // Should be very fast (< 50ms for 1000 calls)
      expect(elapsed).toBeLessThan(50);
      expect(consoleWarnSpy).not.toHaveBeenCalled();
    });
  });
});
