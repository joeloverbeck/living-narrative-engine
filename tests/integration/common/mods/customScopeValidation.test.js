/**
 * @file Integration tests for custom scope validation in test fixtures
 * @description Tests that ModTestFixture and ScopeResolverHelpers properly validate
 * actorEntity parameters before calling ScopeEngine.resolve()
 */

import { describe, it, expect, afterEach } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';

describe('Custom Scope Validation - Integration Tests', () => {
  describe('ModTestFixture.registerCustomScope() - Parameter Validation', () => {
    let fixture;

    afterEach(() => {
      if (fixture) {
        fixture.cleanup();
      }
    });

    it('should fail with helpful message when passed action context object', async () => {
      fixture = await ModTestFixture.forAction(
        'positioning',
        'positioning:sit_down'
      );

      // Use an existing scope from the positioning mod
      await fixture.registerCustomScope('positioning', 'available_furniture');

      // Create action context (has actor/targets) - this is invalid for scope resolution
      const actionContext = {
        actor: { id: 'actor1', components: {} },
        targets: { primary: { id: 'target1', components: {} } },
      };

      const result = fixture.testEnv.unifiedScopeResolver.resolveSync(
        'positioning:available_furniture',
        actionContext
      );

      // Should detect validation error with helpful message
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error).toContain('action pipeline context object');
      expect(result.error).toContain('actor/targets');
      expect(result.error).toContain('CustomScopeResolver[positioning:available_furniture]');
    });

    it('should fail with helpful message when passed scope context object', async () => {
      fixture = await ModTestFixture.forAction(
        'positioning',
        'positioning:sit_down'
      );

      await fixture.registerCustomScope('positioning', 'available_furniture');

      // Create scope context (has runtimeCtx/dispatcher) - this is invalid
      const scopeContext = {
        runtimeCtx: { entityManager: {}, jsonLogicEval: {} },
        dispatcher: {},
        actorEntity: { id: 'actor1' },
      };

      const result = fixture.testEnv.unifiedScopeResolver.resolveSync(
        'positioning:available_furniture',
        scopeContext
      );

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error).toContain('scope context');
      expect(result.error).toContain('CustomScopeResolver[positioning:available_furniture]');
    });

    it('should include scope name in error source location', async () => {
      fixture = await ModTestFixture.forAction(
        'positioning',
        'positioning:sit_down'
      );

      const scopeName = 'actor_im_straddling';
      await fixture.registerCustomScope('positioning', scopeName);

      const invalidContext = {
        actor: { id: 'actor1' },
        targets: {},
      };

      const result = fixture.testEnv.unifiedScopeResolver.resolveSync(
        `positioning:${scopeName}`,
        invalidContext
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain(`CustomScopeResolver[positioning:${scopeName}]`);
    });

    it('should provide error.context with expected/received/hint/example', async () => {
      fixture = await ModTestFixture.forAction(
        'positioning',
        'positioning:sit_down'
      );

      await fixture.registerCustomScope('positioning', 'available_furniture');

      const invalidContext = {
        actor: { id: 'actor1', components: {} },
        targets: { primary: { id: 'target1' } },
      };

      const result = fixture.testEnv.unifiedScopeResolver.resolveSync(
        'positioning:available_furniture',
        invalidContext
      );

      expect(result.success).toBe(false);
      expect(result.context).toBeDefined();
      expect(result.context.expected).toBeDefined();
      expect(result.context.received).toBeDefined();
      expect(result.context.hint).toBeDefined();
      expect(result.context.example).toBeDefined();
    });
  });
});
