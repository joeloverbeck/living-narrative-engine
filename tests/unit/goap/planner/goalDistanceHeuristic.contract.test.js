import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import GoalDistanceHeuristic from '../../../../src/goap/planner/goalDistanceHeuristic.js';
import NumericConstraintEvaluator from '../../../../src/goap/planner/numericConstraintEvaluator.js';
import JsonLogicEvaluationService from '../../../../src/logic/jsonLogicEvaluationService.js';
import { createTestBed } from '../../../common/testBed.js';
import { GOAP_EVENTS } from '../../../../src/goap/events/goapEvents.js';

describe('GoalDistanceHeuristic (adapter contract)', () => {
  let testBed;
  let mockLogger;
  let originalAdapterEnv;
  let originalStrictEnv;

  beforeEach(() => {
    testBed = createTestBed();
    mockLogger = testBed.createMockLogger();
    originalAdapterEnv = process.env.GOAP_NUMERIC_ADAPTER;
    originalStrictEnv = process.env.GOAP_NUMERIC_STRICT;
    process.env.GOAP_NUMERIC_ADAPTER = '1';
  });

  afterEach(() => {
    if (typeof originalAdapterEnv === 'undefined') {
      delete process.env.GOAP_NUMERIC_ADAPTER;
    } else {
      process.env.GOAP_NUMERIC_ADAPTER = originalAdapterEnv;
    }
    if (typeof originalStrictEnv === 'undefined') {
      delete process.env.GOAP_NUMERIC_STRICT;
    } else {
      process.env.GOAP_NUMERIC_STRICT = originalStrictEnv;
    }
    testBed.cleanup();
  });

  it('passes adapter-provided metadata and stateView to NumericConstraintEvaluator', () => {
    const mockJsonLogic = testBed.createMock('JsonLogicEvaluationService', [
      'evaluate',
    ]);
    const mockNumericEvaluator = {
      isNumericConstraint: jest.fn().mockReturnValue(true),
      calculateDistance: jest.fn().mockReturnValue(5),
    };
    const mockSimulator = testBed.createMock('IPlanningEffectsSimulator', [
      'simulateEffects',
    ]);

    const heuristic = new GoalDistanceHeuristic({
      jsonLogicEvaluator: mockJsonLogic,
      numericConstraintEvaluator: mockNumericEvaluator,
      planningEffectsSimulator: mockSimulator,
      logger: mockLogger,
    });

    heuristic.calculate(
      {
        actor: {
          id: 'actor-1',
          components: { 'core:needs': { hunger: 90 } },
        },
      },
      {
        id: 'goal:eat',
        goalState: {
          '<=': [{ var: 'state.actor.components.core:needs.hunger' }, 30],
        },
      }
    );

    expect(mockNumericEvaluator.calculateDistance).toHaveBeenCalledWith(
      expect.any(Object),
      expect.any(Object),
      expect.objectContaining({
        stateView: expect.objectContaining({
          getActorId: expect.any(Function),
        }),
        metadata: expect.objectContaining({
          origin: 'GoalDistanceHeuristic',
          goalId: 'goal:eat',
        }),
      })
    );
  });

  it('dispatches numeric constraint fallback events when distance calculation fails', () => {
    const jsonLogicEvaluator = new JsonLogicEvaluationService({
      logger: mockLogger,
    });
    const fallbackEventDispatcher = {
      dispatch: jest.fn(),
    };
    const numericConstraintEvaluator = new NumericConstraintEvaluator({
      jsonLogicEvaluator,
      logger: mockLogger,
      goapEventDispatcher: fallbackEventDispatcher,
    });
    const mockSimulator = testBed.createMock('IPlanningEffectsSimulator', [
      'simulateEffects',
    ]);
    const heuristic = new GoalDistanceHeuristic({
      jsonLogicEvaluator,
      numericConstraintEvaluator,
      planningEffectsSimulator: mockSimulator,
      logger: mockLogger,
    });

    heuristic.calculate(
      {
        actor: {
          id: 'actor-2',
          components: {},
        },
      },
      {
        id: 'goal:eat',
        goalState: {
          '<=': [{ var: 'state.actor.components.core:needs.hunger' }, 10],
        },
      }
    );

    expect(fallbackEventDispatcher.dispatch).toHaveBeenCalledWith(
      GOAP_EVENTS.NUMERIC_CONSTRAINT_FALLBACK,
      expect.objectContaining({
        actorId: 'actor-2',
        goalId: 'goal:eat',
        origin: 'GoalDistanceHeuristic',
      })
    );
  });
});
