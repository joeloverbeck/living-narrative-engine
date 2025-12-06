import { describe, it, expect, beforeAll, afterAll, jest } from '@jest/globals';
import { TargetResolutionService } from '../../../src/actions/targetResolutionService.js';
import { UnifiedScopeResolver } from '../../../src/actions/scopes/unifiedScopeResolver.js';
import { ActionErrorContextBuilder } from '../../../src/actions/errors/actionErrorContextBuilder.js';
import { StructuredTrace } from '../../../src/actions/tracing/structuredTrace.js';
import { TraceContext } from '../../../src/actions/tracing/traceContext.js';
import { ActionTargetContext } from '../../../src/models/actionTargetContext.js';
import { LogLevel } from '../../../src/logging/consoleLogger.js';
import { ActionTestUtilities } from '../../common/actions/actionTestUtilities.js';
import { createMinimalTestContainer } from '../../common/scopeDsl/minimalTestContainer.js';

/**
 *
 */
async function buildRealTargetResolutionHarness() {
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

  const scopeExpression =
    'entities(core:actor)[{"==": [{"var": "entity.components.core:position.locationId"}, {"var": "actor.components.core:position.locationId"}]}][{"!=": [{"var": "entity.id"}, {"var": "actor.id"}]}]';

  services.scopeRegistry.initialize({
    'positioning:available_furniture': {
      id: 'positioning:available_furniture',
      expr: scopeExpression,
      ast: services.dslParser.parse(scopeExpression),
      description:
        'Actors that share the same location as the source actor (proxy for available furniture).',
    },
    'core:nearby_actors': {
      id: 'core:nearby_actors',
      expr: scopeExpression,
      ast: services.dslParser.parse(scopeExpression),
      description: 'Other actors in the same location as the source actor.',
    },
  });

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

  const player = services.entityManager.getEntityInstance('test-player');
  const lockedActor =
    services.entityManager.getEntityInstance('test-locked-actor');

  const discoveryContext = {
    currentLocation: 'test-location-1',
    entityManager: services.entityManager,
    jsonLogicEval: services.jsonLogicEval,
  };

  return {
    containerHandle,
    services,
    targetResolutionService,
    player,
    lockedActor,
    discoveryContext,
  };
}

describe('TargetResolutionService with real scope resolver dependencies', () => {
  /** @type {Awaited<ReturnType<typeof buildRealTargetResolutionHarness>>} */
  let harness;

  beforeAll(async () => {
    harness = await buildRealTargetResolutionHarness();
  });

  afterAll(async () => {
    if (harness) {
      await harness.containerHandle.cleanup();
    }
  });

  it('resolves available furniture through StructuredTrace spans and maps entities to ActionTargetContext instances', () => {
    const { targetResolutionService, player, discoveryContext } = harness;
    const trace = new StructuredTrace();
    const debugSpy = jest.spyOn(console, 'debug').mockImplementation(() => {});

    const result = targetResolutionService.resolveTargets(
      'positioning:available_furniture',
      player,
      discoveryContext,
      trace,
      'positioning:sit_down'
    );

    expect(result.success).toBe(true);
    expect(result.value.map((ctx) => ctx.entityId)).toEqual(
      expect.arrayContaining(['test-npc', 'test-follower'])
    );
    result.value.forEach((ctx) =>
      expect(ctx).toBeInstanceOf(ActionTargetContext)
    );

    const spanTree = trace.getHierarchicalView();
    expect(spanTree?.operation).toBe('target.resolve');
    expect(
      spanTree?.children.some((child) => child.operation === 'scope.resolve')
    ).toBe(true);

    const infoLogs = trace.logs.filter((entry) => entry.type === 'info');
    expect(
      infoLogs.some((log) =>
        log.message.includes(
          "Scope 'positioning:available_furniture' resolved to"
        )
      )
    ).toBe(true);

    const debugMessages = debugSpy.mock.calls
      .map(([message]) => message)
      .filter((message) => typeof message === 'string');
    expect(
      debugMessages.some((message) =>
        message.includes(
          'TargetResolutionService: Resolving scope for sit_down'
        )
      )
    ).toBe(true);
    expect(
      debugMessages.some((message) =>
        message.includes(
          'TargetResolutionService: Context built for UnifiedScopeResolver'
        )
      )
    ).toBe(true);
    expect(
      debugMessages.some((message) =>
        message.includes(
          'TargetResolutionService: UnifiedScopeResolver result for sit_down'
        )
      )
    ).toBe(true);

    debugSpy.mockRestore();
  });

  it("returns a noTarget ActionTargetContext when the 'none' scope resolves to an empty set", () => {
    const { targetResolutionService, player, discoveryContext } = harness;
    const trace = new TraceContext();

    const result = targetResolutionService.resolveTargets(
      'none',
      player,
      discoveryContext,
      trace
    );

    expect(result.success).toBe(true);
    expect(result.value).toHaveLength(1);
    expect(result.value[0].type).toBe('none');
    expect(result.value[0].entityId).toBeNull();
    expect(
      trace.logs.some((log) =>
        log.message.includes(
          "Scope 'none' resolved to no targets - returning noTarget context."
        )
      )
    ).toBe(true);
  });

  it('returns an empty array when the resolver yields no other actors in the current location', () => {
    const { targetResolutionService, lockedActor, services } = harness;
    const trace = new TraceContext();
    const discoveryContext = {
      currentLocation: 'test-location-2',
      entityManager: services.entityManager,
      jsonLogicEval: services.jsonLogicEval,
    };

    const result = targetResolutionService.resolveTargets(
      'core:nearby_actors',
      lockedActor,
      discoveryContext,
      trace,
      'core:wave'
    );

    expect(result.success).toBe(true);
    expect(result.value).toEqual([]);
    expect(
      trace.logs.some((log) =>
        log.message.includes(
          "Scope 'core:nearby_actors' resolved to no targets."
        )
      )
    ).toBe(true);
  });

  it('propagates resolver failures from UnifiedScopeResolver for unknown scopes', () => {
    const { targetResolutionService, player, discoveryContext } = harness;
    const trace = new StructuredTrace();

    const result = targetResolutionService.resolveTargets(
      'unknown:scope',
      player,
      discoveryContext,
      trace,
      'core:inspect-area'
    );

    expect(result.success).toBe(false);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].message).toContain('Missing scope definition');
  });
});
