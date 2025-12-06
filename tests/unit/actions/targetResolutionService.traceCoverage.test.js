import { describe, it, expect, jest } from '@jest/globals';
import { TargetResolutionService } from '../../../src/actions/targetResolutionService.js';
import { ActionResult } from '../../../src/actions/core/actionResult.js';
import { ActionTargetContext } from '../../../src/models/actionTargetContext.js';

describe('TargetResolutionService trace and logging coverage', () => {
  /**
   * Creates a logger stub that satisfies ServiceSetup requirements.
   *
   * @returns {{ info: jest.Mock, warn: jest.Mock, error: jest.Mock, debug: jest.Mock }}
   */
  function createLogger() {
    return {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    };
  }

  it('wraps resolution inside a trace span when withSpan is available', () => {
    const unifiedScopeResolver = {
      resolve: jest
        .fn()
        .mockReturnValue(ActionResult.success(new Set(['target-1']))),
    };
    const logger = createLogger();
    const trace = {
      withSpan: jest.fn((name, spanFn, attributes) => spanFn()),
      info: jest.fn(),
    };

    const service = new TargetResolutionService({
      unifiedScopeResolver,
      logger,
    });
    const actor = { id: 'actor-1' };
    const context = { currentLocation: 'garden' };

    const result = service.resolveTargets(
      'test:scope',
      actor,
      context,
      trace,
      'action-123'
    );

    expect(trace.withSpan).toHaveBeenCalledTimes(1);
    expect(trace.withSpan).toHaveBeenCalledWith(
      'target.resolve',
      expect.any(Function),
      {
        scopeName: 'test:scope',
        actorId: 'actor-1',
        actionId: 'action-123',
      }
    );
    expect(unifiedScopeResolver.resolve).toHaveBeenCalledWith(
      'test:scope',
      expect.objectContaining({
        actor,
        actorLocation: 'garden',
        actionContext: context,
        trace,
        actionId: 'action-123',
      })
    );
    expect(result.success).toBe(true);
    expect(result.value).toEqual([ActionTargetContext.forEntity('target-1')]);
  });

  it('emits enhanced debug logs for sit_down action success paths', () => {
    const resolvedIds = new Set(['chair-1', 'chair-2']);
    const unifiedScopeResolver = {
      resolve: jest.fn().mockReturnValue(ActionResult.success(resolvedIds)),
    };
    const logger = createLogger();
    const trace = { info: jest.fn(), withSpan: undefined };

    const service = new TargetResolutionService({
      unifiedScopeResolver,
      logger,
    });
    const actor = { id: 'actor-9' };
    const discoveryContext = {
      currentLocation: 'lounge',
      entityManager: { id: 'em-1' },
      extra: 'value',
    };

    const result = service.resolveTargets(
      'positioning:available_furniture',
      actor,
      discoveryContext,
      trace,
      'positioning:sit_down'
    );

    expect(result.success).toBe(true);
    expect(result.value).toEqual([
      ActionTargetContext.forEntity('chair-1'),
      ActionTargetContext.forEntity('chair-2'),
    ]);

    expect(logger.debug).toHaveBeenCalledWith(
      expect.stringContaining('Resolving scope for sit_down'),
      expect.objectContaining({
        scopeName: 'positioning:available_furniture',
        actionId: 'positioning:sit_down',
        actorId: 'actor-9',
        actorLocation: 'lounge',
        hasDiscoveryContext: true,
        discoveryContextKeys: expect.arrayContaining([
          'currentLocation',
          'entityManager',
          'extra',
        ]),
      })
    );

    expect(logger.debug).toHaveBeenCalledWith(
      expect.stringContaining('Context built for UnifiedScopeResolver'),
      expect.objectContaining({
        hasActor: true,
        actorId: 'actor-9',
        actorLocation: 'lounge',
        hasActionContext: true,
        actionContextEntityManager: true,
      })
    );

    expect(logger.debug).toHaveBeenCalledWith(
      expect.stringContaining('UnifiedScopeResolver result for sit_down'),
      expect.objectContaining({
        success: true,
        hasValue: true,
        valueSize: 2,
        entities: ['chair-1', 'chair-2'],
      })
    );

    expect(trace.info).toHaveBeenNthCalledWith(
      1,
      "Delegating scope resolution for 'positioning:available_furniture' to UnifiedScopeResolver.",
      'TargetResolutionService.resolveTargets'
    );
    expect(trace.info).toHaveBeenNthCalledWith(
      2,
      "Scope 'positioning:available_furniture' resolved to 2 target(s).",
      'TargetResolutionService.resolveTargets',
      { targetIds: ['chair-1', 'chair-2'] }
    );
  });

  it('logs resolver failure details for sit_down actions and returns the failure result', () => {
    const failure = ActionResult.failure(new Error('scope failure'));
    const unifiedScopeResolver = {
      resolve: jest.fn().mockReturnValue(failure),
    };
    const logger = createLogger();
    const trace = { info: jest.fn(), withSpan: undefined };

    const service = new TargetResolutionService({
      unifiedScopeResolver,
      logger,
    });
    const actor = { id: 'actor-4' };
    const discoveryContext = { currentLocation: 'hallway', entityManager: {} };

    const result = service.resolveTargets(
      'positioning:available_furniture',
      actor,
      discoveryContext,
      trace,
      'positioning:sit_down'
    );

    expect(result).toBe(failure);

    expect(logger.debug).toHaveBeenCalledWith(
      expect.stringContaining('UnifiedScopeResolver result for sit_down'),
      expect.objectContaining({
        success: false,
        hasValue: false,
        valueSize: 0,
        entities: [],
      })
    );

    expect(trace.info).toHaveBeenCalledTimes(1);
    expect(trace.info).toHaveBeenCalledWith(
      "Delegating scope resolution for 'positioning:available_furniture' to UnifiedScopeResolver.",
      'TargetResolutionService.resolveTargets'
    );
  });

  it('returns no targets array for non-"none" scopes that resolve to an empty set', () => {
    const unifiedScopeResolver = {
      resolve: jest.fn().mockReturnValue(ActionResult.success(new Set())),
    };
    const logger = createLogger();
    const trace = { info: jest.fn(), withSpan: undefined };

    const service = new TargetResolutionService({
      unifiedScopeResolver,
      logger,
    });
    const actor = { id: 'actor-empty' };
    const discoveryContext = { currentLocation: 'stage', entityManager: {} };

    const result = service.resolveTargets(
      'custom:empty_scope',
      actor,
      discoveryContext,
      trace,
      'custom:action'
    );

    expect(result.success).toBe(true);
    expect(result.value).toEqual([]);

    expect(trace.info).toHaveBeenNthCalledWith(
      2,
      "Scope 'custom:empty_scope' resolved to no targets.",
      'TargetResolutionService.resolveTargets'
    );
  });

  it('returns a no-target context for the "none" scope and logs the trace message', () => {
    const unifiedScopeResolver = {
      resolve: jest.fn().mockReturnValue(ActionResult.success(new Set())),
    };
    const logger = createLogger();
    const trace = { info: jest.fn(), withSpan: undefined };

    const service = new TargetResolutionService({
      unifiedScopeResolver,
      logger,
    });
    const actor = { id: 'actor-none' };
    const discoveryContext = { currentLocation: 'void', entityManager: {} };

    const result = service.resolveTargets(
      'none',
      actor,
      discoveryContext,
      trace,
      'custom:none'
    );

    expect(result.success).toBe(true);
    expect(result.value).toEqual([ActionTargetContext.noTarget()]);

    expect(trace.info).toHaveBeenNthCalledWith(
      2,
      "Scope 'none' resolved to no targets - returning noTarget context.",
      'TargetResolutionService.resolveTargets'
    );
  });
});
