import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { TargetResolutionService } from '../../../src/actions/targetResolutionService.js';
import { ActionResult } from '../../../src/actions/core/actionResult.js';

jest.mock('../../../src/utils/dependencyUtils.js', () => ({
  validateDependency: jest.fn(),
  validateDependencies: jest.fn(),
}));

import { validateDependency } from '../../../src/utils/dependencyUtils.js';

const createLogger = () => ({
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
});

const createService = ({
  unifiedScopeResolver = { resolve: jest.fn() },
  logger = createLogger(),
  serviceSetup,
} = {}) => {
  const service = new TargetResolutionService({
    unifiedScopeResolver,
    logger,
    serviceSetup,
  });

  return { service, unifiedScopeResolver, logger, serviceSetup };
};

describe('TargetResolutionService integration coverage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('resolves targets within a trace span and logs detailed diagnostics for sit down actions', () => {
    const logger = createLogger();
    const unifiedScopeResolver = {
      resolve: jest
        .fn()
        .mockReturnValue(ActionResult.success(new Set(['chair-1', 'chair-2']))),
    };
    const serviceSetup = {
      setupService: jest.fn(() => logger),
    };

    const trace = {
      withSpan: jest.fn((name, fn) => fn()),
      info: jest.fn(),
    };

    const { service } = createService({
      unifiedScopeResolver,
      logger,
      serviceSetup,
    });

    const actor = { id: 'actor-1' };
    const discoveryContext = {
      currentLocation: 'great-hall',
      mood: 'focused',
    };

    const result = service.resolveTargets(
      'positioning:available_furniture',
      actor,
      discoveryContext,
      trace,
      'positioning:sit_down'
    );

    expect(trace.withSpan).toHaveBeenCalledWith(
      'target.resolve',
      expect.any(Function),
      expect.objectContaining({
        scopeName: 'positioning:available_furniture',
        actorId: 'actor-1',
        actionId: 'positioning:sit_down',
      })
    );

    expect(unifiedScopeResolver.resolve).toHaveBeenCalledWith(
      'positioning:available_furniture',
      expect.objectContaining({
        actor,
        actorLocation: 'great-hall',
        actionContext: discoveryContext,
        trace,
        actionId: 'positioning:sit_down',
      })
    );

    expect(result.success).toBe(true);
    expect(result.value.map((context) => context.entityId)).toEqual([
      'chair-1',
      'chair-2',
    ]);
    expect(result.value.every((context) => context.type === 'entity')).toBe(
      true
    );

    expect(validateDependency).toHaveBeenCalledTimes(1);
    expect(validateDependency).toHaveBeenCalledWith(
      unifiedScopeResolver,
      'UnifiedScopeResolver',
      undefined,
      { requiredMethods: ['resolve'] }
    );

    expect(serviceSetup.setupService).toHaveBeenCalledWith(
      'TargetResolutionService',
      logger,
      {
        unifiedScopeResolver: {
          value: unifiedScopeResolver,
          requiredMethods: ['resolve'],
        },
      }
    );

    expect(logger.debug).toHaveBeenCalledWith(
      expect.stringContaining('Resolving scope for sit_down'),
      expect.objectContaining({
        scopeName: 'positioning:available_furniture',
        actionId: 'positioning:sit_down',
        actorId: 'actor-1',
      })
    );

    expect(logger.debug).toHaveBeenCalledWith(
      expect.stringContaining('Context built for UnifiedScopeResolver'),
      expect.objectContaining({
        hasActor: true,
        actorId: 'actor-1',
        actorLocation: 'great-hall',
        hasActionContext: true,
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

    expect(trace.info).toHaveBeenCalledWith(
      "Delegating scope resolution for 'positioning:available_furniture' to UnifiedScopeResolver.",
      'TargetResolutionService.resolveTargets'
    );

    expect(trace.info).toHaveBeenCalledWith(
      "Scope 'positioning:available_furniture' resolved to 2 target(s).",
      'TargetResolutionService.resolveTargets',
      { targetIds: ['chair-1', 'chair-2'] }
    );
  });

  it('returns failures from the unified scope resolver unchanged', () => {
    const logger = createLogger();
    const failure = ActionResult.failure(new Error('resolution failed'));
    const unifiedScopeResolver = {
      resolve: jest.fn(() => failure),
    };

    const { service } = createService({ unifiedScopeResolver, logger });

    const trace = { info: jest.fn() };
    const actor = { id: 'actor-2' };
    const discoveryContext = { currentLocation: 'library' };

    const result = service.resolveTargets(
      'knowledge:scholars',
      actor,
      discoveryContext,
      trace,
      'knowledge:research'
    );

    expect(result).toBe(failure);
    expect(trace.info).toHaveBeenCalledWith(
      "Delegating scope resolution for 'knowledge:scholars' to UnifiedScopeResolver.",
      'TargetResolutionService.resolveTargets'
    );
    expect(logger.info).not.toHaveBeenCalled();
  });

  it("returns a noTarget context when the 'none' scope resolves to an empty set", () => {
    const logger = createLogger();
    const unifiedScopeResolver = {
      resolve: jest.fn(() => ActionResult.success(new Set())),
    };

    const { service } = createService({ unifiedScopeResolver, logger });

    const trace = { info: jest.fn() };
    const result = service.resolveTargets(
      'none',
      { id: 'actor-3' },
      { currentLocation: 'void' },
      trace,
      'core:noop'
    );

    expect(result.success).toBe(true);
    expect(result.value).toHaveLength(1);
    expect(result.value[0].type).toBe('none');
    expect(result.value[0].entityId).toBeNull();

    expect(trace.info).toHaveBeenCalledWith(
      "Scope 'none' resolved to no targets - returning noTarget context.",
      'TargetResolutionService.resolveTargets'
    );
  });

  it('returns an empty target list when other scopes resolve to an empty set', () => {
    const logger = createLogger();
    const unifiedScopeResolver = {
      resolve: jest.fn(() => ActionResult.success(new Set())),
    };

    const { service } = createService({ unifiedScopeResolver, logger });

    const trace = { info: jest.fn() };
    const result = service.resolveTargets(
      'inventory:equipped-items',
      { id: 'actor-4' },
      { currentLocation: 'armory' },
      trace,
      'inventory:list'
    );

    expect(result.success).toBe(true);
    expect(result.value).toEqual([]);
    expect(trace.info).toHaveBeenCalledWith(
      "Scope 'inventory:equipped-items' resolved to no targets.",
      'TargetResolutionService.resolveTargets'
    );
  });
});
