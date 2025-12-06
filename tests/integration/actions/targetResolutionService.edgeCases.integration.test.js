import { describe, it, expect, beforeEach } from '@jest/globals';
import { TargetResolutionService } from '../../../src/actions/targetResolutionService.js';
import { ActionResult } from '../../../src/actions/core/actionResult.js';
import { ActionTargetContext } from '../../../src/models/actionTargetContext.js';

class FakeUnifiedScopeResolver {
  constructor(resultFactory) {
    this.resultFactory = resultFactory;
    this.calls = [];
  }

  resolve(scopeName, context) {
    this.calls.push({ scopeName, context });
    return this.resultFactory(scopeName, context);
  }
}

const createLogger = () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
});

describe('TargetResolutionService edge-case integration', () => {
  let actor;

  beforeEach(() => {
    actor = { id: 'actor-edge-1' };
  });

  it('resolves targets when trace and action identifiers are omitted', () => {
    const resolver = new FakeUnifiedScopeResolver(() =>
      ActionResult.success(new Set(['ally-7']))
    );
    const logger = createLogger();
    const service = new TargetResolutionService({
      unifiedScopeResolver: resolver,
      logger,
    });

    const discoveryContext = {
      currentLocation: 'atrium',
      entityManager: { getEntityInstance: () => ({ id: 'ally-7' }) },
    };

    const result = service.resolveTargets(
      'social:friends_in_same_room',
      actor,
      discoveryContext
    );

    expect(result.success).toBe(true);
    expect(result.value).toHaveLength(1);
    expect(result.value[0]).toBeInstanceOf(ActionTargetContext);
    expect(result.value[0].entityId).toBe('ally-7');

    expect(resolver.calls).toHaveLength(1);
    const context = resolver.calls[0].context;
    expect(context.trace).toBeNull();
    expect(context.actionId).toBeNull();
  });

  it('logs null discovery context keys before failing when context is missing', () => {
    const resolver = new FakeUnifiedScopeResolver(() =>
      ActionResult.success(new Set(['chair-9']))
    );
    const logger = createLogger();
    const service = new TargetResolutionService({
      unifiedScopeResolver: resolver,
      logger,
    });

    expect(() =>
      service.resolveTargets('positioning:available_furniture', actor, null)
    ).toThrow(/currentLocation/);

    expect(logger.debug).toHaveBeenCalledWith(
      expect.stringContaining('Resolving scope for sit_down'),
      expect.objectContaining({
        scopeName: 'positioning:available_furniture',
        actionId: null,
        discoveryContextKeys: null,
      })
    );
  });

  it('captures resolver misuse when success is returned without targets', () => {
    const resolver = new FakeUnifiedScopeResolver(() =>
      ActionResult.success(null)
    );
    const logger = createLogger();
    const service = new TargetResolutionService({
      unifiedScopeResolver: resolver,
      logger,
    });

    expect(() =>
      service.resolveTargets(
        'positioning:available_furniture',
        actor,
        { currentLocation: 'atrium' },
        undefined,
        'positioning:sit_down'
      )
    ).toThrow(/size/);

    const debugCall = logger.debug.mock.calls.find((call) =>
      call[0].includes('UnifiedScopeResolver result for sit_down')
    );

    expect(debugCall).toBeDefined();
    expect(debugCall[1]).toMatchObject({
      success: true,
      hasValue: false,
      valueSize: 0,
      entities: [],
    });
  });
});
