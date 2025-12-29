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

    it('should resolve successfully when passed action context object', async () => {
      fixture = await ModTestFixture.forAction('sitting', 'sitting:sit_down');

      // Use an existing scope from the sitting mod
      await fixture.registerCustomScope('sitting', 'available_furniture');

      fixture.createSittingArrangement();
      const actorEntity = fixture.testEnv.entityManager.getEntityInstance(
        'actor1'
      );
      const targetEntity = fixture.testEnv.entityManager.getEntityInstance(
        'actor2'
      );

      // Create action context (has actor/targets) - now supported by resolver
      const actionContext = {
        actor: actorEntity,
        targets: { primary: targetEntity },
      };

      const result = fixture.testEnv.unifiedScopeResolver.resolveSync(
        'sitting:available_furniture',
        actionContext
      );

      expect(result.success).toBe(true);
    });

    it('should resolve successfully when passed scope context object', async () => {
      fixture = await ModTestFixture.forAction('sitting', 'sitting:sit_down');

      await fixture.registerCustomScope('sitting', 'available_furniture');

      fixture.createSittingArrangement();
      const actorEntity = fixture.testEnv.entityManager.getEntityInstance(
        'actor1'
      );

      // Create scope context (has runtimeCtx/dispatcher) - resolver extracts actorEntity
      const scopeContext = {
        runtimeCtx: { entityManager: {}, jsonLogicEval: {} },
        dispatcher: {},
        actorEntity,
      };

      const result = fixture.testEnv.unifiedScopeResolver.resolveSync(
        'sitting:available_furniture',
        scopeContext
      );

      expect(result.success).toBe(true);
    });

    it('should include scope name in error source location', async () => {
      fixture = await ModTestFixture.forAction(
        'straddling',
        'straddling:straddle_waist_facing'
      );

      const scopeName = 'actor_im_straddling';
      await fixture.registerCustomScope('straddling', scopeName);

      const invalidContext = {
        actor: { id: '' },
        targets: {},
      };

      const result = fixture.testEnv.unifiedScopeResolver.resolveSync(
        `straddling:${scopeName}`,
        invalidContext
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain(
        `CustomScopeResolver[straddling:${scopeName}]`
      );
    });

    it('should provide error.context with expected/received/hint/example', async () => {
      fixture = await ModTestFixture.forAction('sitting', 'sitting:sit_down');

      await fixture.registerCustomScope('sitting', 'available_furniture');

      const invalidContext = {
        actor: { id: '' },
        targets: { primary: { id: 'target1' } },
      };

      const result = fixture.testEnv.unifiedScopeResolver.resolveSync(
        'sitting:available_furniture',
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
