import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { TargetResolutionService } from '../../../src/actions/targetResolutionService.js';
import { ActionTargetContext } from '../../../src/models/actionTargetContext.js';
import { ActionResult } from '../../../src/actions/core/actionResult.js';
import { ServiceSetup } from '../../../src/utils/serviceInitializerUtils.js';
import { validateDependency } from '../../../src/utils/dependencyUtils.js';

jest.mock('../../../src/utils/dependencyUtils.js', () => ({
  validateDependency: jest.fn(),
}));

describe('TargetResolutionService tracing and empty result handling', () => {
  let mockResolver;
  let baseLogger;
  let prefixedLogger;
  let serviceSetup;

  beforeEach(() => {
    jest.clearAllMocks();

    mockResolver = { resolve: jest.fn() };
    baseLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };
    prefixedLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };
    serviceSetup = {
      setupService: jest.fn().mockReturnValue(prefixedLogger),
    };
  });

  /**
   *
   * @param root0
   * @param root0.useDefaultSetup
   */
  function createService({ useDefaultSetup = false } = {}) {
    const deps = {
      unifiedScopeResolver: mockResolver,
      logger: baseLogger,
    };

    if (!useDefaultSetup) {
      deps.serviceSetup = serviceSetup;
    }

    return new TargetResolutionService(deps);
  }

  it('validates dependencies and configures the service logger during construction', () => {
    createService();

    expect(validateDependency).toHaveBeenCalledWith(
      mockResolver,
      'UnifiedScopeResolver',
      undefined,
      { requiredMethods: ['resolve'] },
    );

    expect(serviceSetup.setupService).toHaveBeenCalledWith(
      'TargetResolutionService',
      baseLogger,
      expect.objectContaining({
        unifiedScopeResolver: expect.objectContaining({
          value: mockResolver,
          requiredMethods: ['resolve'],
        }),
      }),
    );
  });

  it('wraps scope resolution in a tracing span and maps resolved ids to entity contexts', () => {
    const ids = new Set(['chair-1', 'chair-2']);
    mockResolver.resolve.mockReturnValue(ActionResult.success(ids));
    const service = createService();

    const trace = {
      info: jest.fn(),
      withSpan: jest.fn((spanName, operation, attributes) => {
        expect(spanName).toBe('target.resolve');
        expect(attributes).toEqual({
          scopeName: 'positioning:available_furniture',
          actorId: 'actor-1',
          actionId: 'positioning:sit_down',
        });
        return operation();
      }),
    };
    const actor = { id: 'actor-1' };
    const discoveryContext = { currentLocation: 'atrium' };

    const result = service.resolveTargets(
      'positioning:available_furniture',
      actor,
      discoveryContext,
      trace,
      'positioning:sit_down',
    );

    expect(mockResolver.resolve).toHaveBeenCalledWith(
      'positioning:available_furniture',
      {
        actor,
        actorLocation: 'atrium',
        actionContext: discoveryContext,
        trace,
        actionId: 'positioning:sit_down',
      },
    );

    expect(trace.withSpan).toHaveBeenCalledTimes(1);
    expect(trace.info).toHaveBeenNthCalledWith(
      1,
      "Delegating scope resolution for 'positioning:available_furniture' to UnifiedScopeResolver.",
      'TargetResolutionService.resolveTargets',
    );
    expect(trace.info).toHaveBeenNthCalledWith(
      2,
      "Scope 'positioning:available_furniture' resolved to 2 target(s).",
      'TargetResolutionService.resolveTargets',
      { targetIds: ['chair-1', 'chair-2'] },
    );

    expect(prefixedLogger.debug).toHaveBeenNthCalledWith(
      1,
      'Resolving scope for sit_down',
      expect.objectContaining({
        scopeName: 'positioning:available_furniture',
        actionId: 'positioning:sit_down',
        actorId: 'actor-1',
      }),
    );
    expect(prefixedLogger.debug).toHaveBeenNthCalledWith(
      2,
      'Context built for UnifiedScopeResolver',
      expect.objectContaining({
        hasActor: true,
        actorId: 'actor-1',
        actorLocation: 'atrium',
      }),
    );
    expect(prefixedLogger.debug).toHaveBeenNthCalledWith(
      3,
      'UnifiedScopeResolver result for sit_down',
      expect.objectContaining({
        success: true,
        hasValue: true,
        valueSize: 2,
        entities: ['chair-1', 'chair-2'],
      }),
    );

    expect(result.success).toBe(true);
    expect(result.value).toEqual([
      ActionTargetContext.forEntity('chair-1'),
      ActionTargetContext.forEntity('chair-2'),
    ]);
  });

  it('returns failed results unchanged when unified scope resolution fails', () => {
    const failure = ActionResult.failure(new Error('resolution failed'));
    mockResolver.resolve.mockReturnValue(failure);
    const service = createService();
    const trace = { info: jest.fn() };

    const result = service.resolveTargets(
      'story:missing_scope',
      { id: 'actor-2' },
      { currentLocation: 'void' },
      trace,
      'action-2',
    );

    expect(result).toBe(failure);
    expect(trace.info).toHaveBeenCalledTimes(1);
    expect(trace.info).toHaveBeenCalledWith(
      "Delegating scope resolution for 'story:missing_scope' to UnifiedScopeResolver.",
      'TargetResolutionService.resolveTargets',
    );
    expect(prefixedLogger.debug).not.toHaveBeenCalled();
  });

  it('logs detailed debug information for sit_down failures without resolver values', () => {
    const failure = ActionResult.failure(new Error('resolver failed'));
    mockResolver.resolve.mockReturnValue(failure);
    const service = createService();
    const trace = { info: jest.fn() };

    const result = service.resolveTargets(
      'positioning:available_furniture',
      { id: 'actor-5' },
      { currentLocation: 'lobby' },
      trace,
      'positioning:sit_down',
    );

    expect(result).toBe(failure);
    expect(prefixedLogger.debug).toHaveBeenNthCalledWith(
      3,
      'UnifiedScopeResolver result for sit_down',
      expect.objectContaining({
        success: false,
        hasValue: false,
        valueSize: 0,
        entities: [],
      }),
    );
  });

  it("returns a noTarget context when the 'none' scope resolves to an empty set", () => {
    mockResolver.resolve.mockReturnValue(ActionResult.success(new Set()));
    const service = createService();
    const trace = { info: jest.fn() };

    const result = service.resolveTargets(
      'none',
      { id: 'actor-3' },
      { currentLocation: 'hall' },
      trace,
      'action-3',
    );

    expect(result.success).toBe(true);
    expect(result.value).toEqual([ActionTargetContext.noTarget()]);
    expect(trace.info).toHaveBeenNthCalledWith(
      2,
      "Scope 'none' resolved to no targets - returning noTarget context.",
      'TargetResolutionService.resolveTargets',
    );
  });

  it('returns an empty target list for other scopes that resolve to no entities', () => {
    mockResolver.resolve.mockReturnValue(ActionResult.success(new Set()));
    const service = createService();
    const trace = { info: jest.fn() };

    const result = service.resolveTargets(
      'exploration:empty',
      { id: 'actor-4' },
      { currentLocation: 'cavern' },
      trace,
      'action-4',
    );

    expect(result.success).toBe(true);
    expect(result.value).toEqual([]);
    expect(trace.info).toHaveBeenNthCalledWith(
      2,
      "Scope 'exploration:empty' resolved to no targets.",
      'TargetResolutionService.resolveTargets',
    );
  });

  it('uses the default ServiceSetup implementation when no helper is provided', () => {
    const setupSpy = jest
      .spyOn(ServiceSetup.prototype, 'setupService')
      .mockReturnValue(prefixedLogger);

    const service = createService({ useDefaultSetup: true });
    mockResolver.resolve.mockReturnValue(ActionResult.success(new Set(['solo-target'])));

    const result = service.resolveTargets(
      'exploration:solo',
      { id: 'actor-6' },
      { currentLocation: 'arena' },
    );

    expect(result.success).toBe(true);
    expect(result.value).toEqual([ActionTargetContext.forEntity('solo-target')]);
    expect(setupSpy).toHaveBeenCalledWith(
      'TargetResolutionService',
      baseLogger,
      expect.objectContaining({
        unifiedScopeResolver: expect.objectContaining({ value: mockResolver }),
      }),
    );

    setupSpy.mockRestore();
  });
});
