import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { createGoapTestSetup } from './testFixtures/goapTestSetup.js';
import GoalDistanceHeuristic from '../../../src/goap/planner/goalDistanceHeuristic.js';
import NumericConstraintEvaluator from '../../../src/goap/planner/numericConstraintEvaluator.js';

describe('GoalDistanceHeuristic integration contract', () => {
  let setup;
  let originalAdapterEnv;

  beforeEach(async () => {
    originalAdapterEnv = process.env.GOAP_NUMERIC_ADAPTER;
    process.env.GOAP_NUMERIC_ADAPTER = '1';
    setup = await createGoapTestSetup({ mockRefinement: true });
  });

  afterEach(async () => {
    if (typeof originalAdapterEnv === 'undefined') {
      delete process.env.GOAP_NUMERIC_ADAPTER;
    } else {
      process.env.GOAP_NUMERIC_ADAPTER = originalAdapterEnv;
    }
    await setup?.testBed?.cleanup?.();
  });

  it('emits dispatcher compliance data when numeric fallback occurs', () => {
    const numericConstraintEvaluator = new NumericConstraintEvaluator({
      jsonLogicEvaluator: setup.jsonLogicService,
      logger: setup.testBed.createMockLogger(),
      goapEventDispatcher: setup.goapEventDispatcher,
    });
    const heuristic = new GoalDistanceHeuristic({
      jsonLogicEvaluator: setup.jsonLogicService,
      numericConstraintEvaluator,
      planningEffectsSimulator: setup.effectsSimulator,
      logger: setup.testBed.createMockLogger(),
    });

    heuristic.calculate(
      {
        actor: {
          id: 'actor-contract',
          components: {},
        },
      },
      {
        id: 'goal:test',
        goalState: {
          '<=': [{ var: 'state.actor.components.core:needs.hunger' }, 20],
        },
      }
    );

    const compliance =
      setup.controller.getEventComplianceDiagnostics('actor-contract');
    expect(compliance).not.toBeNull();
    expect(compliance.actor).toEqual(
      expect.objectContaining({
        actorId: 'actor-contract',
        totalEvents: expect.any(Number),
      })
    );
    expect(compliance.actor.totalEvents).toBeGreaterThan(0);

    const numericDiagnostics =
      setup.controller.getNumericConstraintDiagnostics('actor-contract');
    expect(numericDiagnostics).not.toBeNull();
    expect(numericDiagnostics.totalFallbacks).toBe(1);
  });
});
