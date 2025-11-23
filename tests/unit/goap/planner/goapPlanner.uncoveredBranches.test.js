import { jest } from '@jest/globals';
import { GOAP_PLANNER_FAILURES } from '../../../../src/goap/planner/goapPlannerFailureReasons.js';
import { setGoalPathLintOverride } from '../../../../src/goap/planner/goalPathValidator.js';
import { createPlannerHarness } from './helpers/createPlannerHarness.js';

describe('GoapPlanner uncovered branches', () => {
  afterEach(() => {
    setGoalPathLintOverride(null);
    jest.restoreAllMocks();
  });

  it('handles nullable diagnostics getters and setters', () => {
    const { planner } = createPlannerHarness();

    expect(planner.getTaskLibraryDiagnostics()).toBeNull();

    planner.setExternalTaskLibraryDiagnostics({ warnings: ['external'] });
    planner.setExternalTaskLibraryDiagnostics();

    expect(planner.getGoalPathDiagnostics()).toBeNull();
    expect(planner.getGoalPathDiagnostics('missing-entry')).toBeNull();
  });

  it('records and trims goal path diagnostics', () => {
    const { planner, mocks } = createPlannerHarness({ actorId: 'actor-goalpath' });
    mocks.jsonLogicEvaluationService.evaluateCondition.mockReturnValue(true);

    const invalidGoalTemplate = {
      goalState: { '==': [{ var: 'actor.position' }, true] },
    };

    for (let i = 0; i < 6; i += 1) {
      planner.testGoalSatisfied(
        {},
        { ...invalidGoalTemplate, id: `goal-${i}` }
      );
    }

    const diagnostics = planner.getGoalPathDiagnostics('unknown');
    expect(diagnostics.entries).toHaveLength(5);
    expect(diagnostics.totalViolations).toBe(6);

    expect(planner.getGoalPathDiagnostics('unknown')).toBeNull();
  });

  it('warns when goal state serialization fails', () => {
    const { planner, mocks } = createPlannerHarness({ actorId: 'actor-serialization' });
    mocks.jsonLogicEvaluationService.evaluateCondition.mockReturnValue(true);

    jest
      .spyOn(JSON, 'stringify')
      .mockImplementationOnce(() => {
        throw new Error('serialize-failure');
      });

    const goal = { id: 'goal-serialization', goalState: { var: 'actor.id' } };

    planner.testGoalSatisfied({}, goal);

    expect(mocks.logger.warn).toHaveBeenCalledWith(
      'Failed to serialize goal state for normalization cache',
      expect.objectContaining({ error: expect.any(Error) })
    );
  });

  it('trims effect failure telemetry after more than 10 entries', () => {
    const { planner, mocks } = createPlannerHarness({ actorId: 'actor-telemetry' });
    mocks.effectsSimulator.simulateEffects.mockReturnValue({
      success: false,
      error: 'simulation failed',
      state: {},
    });

    const goal = {
      id: 'numeric-goal',
      goalState: { '<=': [{ var: 'actor.hunger' }, 10] },
    };

    for (let i = 0; i < 11; i += 1) {
      try {
        planner.testTaskReducesDistance(
          { id: 'task-invalid', planningEffects: [] },
          {},
          goal,
          'actor-telemetry'
        );
      } catch (error) {
        expect(error.code).toBe(GOAP_PLANNER_FAILURES.INVALID_EFFECT_DEFINITION);
      }
    }

    const telemetry = planner.getEffectFailureTelemetry('actor-telemetry');
    expect(telemetry.totalFailures).toBe(11);
    expect(telemetry.failures).toHaveLength(10);
    expect(planner.getEffectFailureTelemetry('actor-telemetry')).toBeNull();
  });

  it('aborts planning when applicability checks raise invalid effect errors', () => {
    const { planner, mocks } = createPlannerHarness({ actorId: 'actor-invalid-effect' });
    mocks.gameDataRepository.get.mockReturnValue({
      core: {
        'task:bad': { id: 'task:bad', planningScope: 'none', planningEffects: [] },
      },
    });
    mocks.heuristicRegistry.calculate.mockReturnValue(0);
    mocks.effectsSimulator.simulateEffects.mockReturnValue({
      success: false,
      error: 'not allowed',
      state: {},
    });

    const goal = {
      id: 'goal-invalid-effect',
      goalState: { '<=': [{ var: 'actor.health' }, 50] },
    };

    const planResult = planner.plan('actor-invalid-effect', goal, {});
    expect(planResult).toBeNull();
    expect(planner.getLastFailure().code).toBe(
      GOAP_PLANNER_FAILURES.INVALID_EFFECT_DEFINITION
    );
  });

  it('rethrows unexpected errors during successor expansion', () => {
    const { planner, mocks } = createPlannerHarness({ actorId: 'actor-throw' });
    mocks.gameDataRepository.get.mockReturnValue({
      core: {
        'task:explode': {
          id: 'task:explode',
          planningScope: 'none',
          planningEffects: [{}],
          cost: 1,
        },
      },
    });
    mocks.heuristicRegistry.calculate.mockReturnValue(0);
    mocks.effectsSimulator.simulateEffects.mockImplementation(() => {
      throw new Error('unexpected boom');
    });
    mocks.jsonLogicEvaluationService.evaluateCondition.mockReturnValue(false);

    const goal = { id: 'non-numeric-goal', goalState: { var: 'actor.alive' } };

    let thrownError = null;
    let planResult = null;
    try {
      planResult = planner.plan('actor-throw', goal, {});
    } catch (error) {
      thrownError = error;
    }

    const simulationResult = mocks.effectsSimulator.simulateEffects.mock.results[0];
    if (!thrownError && simulationResult?.type === 'throw') {
      thrownError = simulationResult.value;
    }

    expect(simulationResult?.type).toBe('throw');
    expect(planResult).toBeNull();
    expect(thrownError).toBeInstanceOf(Error);
    expect(thrownError.message).toBe('unexpected boom');
  });

  it('reports no applicable tasks when planning exhausts options', () => {
    const { planner, mocks } = createPlannerHarness({ actorId: 'actor-no-tasks' });
    mocks.gameDataRepository.get.mockReturnValue({
      core: {
        'task:inapplicable': {
          id: 'task:inapplicable',
          planningScope: 'missing-scope',
          planningEffects: [],
        },
      },
    });
    mocks.scopeRegistry.getScopeAst.mockReturnValue(null);
    mocks.heuristicRegistry.calculate.mockReturnValue(0);
    mocks.effectsSimulator.simulateEffects.mockReturnValue({ success: true, state: {} });
    mocks.jsonLogicEvaluationService.evaluateCondition.mockReturnValue(false);

    const goal = { id: 'goal-no-applicable', goalState: { var: 'actor.ready' } };

    const planResult = planner.plan('actor-no-tasks', goal, {});

    expect(planResult).toBeNull();
    expect(planner.getLastFailure()).toEqual(
      expect.objectContaining({
        code: GOAP_PLANNER_FAILURES.NO_APPLICABLE_TASKS,
      })
    );
  });
});
