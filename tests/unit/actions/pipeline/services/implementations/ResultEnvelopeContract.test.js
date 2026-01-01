import { describe, it, expect, jest } from '@jest/globals';
import TargetResolutionCoordinator from '../../../../../../src/actions/pipeline/services/implementations/TargetResolutionCoordinator.js';
import { PipelineResult } from '../../../../../../src/actions/pipeline/PipelineResult.js';
import { TargetResolutionService } from '../../../../../../src/actions/targetResolutionService.js';
import { ActionResult } from '../../../../../../src/actions/core/actionResult.js';

function createMockLogger() {
  return {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };
}

function createCoordinator() {
  return new TargetResolutionCoordinator({
    dependencyResolver: {
      getResolutionOrder: jest.fn(() => ['primary']),
    },
    contextBuilder: {
      buildScopeContext: jest.fn((_actor, actionContext) => ({
        actionContext,
      })),
      buildScopeContextForSpecificPrimary: jest.fn(() => ({})),
    },
    nameResolver: {
      getEntityDisplayName: jest.fn((id) => `Entity ${id}`),
    },
    unifiedScopeResolver: {
      resolve: jest.fn(async () => ({
        success: true,
        value: new Set(['entity-1']),
      })),
    },
    entityManager: {
      getEntityInstance: jest.fn((id) => (id ? { id } : null)),
    },
    logger: createMockLogger(),
    tracingOrchestrator: {
      isActionAwareTrace: jest.fn(() => false),
      captureScopeEvaluation: jest.fn(),
      captureMultiTargetResolution: jest.fn(),
    },
    resultBuilder: {
      buildMultiTargetResult: jest.fn(() =>
        PipelineResult.success({
          data: { actionsWithTargets: [{ actionDef: { id: 'test' } }] },
        })
      ),
    },
  });
}

describe('Result Envelope Contract', () => {
  describe('TargetResolutionCoordinator', () => {
    it('returns PipelineResult { success, data } on success', async () => {
      const coordinator = createCoordinator();
      const context = {
        actionDef: {
          id: 'test:action',
          targets: {
            primary: { scope: 'core:nearby_actors', placeholder: 'target' },
          },
        },
        actor: { id: 'actor-1' },
        actionContext: { currentLocation: 'loc-1' },
        data: {},
      };
      const result = await coordinator.coordinateResolution(context);

      expect(typeof result.success).toBe('boolean');
      expect(result.success).toBe(true);
      expect(result).toHaveProperty('data');
    });

    it('returns PipelineResult { success: false, errors } on failure', async () => {
      const coordinator = createCoordinator();
      const context = {
        actionDef: { id: 'test:action', targets: null },
        actor: { id: 'actor-1' },
        actionContext: { currentLocation: 'loc-1' },
        data: {},
      };
      const result = await coordinator.coordinateResolution(context);

      expect(typeof result.success).toBe('boolean');
      expect(result.success).toBe(false);
      expect(Array.isArray(result.errors)).toBe(true);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('ITargetResolutionService (TargetResolutionService)', () => {
    it('returns ActionResult { success, value } on success', () => {
      const unifiedScopeResolver = {
        resolve: jest.fn(() =>
          ActionResult.success(new Set(['entity-1']))
        ),
      };
      const targetResolver = new TargetResolutionService({
        unifiedScopeResolver,
        logger: createMockLogger(),
      });

      const result = targetResolver.resolveTargets(
        'core:nearby_actors',
        { id: 'actor-1' },
        { currentLocation: 'loc-1' },
        null,
        'test:action'
      );

      expect(typeof result.success).toBe('boolean');
      if (result.success) {
        expect(result).toHaveProperty('value');
        expect(Array.isArray(result.value)).toBe(true);
      }
    });
  });
});
