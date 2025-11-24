import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import TargetResolutionCoordinator from '../../../../../../src/actions/pipeline/services/implementations/TargetResolutionCoordinator.js';
import { PipelineResult } from '../../../../../../src/actions/pipeline/PipelineResult.js';

/**
 *
 */
function createMockLogger() {
  return {
    debug: jest.fn(),
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  };
}

/**
 *
 * @param order
 */
function createMockDependencyResolver(order = ['primary']) {
  return {
    getResolutionOrder: jest.fn(() => [...order]),
  };
}

/**
 *
 */
function createMockContextBuilder() {
  return {
    buildScopeContext: jest.fn(() => ({ contextBuilt: true })),
    buildScopeContextForSpecificPrimary: jest.fn(() => ({ specific: true })),
  };
}

/**
 *
 * @param resolutions
 */
function createMockUnifiedScopeResolver(resolutions = [['entity-1']]) {
  const queue = [...resolutions];
  return {
    resolve: jest.fn(async () => {
      if (queue.length === 0) {
        return { success: true, value: new Set() };
      }
      const next = queue.shift();
      if (next && typeof next === 'object' && 'success' in next) {
        return next;
      }
      return { success: true, value: new Set(next) };
    }),
  };
}

/**
 *
 */
function createMockEntityManager() {
  return {
    getEntityInstance: jest.fn((id) => (id ? { id, attributes: {} } : null)),
  };
}

/**
 *
 */
function createMockNameResolver() {
  return {
    getEntityDisplayName: jest.fn((id) => `Entity ${id}`),
  };
}

/**
 *
 */
function createMockTracingOrchestrator() {
  return {
    isActionAwareTrace: jest.fn(() => false),
    captureScopeEvaluation: jest.fn(),
    captureMultiTargetResolution: jest.fn(),
  };
}

/**
 *
 * @param result
 */
function createMockResultBuilder(result = PipelineResult.success({ data: { built: true } })) {
  return {
    buildMultiTargetResult: jest.fn(() => result),
  };
}

/**
 *
 */
function createMockTrace() {
  return {
    step: jest.fn(),
    info: jest.fn(),
    success: jest.fn(),
    failure: jest.fn(),
  };
}

/**
 *
 */
function createMockActionContext() {
  return { currentLocation: 'loc-1' };
}

/**
 *
 * @param overrides
 */
function createMockActionDef(overrides = {}) {
  return {
    id: 'test:action',
    targets: {
      primary: { scope: 'primary_scope', placeholder: 'Primary Target' },
      secondary: {
        scope: 'secondary_scope',
        contextFrom: 'primary',
        placeholder: 'Secondary Target',
      },
    },
    ...overrides,
  };
}

/**
 *
 * @param overrides
 */
function createPipelineContext(overrides = {}) {
  const baseActionDef = createMockActionDef(overrides.actionDef || {});
  return {
    actionDef: baseActionDef,
    actor: { id: 'actor-1', name: 'Actor One' },
    actionContext: createMockActionContext(),
    data: { stage: 'test-stage' },
    ...overrides,
    actionDef: baseActionDef,
  };
}

/**
 *
 * @param overrides
 */
function createCoordinatorDeps(overrides = {}) {
  return {
    dependencyResolver: createMockDependencyResolver(['primary', 'secondary']),
    contextBuilder: createMockContextBuilder(),
    nameResolver: createMockNameResolver(),
    unifiedScopeResolver: createMockUnifiedScopeResolver([
      ['entity-1'],
      ['dependent-1'],
    ]),
    entityManager: createMockEntityManager(),
    logger: createMockLogger(),
    tracingOrchestrator: createMockTracingOrchestrator(),
    resultBuilder: createMockResultBuilder(),
    ...overrides,
  };
}

/**
 *
 * @param overrides
 */
function createCoordinator(overrides = {}) {
  return new TargetResolutionCoordinator(createCoordinatorDeps(overrides));
}

const dependencyCases = [
  ['dependencyResolver', { getResolutionOrder: undefined }, "Invalid or missing method 'getResolutionOrder' on dependency 'ITargetDependencyResolver'."],
  [
    'contextBuilder',
    {
      buildScopeContext: () => ({}),
    },
    "Invalid or missing method 'buildScopeContextForSpecificPrimary' on dependency 'IScopeContextBuilder'.",
  ],
  [
    'nameResolver',
    {},
    "Invalid or missing method 'getEntityDisplayName' on dependency 'ITargetDisplayNameResolver'.",
  ],
  [
    'unifiedScopeResolver',
    {},
    "Invalid or missing method 'resolve' on dependency 'IUnifiedScopeResolver'.",
  ],
  [
    'entityManager',
    {},
    "Invalid or missing method 'getEntityInstance' on dependency 'IEntityManager'.",
  ],
  ['logger', null, 'Missing required dependency: ILogger.'],
  [
    'tracingOrchestrator',
    { isActionAwareTrace: () => false },
    "Invalid or missing method 'captureScopeEvaluation' on dependency 'ITargetResolutionTracingOrchestrator'.",
  ],
  [
    'resultBuilder',
    {},
    "Invalid or missing method 'buildMultiTargetResult' on dependency 'ITargetResolutionResultBuilder'.",
  ],
];

describe('TargetResolutionCoordinator - Constructor', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('validates each dependency with required methods', () => {
    expect(() => createCoordinator()).not.toThrow();
  });

  it.each(dependencyCases)(
    'throws when %s is missing required methods',
    (key, badValue, expectedMessage) => {
      const deps = createCoordinatorDeps();
      deps[key] = badValue;
      expect(() => new TargetResolutionCoordinator(deps)).toThrow(
        expectedMessage
      );
    }
  );

  it('stores dependencies when validation succeeds', async () => {
    const dependencyResolver = createMockDependencyResolver(['primary']);
    const coordinator = createCoordinator({ dependencyResolver });
    const context = createPipelineContext();
    await coordinator.coordinateResolution(context);
    expect(dependencyResolver.getResolutionOrder).toHaveBeenCalledWith(
      context.actionDef.targets
    );
  });
});

describe('TargetResolutionCoordinator - coordinateResolution', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('returns failure when targets configuration is invalid', async () => {
    const coordinator = createCoordinator();
    const context = createPipelineContext({ actionDef: { targets: null } });
    const result = await coordinator.coordinateResolution(context);
    expect(result.success).toBe(false);
    expect(result.errors[0].error).toBe('Invalid targets configuration');
    expect(result.continueProcessing).toBe(false);
  });

  it('wraps dependency resolver errors inside PipelineResult.failure', async () => {
    const dependencyResolver = {
      getResolutionOrder: jest.fn(() => {
        throw new Error('boom');
      }),
    };
    const coordinator = createCoordinator({ dependencyResolver });
    const context = createPipelineContext();
    const result = await coordinator.coordinateResolution(context);
    expect(result.success).toBe(false);
    expect(result.errors[0].error).toContain('boom');
  });

  it('short-circuits when resolveWithDependencies returns a PipelineResult instance', async () => {
    const resultBuilder = createMockResultBuilder();
    const coordinator = createCoordinator({ resultBuilder });
    const shortCircuit = PipelineResult.success({
      data: { actionsWithTargets: [] },
      continueProcessing: false,
    });
    jest
      .spyOn(coordinator, 'resolveWithDependencies')
      .mockResolvedValue(shortCircuit);
    const context = createPipelineContext();
    const result = await coordinator.coordinateResolution(context);
    expect(result).toBe(shortCircuit);
    expect(resultBuilder.buildMultiTargetResult).not.toHaveBeenCalled();
  });

  it('invokes resultBuilder with resolved payload when resolution succeeds', async () => {
    const resultBuilder = createMockResultBuilder(
      PipelineResult.success({ data: { marker: 'built' } })
    );
    const coordinator = createCoordinator({ resultBuilder });
    const resolutionOutcome = {
      resolvedTargets: { primary: [{ id: 'entity-1', displayName: 'Entity entity-1' }] },
      resolvedCounts: { primary: 1 },
      targetContexts: [{ targetKey: 'primary' }],
      detailedResolutionResults: { primary: {} },
    };
    jest
      .spyOn(coordinator, 'resolveWithDependencies')
      .mockResolvedValue(resolutionOutcome);
    const context = createPipelineContext();
    const result = await coordinator.coordinateResolution(context);
    expect(resultBuilder.buildMultiTargetResult).toHaveBeenCalledWith(
      context,
      resolutionOutcome.resolvedTargets,
      resolutionOutcome.targetContexts,
      context.actionDef.targets,
      context.actionDef,
      resolutionOutcome.detailedResolutionResults
    );
    expect(result.success).toBe(true);
    expect(result.data.marker).toBe('built');
  });

  it('returns success with continueProcessing false when no targets resolved', async () => {
    const coordinator = createCoordinator();
    jest.spyOn(coordinator, 'resolveWithDependencies').mockResolvedValue({
      resolvedTargets: { primary: [] },
      resolvedCounts: { primary: 0 },
      targetContexts: [],
      detailedResolutionResults: { primary: {} },
      resolutionOrder: ['primary'],
    });
    const context = createPipelineContext();
    const result = await coordinator.coordinateResolution(context);
    expect(result.success).toBe(true);
    expect(result.continueProcessing).toBe(false);
    expect(result.data.actionsWithTargets).toEqual([]);
  });

  it('captures multi-target resolution statistics for action-aware traces', async () => {
    const trace = createMockTrace();
    const tracingOrchestrator = createMockTracingOrchestrator();
    tracingOrchestrator.isActionAwareTrace.mockReturnValue(true);
    const coordinator = createCoordinator({ tracingOrchestrator });
    const resolutionOutcome = {
      resolvedTargets: { primary: [{ id: 'entity-1' }] },
      resolvedCounts: { primary: 1 },
      targetContexts: [],
      detailedResolutionResults: { primary: {} },
    };
    jest
      .spyOn(coordinator, 'resolveWithDependencies')
      .mockResolvedValue(resolutionOutcome);
    const context = createPipelineContext();
    await coordinator.coordinateResolution(context, trace);
    expect(
      tracingOrchestrator.captureMultiTargetResolution
    ).toHaveBeenCalledWith(
      trace,
      context.actionDef.id,
      expect.objectContaining({
        targetKeys: expect.arrayContaining(['primary', 'secondary']),
        resolvedCounts: resolutionOutcome.resolvedCounts,
        resolutionOrder: expect.arrayContaining(['primary']),
        hasContextDependencies: true,
      })
    );
  });

  it('returns builder payload when resolved targets exist', async () => {
    const resultBuilder = createMockResultBuilder(
      PipelineResult.success({ data: { success: true }, continueProcessing: true })
    );
    const coordinator = createCoordinator({ resultBuilder });
    const resolutionOutcome = {
      resolvedTargets: { primary: [{ id: 'entity-1' }] },
      resolvedCounts: { primary: 1 },
      targetContexts: [],
      detailedResolutionResults: { primary: {} },
    };
    jest
      .spyOn(coordinator, 'resolveWithDependencies')
      .mockResolvedValue(resolutionOutcome);
    const context = createPipelineContext();
    const result = await coordinator.coordinateResolution(context);
    expect(result).toBe(resultBuilder.buildMultiTargetResult.mock.results[0].value);
    expect(result.data.success).toBe(true);
  });
});

describe('TargetResolutionCoordinator - resolveWithDependencies', () => {
  let coordinator;
  let deps;
  let trace;

  beforeEach(() => {
    deps = createCoordinatorDeps({
      unifiedScopeResolver: createMockUnifiedScopeResolver([
        ['entity-1'],
        ['dependent-1'],
      ]),
    });
    coordinator = new TargetResolutionCoordinator(deps);
    trace = createMockTrace();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  /**
   *
   * @param resolutionOrder
   * @param overrides
   */
  async function runResolve(resolutionOrder = ['primary', 'secondary'], overrides = {}) {
    const context = createPipelineContext();
    const actionDef = context.actionDef;
    return coordinator.resolveWithDependencies({
      context,
      actionDef,
      targetDefs: actionDef.targets,
      actor: context.actor,
      actionContext: context.actionContext,
      resolutionOrder,
      trace,
      isActionAwareTrace: true,
      ...overrides,
    });
  }

  it('iterates targets using resolution order and logs diagnostics', async () => {
    await runResolve();
    expect(deps.logger.debug).toHaveBeenCalledWith(
      expect.stringContaining('Resolving target key: primary')
    );
    expect(deps.logger.debug).toHaveBeenCalledWith(
      expect.stringContaining('Resolving target key: secondary')
    );
    expect(trace.step).toHaveBeenCalledWith(
      expect.stringContaining('primary'),
      'MultiTargetResolutionStage'
    );
    expect(trace.step).toHaveBeenCalledWith(
      expect.stringContaining('secondary'),
      'MultiTargetResolutionStage'
    );
  });

  it('builds scope context and resolves primary scopes with UnifiedScopeResolver', async () => {
    await runResolve();
    expect(deps.contextBuilder.buildScopeContext).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'actor-1' }),
      expect.any(Object),
      expect.any(Object),
      expect.objectContaining({ scope: 'primary_scope' }),
      trace
    );
    expect(deps.unifiedScopeResolver.resolve).toHaveBeenCalledWith(
      'primary_scope',
      expect.any(Object),
      expect.objectContaining({ useCache: false })
    );
  });

  it('hydrates primary targets using entity manager and display name resolver', async () => {
    const outcome = await runResolve();
    expect(outcome.resolvedTargets.primary).toHaveLength(1);
    expect(outcome.resolvedTargets.primary[0]).toMatchObject({
      id: 'entity-1',
      displayName: 'Entity entity-1',
      entity: { id: 'entity-1' },
    });
  });

  it('delegates to resolveDependentTargets for contextFrom targets and merges results', async () => {
    const dependentData = {
      resolvedTargets: [{ id: 'dep-1', displayName: 'Entity dep-1' }],
      targetContexts: [{ entityId: 'dep-1' }],
      candidatesFound: 1,
      contextEntityIds: ['entity-1'],
      evaluationTimeMs: 2,
    };
    jest
      .spyOn(coordinator, 'resolveDependentTargets')
      .mockResolvedValue(dependentData);
    const outcome = await runResolve();
    expect(coordinator.resolveDependentTargets).toHaveBeenCalledWith(
      expect.objectContaining({ targetDef: expect.any(Object) })
    );
    expect(outcome.resolvedTargets.secondary).toEqual(dependentData.resolvedTargets);
    expect(outcome.targetContexts).toEqual(
      expect.arrayContaining(dependentData.targetContexts)
    );
  });

  it('records detailedResolutionResults with diagnostics data', async () => {
    const outcome = await runResolve();
    expect(outcome.detailedResolutionResults.primary).toMatchObject({
      scopeId: 'primary_scope',
      contextFrom: null,
      candidatesFound: 1,
      candidatesResolved: 1,
      failureReason: null,
    });
    expect(outcome.detailedResolutionResults.secondary).toMatchObject({
      scopeId: 'secondary_scope',
      contextFrom: 'primary',
    });
  });

  it('returns PipelineResult.success when a scope resolves to zero candidates', async () => {
    deps.unifiedScopeResolver.resolve.mockResolvedValueOnce({
      success: true,
      value: new Set(),
    });
    const result = await runResolve(['primary']);
    expect(result).toBeInstanceOf(PipelineResult);
    expect(result.success).toBe(true);
    expect(result.continueProcessing).toBe(false);
  });
});

describe('TargetResolutionCoordinator - resolveDependentTargets', () => {
  let coordinator;
  let deps;
  let trace;

  beforeEach(() => {
    deps = createCoordinatorDeps({
      unifiedScopeResolver: createMockUnifiedScopeResolver([
        ['dep-1'],
        ['dep-2'],
      ]),
    });
    coordinator = new TargetResolutionCoordinator(deps);
    trace = createMockTrace();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('builds scope context for each primary target', async () => {
    const targetDef = createMockActionDef().targets.secondary;
    const primaryTargets = [
      { id: 'entity-1', displayName: 'Entity entity-1' },
      { id: 'entity-2', displayName: 'Entity entity-2' },
    ];
    await coordinator.resolveDependentTargets({
      targetDef,
      primaryTargets,
      actor: { id: 'actor-1' },
      actionContext: createMockActionContext(),
      resolvedTargets: { primary: primaryTargets },
      trace,
      scopeStartTime: Date.now(),
    });
    expect(
      deps.contextBuilder.buildScopeContextForSpecificPrimary
    ).toHaveBeenCalledTimes(primaryTargets.length);
  });

  it('resolves scopes for each primary through unified scope resolver', async () => {
    const targetDef = createMockActionDef().targets.secondary;
    const primaryTargets = [{ id: 'entity-1', displayName: 'Entity entity-1' }];
    await coordinator.resolveDependentTargets({
      targetDef,
      primaryTargets,
      actor: { id: 'actor-1' },
      actionContext: createMockActionContext(),
      resolvedTargets: { primary: primaryTargets },
      trace,
      scopeStartTime: Date.now(),
    });
    expect(deps.unifiedScopeResolver.resolve).toHaveBeenCalledWith(
      'secondary_scope',
      expect.any(Object),
      expect.objectContaining({ useCache: false })
    );
  });

  it('skips unresolved dependent entities while processing remaining candidates', async () => {
    const targetDef = createMockActionDef().targets.secondary;
    const primaryTargets = [{ id: 'entity-1', displayName: 'Entity entity-1' }];
    deps.unifiedScopeResolver = createMockUnifiedScopeResolver([
      ['missing-entity', 'dep-1'],
    ]);
    deps.entityManager = {
      getEntityInstance: jest.fn((id) =>
        id === 'missing-entity' ? null : { id, attributes: {} }
      ),
    };
    deps.nameResolver = createMockNameResolver();
    coordinator = new TargetResolutionCoordinator(deps);

    const outcome = await coordinator.resolveDependentTargets({
      targetDef,
      primaryTargets,
      actor: { id: 'actor-1' },
      actionContext: createMockActionContext(),
      resolvedTargets: { primary: primaryTargets },
      trace,
      scopeStartTime: Date.now(),
    });

    expect(outcome.resolvedTargets).toHaveLength(1);
    expect(outcome.resolvedTargets[0].id).toBe('dep-1');
    expect(outcome.targetContexts).toHaveLength(1);
  });

  it('hydrates dependent targets and returns flattened contexts', async () => {
    const targetDef = createMockActionDef().targets.secondary;
    const primaryTargets = [{ id: 'entity-1', displayName: 'Entity entity-1' }];
    const outcome = await coordinator.resolveDependentTargets({
      targetDef,
      primaryTargets,
      actor: { id: 'actor-1' },
      actionContext: createMockActionContext(),
      resolvedTargets: { primary: primaryTargets },
      trace,
      scopeStartTime: Date.now(),
    });
    expect(outcome.resolvedTargets[0]).toMatchObject({
      contextFromId: 'entity-1',
    });
    expect(outcome.targetContexts[0]).toMatchObject({
      entityId: 'dep-1',
      placeholder: targetDef.placeholder,
    });
  });

  it('tracks candidate statistics for dependent targets', async () => {
    const targetDef = createMockActionDef().targets.secondary;
    const primaryTargets = [{ id: 'entity-1', displayName: 'Entity entity-1' }];
    const outcome = await coordinator.resolveDependentTargets({
      targetDef,
      primaryTargets,
      actor: { id: 'actor-1' },
      actionContext: createMockActionContext(),
      resolvedTargets: { primary: primaryTargets },
      trace,
      scopeStartTime: Date.now(),
    });
    expect(outcome.candidatesFound).toBeGreaterThan(0);
    expect(outcome.contextEntityIds).toEqual(['entity-1']);
    expect(outcome.evaluationTimeMs).toBeGreaterThanOrEqual(0);
  });

  it('returns empty arrays when there are no primary targets', async () => {
    const targetDef = createMockActionDef().targets.secondary;
    const outcome = await coordinator.resolveDependentTargets({
      targetDef,
      primaryTargets: [],
      actor: { id: 'actor-1' },
      actionContext: createMockActionContext(),
      resolvedTargets: { primary: [] },
      trace,
      scopeStartTime: Date.now(),
    });
    expect(outcome.resolvedTargets).toHaveLength(0);
    expect(outcome.targetContexts).toHaveLength(0);
    expect(outcome.candidatesFound).toBe(0);
  });
});

describe('TargetResolutionCoordinator - Resolution Order & Diagnostics', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('respects the order returned by dependencyResolver.getResolutionOrder', async () => {
    const unifiedScopeResolver = createMockUnifiedScopeResolver([
      ['entity-1'],
      ['dependent-1'],
    ]);
    const coordinator = createCoordinator({ unifiedScopeResolver });
    const context = createPipelineContext();
    await coordinator.resolveWithDependencies({
      context,
      actionDef: context.actionDef,
      targetDefs: context.actionDef.targets,
      actor: context.actor,
      actionContext: context.actionContext,
      resolutionOrder: ['primary', 'secondary'],
      trace: createMockTrace(),
      isActionAwareTrace: false,
    });
    const scopeCalls = unifiedScopeResolver.resolve.mock.calls.map(([scope]) => scope);
    expect(scopeCalls).toEqual(['primary_scope', 'secondary_scope']);
  });

  it('normalizes scope resolution results to string identifiers', async () => {
    const unifiedScopeResolver = createMockUnifiedScopeResolver([
      new Set([
        { id: ' entity-1 ' },
        { itemId: 'item-2' },
        {},
        'direct-id',
      ]),
    ]);
    const coordinator = createCoordinator({ unifiedScopeResolver });
    const outcome = await coordinator.resolveWithDependencies({
      context: createPipelineContext(),
      actionDef: createMockActionDef(),
      targetDefs: createMockActionDef().targets,
      actor: { id: 'actor-1' },
      actionContext: createMockActionContext(),
      resolutionOrder: ['primary'],
      trace: createMockTrace(),
      isActionAwareTrace: false,
    });

    expect(outcome.resolvedTargets.primary.map((t) => t.id)).toEqual(
      expect.arrayContaining(['entity-1', 'item-2', 'direct-id'])
    );
  });

  it('ensures dependent targets resolve only after their primaries exist', async () => {
    const coordinator = createCoordinator();
    const spy = jest.spyOn(coordinator, 'resolveDependentTargets');
    const context = createPipelineContext();
    await coordinator.resolveWithDependencies({
      context,
      actionDef: context.actionDef,
      targetDefs: context.actionDef.targets,
      actor: context.actor,
      actionContext: context.actionContext,
      resolutionOrder: ['primary', 'secondary'],
      trace: createMockTrace(),
      isActionAwareTrace: false,
    });
    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({
        primaryTargets: expect.arrayContaining([
          expect.objectContaining({ id: 'entity-1' }),
        ]),
      })
    );
  });

  it('records trace step/info/success/failure for each scope when trace is provided', async () => {
    const trace = createMockTrace();
    const coordinator = createCoordinator();
    await coordinator.resolveWithDependencies({
      context: createPipelineContext(),
      actionDef: createMockActionDef(),
      targetDefs: createMockActionDef().targets,
      actor: { id: 'actor-1' },
      actionContext: createMockActionContext(),
      resolutionOrder: ['primary'],
      trace,
      isActionAwareTrace: false,
    });
    expect(trace.step).toHaveBeenCalled();
    expect(trace.info).toHaveBeenCalled();
    expect(trace.success).toHaveBeenCalled();
  });
});

describe('TargetResolutionCoordinator - Detailed Results Tracking', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('captures counts and evaluation times for primary scopes', async () => {
    const coordinator = createCoordinator();
    const context = createPipelineContext();
    const outcome = await coordinator.resolveWithDependencies({
      context,
      actionDef: context.actionDef,
      targetDefs: context.actionDef.targets,
      actor: context.actor,
      actionContext: context.actionContext,
      resolutionOrder: ['primary'],
      trace: createMockTrace(),
      isActionAwareTrace: true,
    });
    expect(outcome.detailedResolutionResults.primary).toMatchObject({
      candidatesFound: 1,
      candidatesResolved: 1,
    });
    expect(outcome.detailedResolutionResults.primary.evaluationTimeMs).toBeGreaterThanOrEqual(0);
  });

  it('captures contextEntityIds and failureReason for dependents when zero candidates', async () => {
    const coordinator = createCoordinator();
    jest
      .spyOn(coordinator, 'resolveDependentTargets')
      .mockResolvedValue({
        resolvedTargets: [],
        targetContexts: [],
        candidatesFound: 0,
        contextEntityIds: ['entity-1'],
        evaluationTimeMs: 1,
      });
    const context = createPipelineContext();
    const result = await coordinator.resolveWithDependencies({
      context,
      actionDef: context.actionDef,
      targetDefs: context.actionDef.targets,
      actor: context.actor,
      actionContext: context.actionContext,
      resolutionOrder: ['primary', 'secondary'],
      trace: createMockTrace(),
      isActionAwareTrace: false,
    });
    expect(result).toBeInstanceOf(PipelineResult);
    expect(result.success).toBe(true);
    expect(result.data.detailedResolutionResults.secondary.failureReason).toContain(
      'No candidates'
    );
    expect(result.data.detailedResolutionResults.secondary.contextEntityIds).toEqual([
      'entity-1',
    ]);
  });

  it('aggregates targetContexts for hydrated targets', async () => {
    const coordinator = createCoordinator();
    const context = createPipelineContext();
    const outcome = await coordinator.resolveWithDependencies({
      context,
      actionDef: context.actionDef,
      targetDefs: context.actionDef.targets,
      actor: context.actor,
      actionContext: context.actionContext,
      resolutionOrder: ['primary'],
      trace: createMockTrace(),
      isActionAwareTrace: false,
    });
    expect(outcome.targetContexts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ placeholder: 'Primary Target' }),
      ])
    );
  });
});

describe('TargetResolutionCoordinator - Error Handling', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('returns continueProcessing false when scope resolution throws', async () => {
    const unifiedScopeResolver = {
      resolve: jest.fn(async () => ({ success: false, errors: [{ message: 'scope failure' }] })),
    };
    const logger = createMockLogger();
    const coordinator = createCoordinator({ unifiedScopeResolver, logger });
    const context = createPipelineContext({
      actionDef: {
        ...createMockActionDef(),
        targets: { primary: { scope: 'primary_scope', placeholder: 'Primary Target' } },
      },
    });
    const result = await coordinator.resolveWithDependencies({
      context,
      actionDef: context.actionDef,
      targetDefs: context.actionDef.targets,
      actor: context.actor,
      actionContext: context.actionContext,
      resolutionOrder: ['primary'],
      trace: createMockTrace(),
      isActionAwareTrace: false,
    });
    expect(result).toBeInstanceOf(PipelineResult);
    expect(result.success).toBe(true);
    expect(result.continueProcessing).toBe(false);
    expect(logger.error).toHaveBeenCalled();
  });

  it('wraps dependency resolver errors inside coordinateResolution failure', async () => {
    const dependencyResolver = {
      getResolutionOrder: jest.fn(() => {
        throw new Error('order failed');
      }),
    };
    const coordinator = createCoordinator({ dependencyResolver });
    const result = await coordinator.coordinateResolution(createPipelineContext());
    expect(result.success).toBe(false);
    expect(result.errors[0].error).toContain('order failed');
  });

  it('only captures tracing metrics when trace is action-aware', async () => {
    const tracingOrchestrator = createMockTracingOrchestrator();
    tracingOrchestrator.isActionAwareTrace.mockReturnValue(false);
    const coordinator = createCoordinator({ tracingOrchestrator });
    await coordinator.resolveWithDependencies({
      context: createPipelineContext(),
      actionDef: createMockActionDef(),
      targetDefs: createMockActionDef().targets,
      actor: { id: 'actor-1' },
      actionContext: createMockActionContext(),
      resolutionOrder: ['primary'],
      trace: createMockTrace(),
      isActionAwareTrace: false,
    });
    expect(tracingOrchestrator.captureScopeEvaluation).not.toHaveBeenCalled();
    expect(tracingOrchestrator.captureMultiTargetResolution).not.toHaveBeenCalled();
  });
});
