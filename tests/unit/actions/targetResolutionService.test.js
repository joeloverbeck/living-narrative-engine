import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';

import { TargetResolutionService } from '../../../src/actions/targetResolutionService.js';
import { ActionTargetContext } from '../../../src/models/actionTargetContext.js';
import { ActionResult } from '../../../src/actions/core/actionResult.js';
import { ServiceSetup } from '../../../src/utils/serviceInitializerUtils.js';
import * as dependencyUtils from '../../../src/utils/dependencyUtils.js';

describe('TargetResolutionService', () => {
  let baseLogger;
  let unifiedScopeResolver;

  const createSuccessfulResult = (set) => ({
    success: true,
    value: set,
    map: jest.fn((mapper) => ActionResult.success(mapper(set))),
  });

  beforeEach(() => {
    baseLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };
    unifiedScopeResolver = {
      resolve: jest.fn(),
    };
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('validates dependencies and uses provided service setup for logging', () => {
    const validateSpy = jest.spyOn(dependencyUtils, 'validateDependency');
    const wrappedLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };
    const serviceSetup = {
      setupService: jest.fn().mockReturnValue(wrappedLogger),
    };
    const resultSet = new Set(['entity-42']);
    const successfulResult = createSuccessfulResult(resultSet);
    unifiedScopeResolver.resolve.mockReturnValue(successfulResult);

    const trace = { info: jest.fn() };
    const actor = { id: 'actor-1' };
    const discoveryContext = { currentLocation: 'cabin', entityManager: {} };

    const service = new TargetResolutionService({
      unifiedScopeResolver,
      logger: baseLogger,
      serviceSetup,
    });

    expect(validateSpy).toHaveBeenCalledWith(
      unifiedScopeResolver,
      'UnifiedScopeResolver',
      undefined,
      { requiredMethods: ['resolve'] }
    );
    expect(serviceSetup.setupService).toHaveBeenCalledWith(
      'TargetResolutionService',
      baseLogger,
      {
        unifiedScopeResolver: {
          value: unifiedScopeResolver,
          requiredMethods: ['resolve'],
        },
      }
    );

    const result = service.resolveTargets(
      'positioning:available_furniture',
      actor,
      discoveryContext,
      trace,
      'positioning:sit_down'
    );

    expect(unifiedScopeResolver.resolve).toHaveBeenCalledWith(
      'positioning:available_furniture',
      {
        actor,
        actorLocation: discoveryContext.currentLocation,
        actionContext: discoveryContext,
        trace,
        actionId: 'positioning:sit_down',
      }
    );

    expect(successfulResult.map).toHaveBeenCalledTimes(1);
    expect(result.success).toBe(true);
    expect(result.value).toEqual([
      expect.objectContaining({ type: 'entity', entityId: 'entity-42' }),
    ]);

    expect(wrappedLogger.debug).toHaveBeenCalledWith(
      'Resolving scope for sit_down',
      expect.objectContaining({
        scopeName: 'positioning:available_furniture',
        actionId: 'positioning:sit_down',
        actorId: 'actor-1',
      })
    );
    expect(wrappedLogger.debug).toHaveBeenCalledWith(
      'Context built for UnifiedScopeResolver',
      expect.objectContaining({
        hasActor: true,
        actorLocation: 'cabin',
        hasActionContext: true,
        actionContextEntityManager: true,
      })
    );
    expect(wrappedLogger.debug).toHaveBeenCalledWith(
      'UnifiedScopeResolver result for sit_down',
      expect.objectContaining({
        success: true,
        hasValue: true,
        valueSize: 1,
        entities: ['entity-42'],
      })
    );

    expect(trace.info).toHaveBeenCalledWith(
      "Delegating scope resolution for 'positioning:available_furniture' to UnifiedScopeResolver.",
      'TargetResolutionService.resolveTargets'
    );
    expect(trace.info).toHaveBeenCalledWith(
      "Scope 'positioning:available_furniture' resolved to 1 target(s).",
      'TargetResolutionService.resolveTargets',
      { targetIds: ['entity-42'] }
    );
  });

  it('wraps resolution in a trace span when trace.withSpan is available', () => {
    const setupSpy = jest
      .spyOn(ServiceSetup.prototype, 'setupService')
      .mockImplementation(function (name, logger) {
        return logger;
      });
    const service = new TargetResolutionService({
      unifiedScopeResolver,
      logger: baseLogger,
    });

    const resultSet = new Set(['entity-7']);
    const successfulResult = createSuccessfulResult(resultSet);
    unifiedScopeResolver.resolve.mockReturnValue(successfulResult);

    const trace = {
      withSpan: jest.fn((spanName, fn, metadata) => {
        expect(spanName).toBe('target.resolve');
        expect(metadata).toEqual({
          scopeName: 'test-scope',
          actorId: 'actor-7',
          actionId: 'test-action',
        });
        return fn();
      }),
      info: jest.fn(),
    };

    const actor = { id: 'actor-7' };
    const discoveryContext = { currentLocation: 'bridge' };

    const result = service.resolveTargets(
      'test-scope',
      actor,
      discoveryContext,
      trace,
      'test-action'
    );

    expect(trace.withSpan).toHaveBeenCalledTimes(1);
    expect(unifiedScopeResolver.resolve).toHaveBeenCalledWith('test-scope', {
      actor,
      actorLocation: discoveryContext.currentLocation,
      actionContext: discoveryContext,
      trace,
      actionId: 'test-action',
    });
    expect(result.value).toEqual([
      expect.objectContaining({ type: 'entity', entityId: 'entity-7' }),
    ]);
    setupSpy.mockRestore();
  });

  it('returns failure results without transformation', () => {
    const failureResult = {
      success: false,
      errors: ['boom'],
      map: jest.fn(),
    };
    unifiedScopeResolver.resolve.mockReturnValue(failureResult);

    const service = new TargetResolutionService({
      unifiedScopeResolver,
      logger: baseLogger,
    });

    const actor = { id: 'actor-9' };
    const discoveryContext = { currentLocation: 'deck' };

    const result = service.resolveTargets(
      'other-scope',
      actor,
      discoveryContext
    );

    expect(result).toBe(failureResult);
    expect(failureResult.map).not.toHaveBeenCalled();
  });

  it("returns ActionTargetContext.noTarget() when 'none' scope resolves to empty set", () => {
    const emptySet = new Set();
    const successfulResult = createSuccessfulResult(emptySet);
    unifiedScopeResolver.resolve.mockReturnValue(successfulResult);

    const trace = { info: jest.fn() };
    const service = new TargetResolutionService({
      unifiedScopeResolver,
      logger: baseLogger,
    });

    const actor = { id: 'actor-11' };
    const discoveryContext = { currentLocation: 'atrium' };

    const result = service.resolveTargets(
      'none',
      actor,
      discoveryContext,
      trace
    );

    expect(successfulResult.map).toHaveBeenCalledTimes(1);
    expect(result.value).toEqual([ActionTargetContext.noTarget()]);
    expect(trace.info).toHaveBeenCalledWith(
      "Scope 'none' resolved to no targets - returning noTarget context.",
      'TargetResolutionService.resolveTargets'
    );
  });

  it('returns empty array when non-none scope resolves to empty set', () => {
    const emptySet = new Set();
    const successfulResult = createSuccessfulResult(emptySet);
    unifiedScopeResolver.resolve.mockReturnValue(successfulResult);

    const trace = { info: jest.fn() };
    const service = new TargetResolutionService({
      unifiedScopeResolver,
      logger: baseLogger,
    });

    const actor = { id: 'actor-12' };
    const discoveryContext = { currentLocation: 'observatory' };

    const result = service.resolveTargets(
      'empty-scope',
      actor,
      discoveryContext,
      trace
    );

    expect(successfulResult.map).toHaveBeenCalledTimes(1);
    expect(result.value).toEqual([]);
    expect(trace.info).toHaveBeenCalledWith(
      "Scope 'empty-scope' resolved to no targets.",
      'TargetResolutionService.resolveTargets'
    );
  });

  it('logs null discovery context metadata when context is unavailable for sit_down debug flow', () => {
    const serviceSetup = {
      setupService: jest.fn().mockReturnValue(baseLogger),
    };
    const service = new TargetResolutionService({
      unifiedScopeResolver,
      logger: baseLogger,
      serviceSetup,
    });

    baseLogger.debug.mockImplementationOnce(() => {
      throw new Error('halt after initial debug');
    });

    const actor = { id: 'actor-13' };

    expect(() =>
      service.resolveTargets(
        'positioning:available_furniture',
        actor,
        null,
        null,
        'positioning:sit_down'
      )
    ).toThrow('halt after initial debug');

    expect(unifiedScopeResolver.resolve).not.toHaveBeenCalled();

    const [message, details] = baseLogger.debug.mock.calls[0];
    expect(message).toBe('Resolving scope for sit_down');
    expect(details).toMatchObject({
      scopeName: 'positioning:available_furniture',
      actionId: 'positioning:sit_down',
      actorId: 'actor-13',
      hasDiscoveryContext: false,
      discoveryContextKeys: null,
    });
  });

  it('falls back to empty metrics when resolver omits value during sit_down debug flow', () => {
    const serviceSetup = {
      setupService: jest.fn().mockReturnValue(baseLogger),
    };
    const resolverResult = {
      success: true,
      value: null,
      map: jest.fn(),
    };
    unifiedScopeResolver.resolve.mockReturnValue(resolverResult);

    const service = new TargetResolutionService({
      unifiedScopeResolver,
      logger: baseLogger,
      serviceSetup,
    });

    const actor = { id: 'actor-21' };
    const discoveryContext = { currentLocation: 'lounge', entityManager: {} };

    baseLogger.debug
      .mockImplementationOnce(() => {})
      .mockImplementationOnce(() => {})
      .mockImplementationOnce(() => {
        throw new Error('halt after result debug');
      });

    expect(() =>
      service.resolveTargets(
        'positioning:available_furniture',
        actor,
        discoveryContext,
        null,
        'positioning:sit_down'
      )
    ).toThrow('halt after result debug');

    expect(unifiedScopeResolver.resolve).toHaveBeenCalledWith(
      'positioning:available_furniture',
      expect.objectContaining({
        actor,
        actionContext: discoveryContext,
      })
    );

    const [, resultDetails] = baseLogger.debug.mock.calls[2];
    expect(baseLogger.debug.mock.calls[2][0]).toBe(
      'UnifiedScopeResolver result for sit_down'
    );
    expect(resultDetails).toMatchObject({
      success: true,
      hasValue: false,
      valueSize: 0,
      entities: [],
    });
    expect(resolverResult.map).not.toHaveBeenCalled();
  });
});
