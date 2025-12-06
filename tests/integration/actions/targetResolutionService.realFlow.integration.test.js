/**
 * @file Real-flow integration tests for TargetResolutionService.
 * @description Exercises the service with concrete collaborators (no module mocks)
 *              to validate scope resolution, trace handling, and result shaping.
 */

import { describe, it, expect } from '@jest/globals';
import { TargetResolutionService } from '../../../src/actions/targetResolutionService.js';
import { ServiceSetup } from '../../../src/utils/serviceInitializerUtils.js';
import { ActionResult } from '../../../src/actions/core/actionResult.js';
import { ActionTargetContext } from '../../../src/models/actionTargetContext.js';

/**
 * Minimal logger capturing debug/info output for assertions.
 */
class RecordingLogger {
  constructor() {
    this.debugMessages = [];
    this.infoMessages = [];
    this.warnMessages = [];
    this.errorMessages = [];
  }

  debug(message, payload) {
    this.debugMessages.push({ message, payload });
  }

  info(message, payload) {
    this.infoMessages.push({ message, payload });
  }

  warn(message, payload) {
    this.warnMessages.push({ message, payload });
  }

  error(message, payload) {
    this.errorMessages.push({ message, payload });
  }
}

/**
 * Lightweight UnifiedScopeResolver implementation used by the tests.
 */
class FakeUnifiedScopeResolver {
  constructor(resultFactory) {
    this.resultFactory = resultFactory;
    this.calls = [];
  }

  resolve(scopeName, context) {
    this.calls.push({ scopeName, context });
    if (typeof this.resultFactory === 'function') {
      return this.resultFactory(scopeName, context);
    }
    return this.resultFactory;
  }
}

/**
 * Trace helper that records spans and log events.
 */
class RecordingTrace {
  constructor() {
    this.spans = [];
    this.logs = [];
  }

  withSpan(name, executor, metadata) {
    this.spans.push({ name, metadata });
    return executor();
  }

  info(message, source, data) {
    this.logs.push({ type: 'info', message, source, data });
  }
}

describe('TargetResolutionService real-flow integration', () => {
  it('delegates to the unified resolver, wraps execution in a span, and normalises entity targets', () => {
    const logger = new RecordingLogger();
    const trace = new RecordingTrace();
    const resolver = new FakeUnifiedScopeResolver(() =>
      ActionResult.success(new Set(['chair-1', 'chair-2']))
    );

    const service = new TargetResolutionService({
      unifiedScopeResolver: resolver,
      logger,
      serviceSetup: new ServiceSetup(),
    });

    const actor = { id: 'actor-42' };
    const discoveryContext = { currentLocation: 'great-hall', mood: 'focused' };

    const result = service.resolveTargets(
      'positioning:available_furniture',
      actor,
      discoveryContext,
      trace,
      'positioning:sit_down'
    );

    expect(result.success).toBe(true);
    expect(result.value).toHaveLength(2);
    expect(result.value.map((ctx) => ctx.entityId)).toEqual([
      'chair-1',
      'chair-2',
    ]);
    expect(
      result.value.every((ctx) => ctx instanceof ActionTargetContext)
    ).toBe(true);

    expect(trace.spans).toHaveLength(1);
    expect(trace.spans[0]).toMatchObject({
      name: 'target.resolve',
      metadata: {
        scopeName: 'positioning:available_furniture',
        actorId: 'actor-42',
        actionId: 'positioning:sit_down',
      },
    });

    expect(resolver.calls).toHaveLength(1);
    expect(resolver.calls[0].scopeName).toBe('positioning:available_furniture');
    expect(resolver.calls[0].context).toMatchObject({
      actor,
      actorLocation: 'great-hall',
      actionContext: discoveryContext,
      actionId: 'positioning:sit_down',
    });

    const debugMessages = logger.debugMessages.map(({ message }) => message);
    expect(
      debugMessages.some((msg) =>
        msg.includes('TargetResolutionService: Resolving scope for sit_down')
      )
    ).toBe(true);
    expect(
      debugMessages.some((msg) =>
        msg.includes(
          'TargetResolutionService: Context built for UnifiedScopeResolver'
        )
      )
    ).toBe(true);
    expect(
      debugMessages.some((msg) =>
        msg.includes(
          'TargetResolutionService: UnifiedScopeResolver result for sit_down'
        )
      )
    ).toBe(true);

    expect(
      trace.logs.some((entry) => entry.message.includes('Delegating scope'))
    ).toBe(true);
    expect(
      trace.logs.some((entry) =>
        entry.message.includes(
          "Scope 'positioning:available_furniture' resolved to 2 target(s)."
        )
      )
    ).toBe(true);
  });

  it('returns a noTarget context when the resolver yields an empty set for the none scope', () => {
    const logger = new RecordingLogger();
    const trace = new RecordingTrace();
    const resolver = new FakeUnifiedScopeResolver(
      ActionResult.success(new Set())
    );

    const service = new TargetResolutionService({
      unifiedScopeResolver: resolver,
      logger,
      serviceSetup: new ServiceSetup(),
    });

    const result = service.resolveTargets(
      'none',
      { id: 'actor-99' },
      { currentLocation: 'atrium' },
      trace
    );

    expect(result.success).toBe(true);
    expect(result.value).toHaveLength(1);
    expect(result.value[0].type).toBe('none');
    expect(result.value[0].entityId).toBeNull();

    expect(
      trace.logs.some((entry) =>
        entry.message.includes(
          "Scope 'none' resolved to no targets - returning noTarget context."
        )
      )
    ).toBe(true);
  });

  it('propagates failures from the unified resolver without modification', () => {
    const logger = new RecordingLogger();
    const resolver = new FakeUnifiedScopeResolver(() =>
      ActionResult.failure({ message: 'resolution failed', code: 'NO_SCOPE' })
    );

    const service = new TargetResolutionService({
      unifiedScopeResolver: resolver,
      logger,
      serviceSetup: new ServiceSetup(),
    });

    const result = service.resolveTargets(
      'core:unknown',
      { id: 'actor-17' },
      { currentLocation: 'void' }
    );

    expect(result.success).toBe(false);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].message).toBe('resolution failed');
    expect(result.errors[0].code).toBe('NO_SCOPE');
  });
});
