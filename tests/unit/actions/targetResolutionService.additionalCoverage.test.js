import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { TargetResolutionService } from '../../../src/actions/targetResolutionService.js';
import { ActionResult } from '../../../src/actions/core/actionResult.js';
import { ActionTargetContext } from '../../../src/models/actionTargetContext.js';
import { ServiceSetup } from '../../../src/utils/serviceInitializerUtils.js';

/** @type {ReturnType<typeof createLogger>} */
let logger;
/** @type {{ resolve: jest.Mock }} */
let unifiedScopeResolver;
/** @type {{ setupService: jest.Mock }} */
let serviceSetup;

function createLogger() {
  return {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };
}

function createService() {
  return new TargetResolutionService({
    unifiedScopeResolver,
    logger,
    serviceSetup,
  });
}

describe('TargetResolutionService additional coverage', () => {
  beforeEach(() => {
    logger = createLogger();
    unifiedScopeResolver = {
      resolve: jest.fn(),
    };
    serviceSetup = {
      setupService: jest.fn(() => logger),
    };
  });

  it('wraps resolution in a trace span and logs sit_down diagnostics', () => {
    const actor = { id: 'actor-1' };
    const discoveryContext = {
      currentLocation: 'dining-room',
      entityManager: { id: 'entity-mgr' },
    };
    const scopeName = 'positioning:available_furniture';
    const actionId = 'positioning:sit_down';

    const resolvedIds = new Set(['chair-1', 'chair-2']);
    unifiedScopeResolver.resolve.mockReturnValue(
      ActionResult.success(resolvedIds)
    );

    const trace = {
      info: jest.fn(),
      withSpan: jest.fn((name, fn, meta) => {
        expect(name).toBe('target.resolve');
        expect(meta).toEqual({
          scopeName,
          actorId: actor.id,
          actionId,
        });
        return fn();
      }),
    };

    const service = createService();

    const result = service.resolveTargets(
      scopeName,
      actor,
      discoveryContext,
      trace,
      actionId
    );

    expect(trace.withSpan).toHaveBeenCalledTimes(1);
    expect(unifiedScopeResolver.resolve).toHaveBeenCalledWith(scopeName, {
      actor,
      actorLocation: discoveryContext.currentLocation,
      actionContext: discoveryContext,
      trace,
      actionId,
    });

    expect(logger.debug).toHaveBeenCalledWith('Resolving scope for sit_down', {
      scopeName,
      actionId,
      actorId: actor.id,
      actorLocation: discoveryContext.currentLocation,
      hasDiscoveryContext: true,
      discoveryContextKeys: Object.keys(discoveryContext),
    });

    expect(logger.debug).toHaveBeenCalledWith(
      'Context built for UnifiedScopeResolver',
      {
        hasActor: true,
        actorId: actor.id,
        actorLocation: discoveryContext.currentLocation,
        hasActionContext: true,
        actionContextEntityManager: true,
      }
    );

    expect(logger.debug).toHaveBeenCalledWith(
      'UnifiedScopeResolver result for sit_down',
      {
        success: true,
        hasValue: true,
        valueSize: resolvedIds.size,
        entities: Array.from(resolvedIds),
      }
    );

    expect(trace.info).toHaveBeenCalledWith(
      "Delegating scope resolution for 'positioning:available_furniture' to UnifiedScopeResolver.",
      'TargetResolutionService.resolveTargets'
    );

    expect(trace.info).toHaveBeenCalledWith(
      "Scope 'positioning:available_furniture' resolved to 2 target(s).",
      'TargetResolutionService.resolveTargets',
      { targetIds: ['chair-1', 'chair-2'] }
    );

    expect(result.success).toBe(true);
    expect(result.value.map((ctx) => ctx.entityId)).toEqual([
      'chair-1',
      'chair-2',
    ]);
    result.value.forEach((ctx) =>
      expect(ctx).toBeInstanceOf(ActionTargetContext)
    );
  });

  it('returns failure results unchanged when scope resolution fails', () => {
    const failure = ActionResult.failure(new Error('scope failure'));
    unifiedScopeResolver.resolve.mockReturnValue(failure);

    const trace = { info: jest.fn() };
    const service = createService();

    const result = service.resolveTargets(
      'core:test',
      { id: 'actor-2' },
      { currentLocation: 'nowhere' },
      trace,
      'core:test'
    );

    expect(trace.info).toHaveBeenCalledWith(
      "Delegating scope resolution for 'core:test' to UnifiedScopeResolver.",
      'TargetResolutionService.resolveTargets'
    );

    expect(result).toBe(failure);
  });

  it('logs failure diagnostics for sit_down scopes before returning failure', () => {
    const failure = ActionResult.failure(new Error('resolver blew up'));
    unifiedScopeResolver.resolve.mockReturnValue(failure);

    const trace = {
      info: jest.fn(),
      withSpan: jest.fn((_, fn) => fn()),
    };

    const service = createService();

    const result = service.resolveTargets(
      'positioning:available_furniture',
      { id: 'actor-3' },
      { currentLocation: 'hall', entityManager: { id: 'mgr' } },
      trace,
      'positioning:sit_down'
    );

    expect(logger.debug).toHaveBeenCalledWith(
      'UnifiedScopeResolver result for sit_down',
      {
        success: false,
        hasValue: false,
        valueSize: 0,
        entities: [],
      }
    );
    expect(result).toBe(failure);
  });

  it("maps empty 'none' scope results to noTarget context", () => {
    unifiedScopeResolver.resolve.mockReturnValue(ActionResult.success(new Set()));

    const trace = { info: jest.fn() };
    const service = createService();

    const result = service.resolveTargets(
      'none',
      { id: 'actor-3' },
      { currentLocation: 'room' },
      trace,
      'action'
    );

    expect(trace.info).toHaveBeenCalledWith(
      "Scope 'none' resolved to no targets - returning noTarget context.",
      'TargetResolutionService.resolveTargets'
    );

    expect(result.success).toBe(true);
    expect(result.value).toHaveLength(1);
    expect(result.value[0]).toBeInstanceOf(ActionTargetContext);
    expect(result.value[0].type).toBe('none');
  });

  it('returns empty array when non-none scope resolves to empty set', () => {
    unifiedScopeResolver.resolve.mockReturnValue(ActionResult.success(new Set()));

    const trace = { info: jest.fn() };
    const service = createService();

    const result = service.resolveTargets(
      'environment:desks',
      { id: 'actor-4' },
      { currentLocation: 'office' },
      trace,
      'action'
    );

    expect(trace.info).toHaveBeenCalledWith(
      "Scope 'environment:desks' resolved to no targets.",
      'TargetResolutionService.resolveTargets'
    );

    expect(result.success).toBe(true);
    expect(result.value).toEqual([]);
  });

  it('creates ServiceSetup internally when none is provided', () => {
    const setupSpy = jest
      .spyOn(ServiceSetup.prototype, 'setupService')
      .mockImplementation(function (serviceName, providedLogger) {
        expect(serviceName).toBe('TargetResolutionService');
        expect(providedLogger).toBe(logger);
        return providedLogger;
      });

    try {
      const service = new TargetResolutionService({
        unifiedScopeResolver,
        logger,
      });

      unifiedScopeResolver.resolve.mockReturnValue(
        ActionResult.success(new Set(['entity-1']))
      );

      const result = service.resolveTargets(
        'core:auto',
        { id: 'actor-5' },
        { currentLocation: 'lab', entityManager: {} }
      );

      expect(setupSpy).toHaveBeenCalled();
      expect(result.success).toBe(true);
    } finally {
      setupSpy.mockRestore();
    }
  });

  it('handles missing discovery context by surfacing the underlying error', () => {
    unifiedScopeResolver.resolve.mockReturnValue(
      ActionResult.success(new Set(['entity-2']))
    );

    const trace = {
      info: jest.fn(),
      withSpan: jest.fn((_, fn) => fn()),
    };

    const service = createService();

    expect(() =>
      service.resolveTargets(
        'positioning:available_furniture',
        { id: 'actor-6' },
        null,
        trace,
        'positioning:sit_down'
      )
    ).toThrow();
  });

  it('supports resolving without providing trace or action identifiers', () => {
    unifiedScopeResolver.resolve.mockReturnValue(
      ActionResult.success(new Set(['entity-3']))
    );

    const service = createService();

    const result = service.resolveTargets(
      'core:default',
      { id: 'actor-7' },
      { currentLocation: 'atrium', entityManager: {} }
    );

    expect(result.success).toBe(true);
    expect(result.value.map((ctx) => ctx.entityId)).toEqual(['entity-3']);
  });
});
