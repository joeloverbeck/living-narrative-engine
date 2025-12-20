import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
  beforeEach,
  jest,
} from '@jest/globals';
import { TargetResolutionService } from '../../../src/actions/targetResolutionService.js';
import { UnifiedScopeResolver } from '../../../src/actions/scopes/unifiedScopeResolver.js';
import { ActionErrorContextBuilder } from '../../../src/actions/errors/actionErrorContextBuilder.js';
import { StructuredTrace } from '../../../src/actions/tracing/structuredTrace.js';
import { ActionTargetContext } from '../../../src/models/actionTargetContext.js';
import { LogLevel } from '../../../src/logging/consoleLogger.js';
import { ServiceSetup } from '../../../src/utils/serviceInitializerUtils.js';
import { ActionResult } from '../../../src/actions/core/actionResult.js';
import { ActionTestUtilities } from '../../common/actions/actionTestUtilities.js';
import { createMinimalTestContainer } from '../../common/scopeDsl/minimalTestContainer.js';

/**
 * Helper that builds a real TargetResolutionService instance using the lightweight test container.
 * The goal is to exercise the integration between the service, UnifiedScopeResolver,
 * and the surrounding scope/actor infrastructure without relying on mocks.
 */
async function buildRealService() {
  const containerHandle = await createMinimalTestContainer({
    enableTracing: true,
    logLevel: LogLevel.DEBUG,
  });

  const { services } = containerHandle;
  services.logger.setLogLevel(LogLevel.DEBUG);

  await ActionTestUtilities.createStandardTestWorld({
    entityManager: services.entityManager,
    registry: services.dataRegistry,
  });
  await ActionTestUtilities.createTestActors({
    entityManager: services.entityManager,
    registry: services.dataRegistry,
  });

  const scopeDefinitions = {
    'movement:clear_directions': {
      id: 'movement:clear_directions',
      expr: 'location.locations:exits[{"condition_ref": "movement:exit-is-unblocked"}].target',
      ast: services.dslParser.parse(
        'location.locations:exits[{"condition_ref": "movement:exit-is-unblocked"}].target'
      ),
      description: 'Available exits from current location that are not blocked',
    },
    'core:other_actors': {
      id: 'core:other_actors',
      expr: 'entities(core:actor)[{"var": "id", "neq": {"var": "actor.id"}}]',
      ast: services.dslParser.parse(
        'entities(core:actor)[{"var": "id", "neq": {"var": "actor.id"}}]'
      ),
      description: 'Other actors in the game (excluding the current actor)',
    },
    'core:nearby_actors': {
      id: 'core:nearby_actors',
      expr: 'entities(core:actor)[{"var": "core:position.locationId", "eq": {"var": "actor.core:position.locationId"}}][{"var": "id", "neq": {"var": "actor.id"}}]',
      ast: services.dslParser.parse(
        'entities(core:actor)[{"var": "core:position.locationId", "eq": {"var": "actor.core:position.locationId"}}][{"var": "id", "neq": {"var": "actor.id"}}]'
      ),
      description: 'Other actors in the same location',
    },
  };

  services.scopeRegistry.initialize(scopeDefinitions);

  const actionErrorContextBuilder = new ActionErrorContextBuilder({
    entityManager: services.entityManager,
    logger: services.logger,
    fixSuggestionEngine: { suggestFixes: () => [] },
  });

  const unifiedScopeResolver = new UnifiedScopeResolver({
    scopeRegistry: services.scopeRegistry,
    scopeEngine: services.scopeEngine,
    entityManager: services.entityManager,
    jsonLogicEvaluationService: services.jsonLogicEval,
    dslParser: services.dslParser,
    logger: services.logger,
    actionErrorContextBuilder,
  });

  const targetResolutionService = new TargetResolutionService({
    unifiedScopeResolver,
    logger: services.logger,
  });

  const actor = services.entityManager.getEntityInstance('test-player');
  const discoveryContext = {
    currentLocation: 'test-location-1',
    entityManager: services.entityManager,
    jsonLogicEval: services.jsonLogicEval,
  };

  return {
    containerHandle,
    services,
    targetResolutionService,
    actor,
    discoveryContext,
  };
}

describe('TargetResolutionService real-module integration', () => {
  /** @type {Awaited<ReturnType<typeof buildRealService>>} */
  let testHarness;

  beforeAll(async () => {
    testHarness = await buildRealService();
  });

  afterAll(async () => {
    if (testHarness) {
      await testHarness.containerHandle.cleanup();
    }
  });

  beforeEach(() => {
    jest.restoreAllMocks();
  });

  it('resolves scoped targets through UnifiedScopeResolver using structured tracing', () => {
    const { targetResolutionService, actor, discoveryContext } = testHarness;
    const trace = new StructuredTrace();

    const result = targetResolutionService.resolveTargets(
      'core:nearby_actors',
      actor,
      discoveryContext,
      trace,
      'core:wave'
    );

    expect(result.success).toBe(true);
    const entityIds = result.value.map((ctx) => ctx.entityId);
    expect(entityIds).toEqual(
      expect.arrayContaining(['test-npc', 'test-follower'])
    );
    result.value.forEach((ctx) =>
      expect(ctx).toBeInstanceOf(ActionTargetContext)
    );

    const spanTree = trace.getHierarchicalView();
    expect(spanTree?.operation).toBe('target.resolve');
    expect(spanTree?.children.length).toBeGreaterThan(0);
    expect(
      trace.logs.some((log) =>
        log.message.includes('Delegating scope resolution')
      )
    ).toBe(true);
  });

  it('returns a noTarget context when resolving the none scope', () => {
    const { targetResolutionService, actor, discoveryContext } = testHarness;

    const result = targetResolutionService.resolveTargets(
      'none',
      actor,
      discoveryContext
    );

    expect(result.success).toBe(true);
    expect(result.value).toHaveLength(1);
    expect(result.value[0].type).toBe('none');
  });

  it('returns an empty array when the resolver yields no entity IDs', () => {
    const { actor, discoveryContext, services } = testHarness;
    const stubResolver = {
      resolve: () => ActionResult.success(new Set()),
    };
    const stubService = new TargetResolutionService({
      unifiedScopeResolver: stubResolver,
      logger: services.logger,
      serviceSetup: new ServiceSetup(),
    });

    const result = stubService.resolveTargets(
      'testing:empty_scope',
      actor,
      discoveryContext,
      null,
      'core:inspect-area'
    );

    expect(result.success).toBe(true);
    expect(result.value).toEqual([]);
  });

  it('propagates resolver failures for unknown scopes', () => {
    const { actor, discoveryContext, services } = testHarness;
    const stubResolver = {
      resolve: () => ActionResult.failure(new Error('resolver exploded')),
    };
    const failingService = new TargetResolutionService({
      unifiedScopeResolver: stubResolver,
      logger: services.logger,
      serviceSetup: new ServiceSetup(),
    });

    const result = failingService.resolveTargets(
      'testing:missing_scope',
      actor,
      discoveryContext,
      null,
      'core:invalid'
    );

    expect(result.success).toBe(false);
    expect(result.errors[0].message).toContain('resolver exploded');
  });

  it('emits enhanced debug logs for sit_down instrumentation paths', () => {
    const { targetResolutionService, actor, discoveryContext } = testHarness;
    const trace = new StructuredTrace();
    const debugSpy = jest.spyOn(console, 'debug').mockImplementation(() => {});

    const result = targetResolutionService.resolveTargets(
      'core:nearby_actors',
      actor,
      discoveryContext,
      trace,
      'positioning:sit_down'
    );

    expect(result.success).toBe(true);
    const targetedCalls = debugSpy.mock.calls
      .map(([message, details]) => ({ message, details }))
      .filter(
        ({ message }) =>
          typeof message === 'string' &&
          message.includes('TargetResolutionService:')
      );

    expect(targetedCalls.length).toBeGreaterThanOrEqual(3);
    expect(
      targetedCalls.some(({ message }) =>
        message.includes('Resolving scope for sit_down')
      )
    ).toBe(true);
    expect(
      targetedCalls.some(({ message }) =>
        message.includes('Context built for UnifiedScopeResolver')
      )
    ).toBe(true);
    expect(
      targetedCalls.some(({ message }) =>
        message.includes('UnifiedScopeResolver result for sit_down')
      )
    ).toBe(true);
    debugSpy.mockRestore();

    const infoLogs = trace.logs.filter((entry) => entry.type === 'info');
    expect(infoLogs.some((log) => log.message.includes('resolved to'))).toBe(
      true
    );
  });
});
