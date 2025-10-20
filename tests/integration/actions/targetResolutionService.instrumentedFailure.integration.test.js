import { describe, it, expect, beforeAll, afterAll, jest } from '@jest/globals';
import { TargetResolutionService } from '../../../src/actions/targetResolutionService.js';
import { UnifiedScopeResolver } from '../../../src/actions/scopes/unifiedScopeResolver.js';
import { ActionErrorContextBuilder } from '../../../src/actions/errors/actionErrorContextBuilder.js';
import { StructuredTrace } from '../../../src/actions/tracing/structuredTrace.js';
import { LogLevel } from '../../../src/logging/consoleLogger.js';
import { ActionTestUtilities } from '../../common/actions/actionTestUtilities.js';
import { createMinimalTestContainer } from '../../common/scopeDsl/minimalTestContainer.js';

/**
 * Builds a fully wired TargetResolutionService using the lightweight scope DSL container.
 * The harness intentionally omits the positioning:available_furniture scope so that
 * UnifiedScopeResolver returns a structured failure while instrumentation remains active.
 */
async function buildTargetResolutionHarness() {
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

describe('TargetResolutionService instrumentation coverage for sit_down failures', () => {
  /** @type {Awaited<ReturnType<typeof buildTargetResolutionHarness>>} */
  let harness;

  beforeAll(async () => {
    harness = await buildTargetResolutionHarness();
  });

  afterAll(async () => {
    if (harness) {
      await harness.containerHandle.cleanup();
    }
  });

  it('logs full instrumentation details when UnifiedScopeResolver fails for sit_down', () => {
    const { targetResolutionService, actor, discoveryContext } = harness;
    const trace = new StructuredTrace();
    const debugSpy = jest.spyOn(console, 'debug').mockImplementation(() => {});

    const result = targetResolutionService.resolveTargets(
      'positioning:available_furniture',
      actor,
      discoveryContext,
      trace,
      'positioning:sit_down'
    );

    expect(result.success).toBe(false);
    expect(result.errors[0]).toBeInstanceOf(Error);
    expect(result.errors[0].name).toBe('ScopeNotFoundError');

    const debugMessages = debugSpy.mock.calls
      .filter(([message]) => typeof message === 'string')
      .map(([message, details]) => ({ message, details }));

    expect(
      debugMessages.some(({ message }) =>
        message.includes('Resolving scope for sit_down')
      )
    ).toBe(true);

    expect(
      debugMessages.some(({ message }) =>
        message.includes('Context built for UnifiedScopeResolver')
      )
    ).toBe(true);

    const resolverResultCall = debugMessages.find(({ message }) =>
      message.includes('UnifiedScopeResolver result for sit_down')
    );

    expect(resolverResultCall).toBeDefined();
    expect(resolverResultCall?.details).toMatchObject({
      success: false,
      hasValue: false,
      valueSize: 0,
      entities: [],
    });

    debugSpy.mockRestore();

    expect(
      trace.logs.some(
        (entry) =>
          entry.type === 'info' &&
          entry.message.includes(
            "Delegating scope resolution for 'positioning:available_furniture'"
          )
      )
    ).toBe(true);
  });
});
