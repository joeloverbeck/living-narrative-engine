import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { TargetResolutionService } from '../../../src/actions/targetResolutionService.js';
import { ActionResult } from '../../../src/actions/core/actionResult.js';
import { ActionTargetContext } from '../../../src/models/actionTargetContext.js';
import { InvalidArgumentError } from '../../../src/errors/invalidArgumentError.js';

const createLogger = () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
});

const createService = ({
  resolveImpl = () => ActionResult.success(new Set()),
  logger = createLogger(),
  serviceSetup,
} = {}) => {
  const unifiedScopeResolver = {
    resolve: jest.fn(resolveImpl),
  };

  const service = new TargetResolutionService({
    unifiedScopeResolver,
    logger,
    serviceSetup,
  });

  return { service, unifiedScopeResolver, logger };
};

describe('TargetResolutionService integration', () => {
  let actorEntity;
  let discoveryContext;

  beforeEach(() => {
    actorEntity = { id: 'actor-123' };
    discoveryContext = { currentLocation: 'observation-deck' };
  });

  it('validates that the unified scope resolver exposes a resolve method', () => {
    const logger = createLogger();

    expect(
      () =>
        new TargetResolutionService({
          unifiedScopeResolver: {},
          logger,
        })
    ).toThrow(InvalidArgumentError);
  });

  it('delegates resolution through trace spans and maps results for sit_down debugging', () => {
    const logger = createLogger();
    const serviceSetup = {
      setupService: jest.fn(() => logger),
    };
    const resolvedTargets = new Set(['table-1', 'chair-2']);
    const { service, unifiedScopeResolver } = createService({
      resolveImpl: () => ActionResult.success(resolvedTargets),
      logger,
      serviceSetup,
    });

    const trace = {
      withSpan: jest.fn((name, fn, attrs) => fn()),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    const result = service.resolveTargets(
      'positioning:available_furniture',
      actorEntity,
      discoveryContext,
      trace,
      'positioning:sit_down'
    );

    expect(serviceSetup.setupService).toHaveBeenCalledWith(
      'TargetResolutionService',
      logger,
      expect.objectContaining({
        unifiedScopeResolver: expect.objectContaining({
          value: unifiedScopeResolver,
          requiredMethods: ['resolve'],
        }),
      })
    );

    expect(trace.withSpan).toHaveBeenCalledWith(
      'target.resolve',
      expect.any(Function),
      {
        scopeName: 'positioning:available_furniture',
        actorId: 'actor-123',
        actionId: 'positioning:sit_down',
      }
    );

    expect(unifiedScopeResolver.resolve).toHaveBeenCalledWith(
      'positioning:available_furniture',
      expect.objectContaining({
        actor: actorEntity,
        actorLocation: 'observation-deck',
        actionContext: discoveryContext,
        trace,
        actionId: 'positioning:sit_down',
      })
    );

    expect(logger.info).toHaveBeenCalledTimes(3);
    expect(logger.info).toHaveBeenCalledWith(
      expect.stringContaining('[DEBUG] TargetResolutionService resolving scope for sit_down:'),
      expect.objectContaining({
        scopeName: 'positioning:available_furniture',
        actionId: 'positioning:sit_down',
        actorId: 'actor-123',
      })
    );
    expect(logger.info).toHaveBeenCalledWith(
      expect.stringContaining('[DEBUG] Context built for UnifiedScopeResolver:'),
      expect.objectContaining({
        hasActor: true,
        actorId: 'actor-123',
        actorLocation: 'observation-deck',
      })
    );
    expect(logger.info).toHaveBeenCalledWith(
      expect.stringContaining('[DEBUG] UnifiedScopeResolver result for sit_down:'),
      expect.objectContaining({
        success: true,
        hasValue: true,
        valueSize: 2,
        entities: ['table-1', 'chair-2'],
      })
    );

    expect(trace.info).toHaveBeenCalledWith(
      "Delegating scope resolution for 'positioning:available_furniture' to UnifiedScopeResolver.",
      'TargetResolutionService.resolveTargets'
    );
    expect(trace.info).toHaveBeenCalledWith(
      "Scope 'positioning:available_furniture' resolved to 2 target(s).",
      'TargetResolutionService.resolveTargets',
      { targetIds: ['table-1', 'chair-2'] }
    );

    expect(result.success).toBe(true);
    expect(result.value.map((context) => context.entityId)).toEqual([
      'table-1',
      'chair-2',
    ]);
    result.value.forEach((context) => {
      expect(context).toBeInstanceOf(ActionTargetContext);
      expect(context.type).toBe('entity');
    });
  });

  it('propagates failure results directly from the resolver', () => {
    const error = new Error('scope failed to resolve');
    const { service, unifiedScopeResolver, logger } = createService({
      resolveImpl: () => ActionResult.failure(error),
    });
    const trace = { info: jest.fn(), warn: jest.fn(), error: jest.fn() };

    const result = service.resolveTargets(
      'positioning:available_furniture',
      actorEntity,
      discoveryContext,
      trace,
      'positioning:sit_down'
    );

    expect(unifiedScopeResolver.resolve).toHaveBeenCalledWith(
      'positioning:available_furniture',
      expect.objectContaining({
        actionId: 'positioning:sit_down',
      })
    );
    expect(logger.info).toHaveBeenCalledWith(
      expect.stringContaining('[DEBUG] UnifiedScopeResolver result for sit_down:'),
      expect.objectContaining({
        success: false,
        hasValue: false,
        valueSize: 0,
        entities: [],
      })
    );
    expect(trace.info).toHaveBeenCalledWith(
      "Delegating scope resolution for 'positioning:available_furniture' to UnifiedScopeResolver.",
      'TargetResolutionService.resolveTargets'
    );
    expect(result.success).toBe(false);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].message).toContain('scope failed to resolve');
  });

  it('supports resolving without trace or action identifiers', () => {
    const { service, unifiedScopeResolver } = createService({
      resolveImpl: () => ActionResult.success(new Set(['solo-target'])),
    });

    const result = service.resolveTargets(
      'core:solo',
      actorEntity,
      discoveryContext
    );

    expect(unifiedScopeResolver.resolve).toHaveBeenCalledWith(
      'core:solo',
      expect.objectContaining({
        trace: null,
        actionId: null,
      })
    );
    expect(result.success).toBe(true);
    expect(result.value.map((context) => context.entityId)).toEqual([
      'solo-target',
    ]);
  });

  it("returns a noTarget context when the 'none' scope resolves to an empty set", () => {
    const { service } = createService({
      resolveImpl: () => ActionResult.success(new Set()),
    });
    const trace = { info: jest.fn(), warn: jest.fn(), error: jest.fn() };

    const result = service.resolveTargets(
      'none',
      actorEntity,
      discoveryContext,
      trace
    );

    expect(result.success).toBe(true);
    expect(result.value).toEqual([ActionTargetContext.noTarget()]);
    expect(trace.info).toHaveBeenCalledWith(
      "Scope 'none' resolved to no targets - returning noTarget context.",
      'TargetResolutionService.resolveTargets'
    );
  });

  it('returns an empty array when other scopes resolve to an empty set', () => {
    const { service } = createService({
      resolveImpl: () => ActionResult.success(new Set()),
    });
    const trace = { info: jest.fn(), warn: jest.fn(), error: jest.fn() };

    const result = service.resolveTargets(
      'environment:unoccupied',
      actorEntity,
      discoveryContext,
      trace
    );

    expect(result.success).toBe(true);
    expect(result.value).toEqual([]);
    expect(trace.info).toHaveBeenCalledWith(
      "Scope 'environment:unoccupied' resolved to no targets.",
      'TargetResolutionService.resolveTargets'
    );
  });
});
