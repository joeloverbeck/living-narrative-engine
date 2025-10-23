/**
 * @file Additional unit tests for TargetResolutionService focusing on sit_down tracing instrumentation.
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { TargetResolutionService } from '../../../src/actions/targetResolutionService.js';
import { ActionResult } from '../../../src/actions/core/actionResult.js';

/** @typedef {import('../../../src/interfaces/coreServices.js').ILogger} ILogger */

describe('TargetResolutionService sit_down instrumentation', () => {
  /** @type {jest.Mocked<ILogger>} */
  let logger;
  let unifiedScopeResolver;
  let service;
  let actorEntity;
  let discoveryContext;

  beforeEach(() => {
    logger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    unifiedScopeResolver = {
      resolve: jest.fn(),
    };

    service = new TargetResolutionService({
      unifiedScopeResolver,
      logger,
    });

    actorEntity = { id: 'actor-42' };
    discoveryContext = {
      currentLocation: 'reading-nook',
      entityManager: { find: jest.fn() },
    };
  });

  it('wraps resolution in a trace span and logs the sit_down result metrics', () => {
    const trace = {
      withSpan: jest.fn((name, callback, metadata) => callback(metadata)),
      info: jest.fn(),
    };

    unifiedScopeResolver.resolve.mockReturnValue(
      ActionResult.success(new Set(['chair-1', 'chair-2']))
    );

    const result = service.resolveTargets(
      'positioning:available_furniture',
      actorEntity,
      discoveryContext,
      trace,
      'positioning:sit_down'
    );

    expect(trace.withSpan).toHaveBeenCalledTimes(1);
    expect(trace.withSpan).toHaveBeenCalledWith(
      'target.resolve',
      expect.any(Function),
      {
        scopeName: 'positioning:available_furniture',
        actorId: 'actor-42',
        actionId: 'positioning:sit_down',
      }
    );

    expect(unifiedScopeResolver.resolve).toHaveBeenCalledWith(
      'positioning:available_furniture',
      expect.objectContaining({
        actor: actorEntity,
        actorLocation: 'reading-nook',
        actionContext: discoveryContext,
        actionId: 'positioning:sit_down',
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

    expect(result.success).toBe(true);
    expect(result.value).toHaveLength(2);
    expect(result.value.map((ctx) => ctx.entityId)).toEqual([
      'chair-1',
      'chair-2',
    ]);
  });

  it('logs fallback metrics for failed sit_down resolutions', () => {
    const failure = ActionResult.failure(new Error('unable to resolve scope'));
    const trace = {
      withSpan: jest.fn((_, callback) => callback()),
      info: jest.fn(),
    };

    unifiedScopeResolver.resolve.mockReturnValue(failure);

    const result = service.resolveTargets(
      'positioning:available_furniture',
      actorEntity,
      discoveryContext,
      trace,
      'positioning:sit_down'
    );

    expect(logger.debug).toHaveBeenCalledWith(
      expect.stringContaining('UnifiedScopeResolver result for sit_down'),
      expect.objectContaining({
        success: false,
        hasValue: false,
        valueSize: 0,
        entities: [],
      })
    );
    expect(result).toBe(failure);
  });
});
