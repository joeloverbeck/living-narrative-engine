import {
  describe,
  expect,
  it,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';

import GoapController from '../../../../src/goap/controllers/goapController.js';
import { InvalidArgumentError } from '../../../../src/errors/invalidArgumentError.js';
import * as plannerContract from '../../../../src/goap/planner/goapPlannerContractDefinition.js';
import { GOAP_EVENTS } from '../../../../src/goap/events/goapEvents.js';

const createBaseDependencies = (overrides = {}) => {
  const logger = {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  };

  return {
    goapPlanner: {
      plan: jest.fn(),
      getTaskLibraryDiagnostics: jest.fn(),
      getEffectFailureTelemetry: jest.fn(),
      getLastFailure: jest.fn(),
      clearActorDiagnostics: jest.fn(),
      ...overrides.goapPlanner,
    },
    refinementEngine: { refine: jest.fn(), ...overrides.refinementEngine },
    planInvalidationDetector: {
      checkPlanValidity: jest.fn().mockReturnValue({ valid: true }),
      ...overrides.planInvalidationDetector,
    },
    contextAssemblyService: {
      assemblePlanningContext: jest.fn().mockReturnValue({}),
      ...overrides.contextAssemblyService,
    },
    jsonLogicService: { evaluate: jest.fn(), ...overrides.jsonLogicService },
    dataRegistry: {
      getAll: jest.fn().mockReturnValue([{ id: 'goal-1', relevance: true }]),
      get: jest.fn(),
      ...overrides.dataRegistry,
    },
    eventBus: { dispatch: jest.fn(), ...overrides.eventBus },
    logger,
    parameterResolutionService: {
      resolve: jest.fn(),
      clearCache: jest.fn(),
      ...overrides.parameterResolutionService,
    },
  };
};

describe('GoapController uncovered branches', () => {
  let deps;
  let snapshotSpy;

  beforeEach(() => {
    deps = createBaseDependencies();
    snapshotSpy = jest.spyOn(plannerContract, 'createPlannerContractSnapshot');
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('records no dependency diagnostics when snapshot is empty', () => {
    snapshotSpy.mockReturnValue(null);

    const controller = new GoapController(deps);

    expect(controller.getDependencyDiagnostics()).toHaveLength(0);
    expect(deps.logger.warn).not.toHaveBeenCalled();
  });

  it('logs dependency warnings when required methods are missing', () => {
    const snapshot = {
      dependency: 'IGoapPlanner',
      requiredMethods: ['plan'],
      providedMethods: [],
      missingMethods: ['plan'],
    };
    snapshotSpy.mockReturnValue(snapshot);

    const controller = new GoapController(deps);

    const diagnostics = controller.getDependencyDiagnostics();
    expect(diagnostics[0].status).toBe('warn');
    expect(deps.logger.warn).toHaveBeenCalledWith(
      'GOAP_DEPENDENCY_WARN: Missing dependency methods',
      expect.objectContaining({ dependency: snapshot.dependency })
    );
  });

  it('handles plans without a current task', async () => {
    const controller = new GoapController(deps);
    const hooks = GoapController.__getTestHooks(controller);
    hooks.setActorPlan('actor-1', {
      goal: { id: 'goal-1' },
      tasks: [undefined],
      currentStep: 0,
      actorId: 'actor-1',
      createdAt: Date.now(),
      lastValidated: Date.now(),
    });

    const result = await controller.decideTurn({ id: 'actor-1' }, {});

    expect(result).toBeNull();
    expect(deps.refinementEngine.refine).not.toHaveBeenCalled();
    expect(deps.logger.error).toHaveBeenCalledWith(
      'Active plan has no current task',
      expect.any(Object)
    );
  });

  it('throws when planner returns invalid task list', () => {
    const controller = new GoapController(deps);
    const hooks = GoapController.__getTestHooks(controller);

    expect(() =>
      hooks.createPlan({ id: 'goal-1' }, 'not-an-array', 'actor-1')
    ).toThrow(InvalidArgumentError);
  });

  it('exposes internal guard rails through test hooks', async () => {
    snapshotSpy.mockReturnValue({
      dependency: 'IGoapPlanner',
      requiredMethods: [],
      providedMethods: [],
      missingMethods: [],
    });

    const controller = new GoapController(deps);
    const hooks = GoapController.__getTestHooks(controller);

    expect(hooks.getCurrentTask('actor-x')).toBeNull();
    expect(hooks.validateActivePlan('actor-x', {})).toEqual({
      valid: false,
      reason: 'No active plan',
    });
    expect(() => hooks.advancePlan('actor-x')).toThrow(
      'Cannot advance: no active plan'
    );
    expect(hooks.clearPlan('actor-x', 'no-op')).toBeUndefined();
    expect(hooks.cleanupActorDiagnostics(null)).toBeUndefined();

    hooks.setActorPlan('actor-y', { tasks: [], currentStep: 1 });
    expect(hooks.getCurrentTask('actor-y')).toBeNull();
    hooks.deleteActorPlan('actor-y');
  });

  it('prunes stale failures while keeping recent ones', () => {
    const controller = new GoapController(deps);
    const hooks = GoapController.__getTestHooks(controller);
    const map = new Map([
      ['goal-1', [{ timestamp: 0 }, { timestamp: Date.now() }]],
    ]);

    hooks.pruneFailureMap(map, 10, Date.now());

    expect(map.get('goal-1')).toHaveLength(1);
  });

  it('logs refinement hint failures without throwing', async () => {
    const controller = new GoapController(deps);
    const hooks = GoapController.__getTestHooks(controller);

    const result = await hooks.extractActionHint(
      { success: false, error: 'boom' },
      { taskId: 'task-1' },
      { id: 'actor-1' }
    );

    expect(result).toBeNull();
    expect(deps.logger.warn).toHaveBeenCalledWith(
      'Refinement failed, cannot extract hint',
      expect.objectContaining({ error: 'boom' })
    );
  });

  it('handles continue fallback without actor context', async () => {
    const controller = new GoapController(deps);
    const hooks = GoapController.__getTestHooks(controller);

    const result = await hooks.handleRefinementFailure(
      { taskId: 'task-1' },
      { fallbackBehavior: 'continue', error: 'oops' }
    );

    expect(result).toBeNull();
    expect(deps.logger.error).toHaveBeenCalledWith(
      'Missing actor context during continue fallback'
    );
  });

  it('returns null when event dispatcher lacks compliance helpers', () => {
    const controller = new GoapController(deps);
    const hooks = GoapController.__getTestHooks(controller);
    hooks.setEventDispatcher({ dispatch: jest.fn() });

    expect(controller.getEventComplianceDiagnostics('actor-1')).toBeNull();
  });

  it('returns null when no event compliance diagnostics exist', () => {
    const controller = new GoapController({
      ...deps,
      goapEventDispatcher: {
        dispatch: jest.fn(),
        getComplianceSnapshot: jest.fn().mockReturnValue(null),
        getComplianceForActor: jest.fn().mockReturnValue(null),
      },
    });

    expect(controller.getEventComplianceDiagnostics('actor-1')).toBeNull();
  });
});
