/**
 * @file Integration tests pinning GateEvaluator behavior before refactoring.
 * @see reports/monte-carlo-simulator-architecture-refactoring.md
 */

import { describe, it, expect, jest } from '@jest/globals';
import InMemoryDataRegistry from '../../../src/data/inMemoryDataRegistry.js';
import MonteCarloSimulator from '../../../src/expressionDiagnostics/services/MonteCarloSimulator.js';
import EmotionCalculatorAdapter from '../../../src/expressionDiagnostics/adapters/EmotionCalculatorAdapter.js';
import EmotionCalculatorService from '../../../src/emotions/emotionCalculatorService.js';
import {
  gateClampPlanExpression,
  gateCompatibilityExpression,
  gateOutcomeExpression,
  gateEvaluationPrototypes,
} from '../../fixtures/expressionDiagnostics/gateEvaluationFixtures.js';

const createLogger = () => ({
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
});

const createDataRegistry = (logger) => {
  const registry = new InMemoryDataRegistry({ logger });
  registry.store('lookups', 'core:emotion_prototypes', {
    id: 'core:emotion_prototypes',
    entries: gateEvaluationPrototypes.emotions,
  });
  registry.store('lookups', 'core:sexual_prototypes', {
    id: 'core:sexual_prototypes',
    entries: gateEvaluationPrototypes.sexualStates,
  });
  return registry;
};

const buildEmotionCalculatorAdapter = (dataRegistry, logger) =>
  new EmotionCalculatorAdapter({
    emotionCalculatorService: new EmotionCalculatorService({
      dataRegistry,
      logger,
    }),
    logger,
  });

const buildRandomStateGenerator = (samples) => {
  let index = 0;
  return {
    generate: jest.fn(() => {
      const sample = samples[Math.min(index, samples.length - 1)];
      index += 1;
      return sample;
    }),
  };
};

const buildSimulator = ({ samples }) => {
  const logger = createLogger();
  const dataRegistry = createDataRegistry(logger);
  const emotionCalculatorAdapter = buildEmotionCalculatorAdapter(
    dataRegistry,
    logger
  );
  const randomStateGenerator = buildRandomStateGenerator(samples);

  const simulator = new MonteCarloSimulator({
    dataRegistry,
    logger,
    emotionCalculatorAdapter,
    randomStateGenerator,
  });

  return { simulator, logger };
};

const BASE_MOOD = {
  valence: 0,
  arousal: 0,
  agency_control: 0,
  threat: 0,
  engagement: 0,
  future_expectancy: 0,
  self_evaluation: 0,
  affiliation: 0,
  inhibitory_control: 0,
};

const BASE_SEXUAL = {
  sex_excitation: 0,
  sex_inhibition: 0,
  baseline_libido: 0,
};

const BASE_TRAITS = {
  affective_empathy: 50,
  cognitive_empathy: 50,
  harm_aversion: 50,
  self_control: 50,
};

const buildSample = ({
  mood = {},
  sexual = {},
  previousMood = {},
  previousSexual = {},
  affectTraits = {},
} = {}) => ({
  current: {
    mood: { ...BASE_MOOD, ...mood },
    sexual: { ...BASE_SEXUAL, ...sexual },
  },
  previous: {
    mood: { ...BASE_MOOD, ...previousMood },
    sexual: { ...BASE_SEXUAL, ...previousSexual },
  },
  affectTraits: { ...BASE_TRAITS, ...affectTraits },
});

describe('MonteCarloSimulator - Gate Evaluation Behavior', () => {
  it('builds gate clamp regime plan with prototype gate predicates', async () => {
    const sample = buildSample();
    const { simulator } = buildSimulator({ samples: [sample] });

    const result = await simulator.simulate(gateClampPlanExpression, {
      sampleCount: 1,
    });

    const { gateClampRegimePlan } = result;
    expect(gateClampRegimePlan.trackedGateAxes).toEqual([
      'sex_excitation',
      'threat',
    ]);

    const clauseGateEntries = Object.values(
      gateClampRegimePlan.clauseGateMap
    );
    expect(clauseGateEntries).toHaveLength(2);

    const joyGate = clauseGateEntries.find(
      (entry) => entry.prototypeId === 'joy'
    );
    expect(joyGate).toEqual({
      prototypeId: 'joy',
      type: 'emotion',
      usePrevious: false,
      gatePredicates: [
        {
          axis: 'threat',
          operator: '>=',
          thresholdNormalized: 0.7,
          thresholdRaw: 70,
        },
      ],
    });

    const arousedGate = clauseGateEntries.find(
      (entry) => entry.prototypeId === 'aroused'
    );
    expect(arousedGate).toEqual({
      prototypeId: 'aroused',
      type: 'sexual',
      usePrevious: false,
      gatePredicates: [
        {
          axis: 'sex_excitation',
          operator: '>=',
          thresholdNormalized: 0.6,
          thresholdRaw: 60,
        },
      ],
    });
  });

  it('computes gate compatibility against mood regime constraints', async () => {
    const sample = buildSample();
    const { simulator } = buildSimulator({ samples: [sample] });

    const result = await simulator.simulate(gateCompatibilityExpression, {
      sampleCount: 1,
    });

    const { gateCompatibility } = result;
    expect(gateCompatibility.emotions.serenity).toEqual({
      compatible: true,
      reason: null,
    });
    expect(gateCompatibility.emotions.panic.compatible).toBe(false);
    expect(gateCompatibility.emotions.panic.reason).toContain(
      'conflicts with mood regime valence'
    );
  });

  it('records gate outcomes and lost passes for gated leaf clauses', async () => {
    const samples = [
      buildSample({ mood: { valence: 60, threat: 80 } }),
      buildSample({ mood: { valence: 60, threat: 10 } }),
    ];
    const { simulator } = buildSimulator({ samples });

    const result = await simulator.simulate(gateOutcomeExpression, {
      sampleCount: 2,
    });

    expect(result.clauseFailures).toHaveLength(1);
    const [clause] = result.clauseFailures;

    expect(clause.gatePassInRegimeCount).toBe(1);
    expect(clause.gateFailInRegimeCount).toBe(1);
    expect(clause.gatePassRateInRegime).toBeCloseTo(0.5, 6);
    expect(clause.gatePassAndClausePassInRegimeCount).toBe(1);
    expect(clause.gatePassAndClauseFailInRegimeCount).toBe(0);
    expect(clause.rawPassInRegimeCount).toBe(2);
    expect(clause.lostPassInRegimeCount).toBe(1);
    expect(clause.lostPassRateInRegime).toBeCloseTo(0.5, 6);
  });
});
