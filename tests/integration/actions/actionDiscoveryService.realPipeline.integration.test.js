import { jest } from '@jest/globals';
import { IntegrationTestBed } from '../../common/integrationTestBed.js';
import { tokens } from '../../../src/dependencyInjection/tokens.js';
import { ActionDiscoveryService } from '../../../src/actions/actionDiscoveryService.js';
import ActionAwareStructuredTrace from '../../../src/actions/tracing/actionAwareStructuredTrace.js';
import ActionTraceFilter from '../../../src/actions/tracing/actionTraceFilter.js';
import { ActionTestUtilities } from '../../common/actions/actionTestUtilities.js';

/**
 * @file Integration tests that exercise ActionDiscoveryService with the real
 * action pipeline and supporting infrastructure. The goal is to cover the
 * production configuration paths that are skipped by mock-heavy suites.
 */
describe('ActionDiscoveryService - real pipeline integration', () => {
  /** @type {IntegrationTestBed} */
  let testBed;
  let entityManager;
  let registry;
  let actionIndex;
  let scopeRegistry;
  let dslParser;
  let traceContextFactory;
  let actionPipelineOrchestrator;
  let baseService;
  let playerActor;

  beforeAll(async () => {
    testBed = new IntegrationTestBed();
    await testBed.initialize();

    registry = testBed.get(tokens.IDataRegistry);
    entityManager = testBed.get(tokens.IEntityManager);
    actionIndex = testBed.get(tokens.ActionIndex);
    scopeRegistry = testBed.get(tokens.IScopeRegistry);
    dslParser = testBed.get(tokens.DslParser);
    traceContextFactory = testBed.get(tokens.TraceContextFactory);
    actionPipelineOrchestrator = testBed.get(tokens.ActionPipelineOrchestrator);

    // Build a small world and populate the registries so that the real
    // pipeline stages have meaningful data to process.
    ActionTestUtilities.setupTestConditions(registry);
    ActionTestUtilities.setupScopeDefinitions({
      scopeRegistry,
      dslParser,
      logger: testBed.mockLogger,
    });

    await ActionTestUtilities.createStandardTestWorld({
      entityManager,
      registry,
    });
    const actors = await ActionTestUtilities.createTestActors({
      entityManager,
      registry,
    });
    playerActor = entityManager.getEntityInstance(actors.player.id);

    await ActionTestUtilities.setupActionIndex({ registry, actionIndex }, []);

    baseService = testBed.get(tokens.IActionDiscoveryService);
  });

  afterAll(async () => {
    await testBed.cleanup();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('discovers available actions for an actor using the real orchestrator', async () => {
    const result = await baseService.getValidActions(playerActor, {});

    expect(Array.isArray(result.actions)).toBe(true);
    expect(result.errors).toEqual([]);

    const actionIds = result.actions.map((action) => action.id);
    expect(actionIds).toContain('core:wait');

    const actionWithCommand = result.actions.find(
      (action) =>
        typeof action.command === 'string' && action.command.length > 0
    );
    expect(actionWithCommand).toBeDefined();
    expect(actionWithCommand?.params).toBeTruthy();
  });

  it('creates action-aware traces and forwards them to the output service', async () => {
    class FailingTraceOutputService {
      constructor() {
        this.calls = 0;
      }

      /**
       * @param {ActionAwareStructuredTrace} trace
       */
      async writeTrace(trace) {
        this.calls += 1;
        // Access a few trace helpers to ensure the trace object was populated.
        expect(typeof trace.getTracingSummary).toBe('function');
        expect(trace.getTracedActions()).toBeInstanceOf(Map);
        throw new Error('intentional failure for coverage');
      }
    }

    const traceFilter = new ActionTraceFilter({
      logger: testBed.mockLogger,
      tracedActions: ['movement:*'],
      verbosityLevel: 'detailed',
    });

    const outputService = new FailingTraceOutputService();

    const service = new ActionDiscoveryService({
      entityManager,
      logger: testBed.mockLogger,
      actionPipelineOrchestrator,
      traceContextFactory,
      actionAwareTraceFactory: ({ actorId, context }) =>
        new ActionAwareStructuredTrace({
          actorId,
          context,
          actionTraceFilter: traceFilter,
          logger: testBed.mockLogger,
        }),
      actionTraceFilter: traceFilter,
      actionTraceOutputService: outputService,
    });

    const result = await service.getValidActions(
      playerActor,
      { reason: 'trace' },
      {
        trace: true,
      }
    );

    expect(result.actions.length).toBeGreaterThan(0);
    expect(result.trace).toBeDefined();
    expect(outputService.calls).toBe(1);

    expect(service.isActionTracingAvailable()).toBe(true);
    expect(service.getActionTracingStatus()).toMatchObject({
      available: true,
      enabled: true,
    });

    expect(testBed.mockLogger.warn).toHaveBeenCalledWith(
      'ActionDiscoveryService: Failed to write discovery trace',
      expect.objectContaining({ error: 'intentional failure for coverage' })
    );
  });

  it('logs warnings when optional tracing dependencies are malformed', async () => {
    const malformedService = new ActionDiscoveryService({
      entityManager,
      logger: testBed.mockLogger,
      actionPipelineOrchestrator,
      traceContextFactory,
      actionAwareTraceFactory: 'not-a-function',
      actionTraceFilter: { isEnabled: true },
      actionTraceOutputService: { writeTrace: false },
    });

    expect(malformedService.isActionTracingAvailable()).toBe(false);
    expect(testBed.mockLogger.warn).toHaveBeenCalledWith(
      expect.stringContaining('actionAwareTraceFactory must be a function')
    );
    expect(testBed.mockLogger.warn).toHaveBeenCalledWith(
      expect.stringContaining('actionTraceFilter missing required methods')
    );
    expect(testBed.mockLogger.warn).toHaveBeenCalledWith(
      expect.stringContaining(
        'actionTraceOutputService missing writeTrace method'
      )
    );
  });

  it('falls back to standard tracing when the filter throws during status checks', async () => {
    const flakyFilter = {
      isEnabled() {
        throw new Error('status check failed');
      },
      shouldTrace() {
        return true;
      },
    };

    const service = new ActionDiscoveryService({
      entityManager,
      logger: testBed.mockLogger,
      actionPipelineOrchestrator,
      traceContextFactory,
      actionAwareTraceFactory: () => traceContextFactory(),
      actionTraceFilter: flakyFilter,
    });

    const result = await service.getValidActions(
      playerActor,
      {},
      { trace: true }
    );
    expect(result.actions.length).toBeGreaterThan(0);

    expect(testBed.mockLogger.warn).toHaveBeenCalledWith(
      'ActionDiscoveryService: Error checking action tracing status, assuming disabled',
      expect.any(Error)
    );
    expect(service.getActionTracingStatus()).toMatchObject({
      available: true,
      enabled: false,
    });
  });

  it('throws informative errors for invalid inputs', async () => {
    await expect(baseService.getValidActions(null)).rejects.toThrow(
      'actorEntity parameter must be an object with a non-empty id'
    );

    await expect(
      baseService.getValidActions(playerActor, 'invalid-context')
    ).rejects.toThrow('baseContext must be an object when provided');
  });
});
