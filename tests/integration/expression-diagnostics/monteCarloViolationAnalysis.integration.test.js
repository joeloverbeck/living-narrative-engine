/**
 * @file Integration tests pinning ViolationEstimator behavior before refactoring.
 * @see reports/monte-carlo-simulator-architecture-refactoring.md
 */

import { describe, it, expect, jest } from '@jest/globals';
import InMemoryDataRegistry from '../../../src/data/inMemoryDataRegistry.js';
import MonteCarloSimulator from '../../../src/expressionDiagnostics/services/MonteCarloSimulator.js';
import EmotionCalculatorAdapter from '../../../src/expressionDiagnostics/adapters/EmotionCalculatorAdapter.js';
import EmotionCalculatorService from '../../../src/emotions/emotionCalculatorService.js';
import {
  compoundCeilingExpression,
  failedLeavesLimitExpression,
  ltViolationExpression,
  lteViolationExpression,
  passingExpression,
  partialFailureExpression,
  rightSideVarViolationExpression,
  simpleViolationExpression,
  unknownVarViolationExpression,
} from '../../fixtures/expressionDiagnostics/violationAnalysisFixtures.js';
import {
  prototypeLookups,
} from '../../fixtures/expressionDiagnostics/contextBuildingFixtures.js';

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
    entries: prototypeLookups.emotions,
  });
  registry.store('lookups', 'core:sexual_prototypes', {
    id: 'core:sexual_prototypes',
    entries: prototypeLookups.sexualStates,
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
  valence: 60,
  arousal: 20,
  agency_control: 10,
  threat: 20,
  engagement: 10,
  future_expectancy: 10,
  self_evaluation: 10,
  affiliation: 10,
  inhibitory_control: 10,
};

const BASE_SEXUAL = {
  sex_excitation: 80,
  sex_inhibition: 20,
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

describe('MonteCarloSimulator - Violation Analysis Behavior', () => {
  it('estimates >= violations via leaf tracking', async () => {
    const sample = buildSample({ mood: { valence: 50 } });
    const { simulator } = buildSimulator({ samples: [sample] });

    const result = await simulator.simulate(simpleViolationExpression, {
      sampleCount: 1,
    });

    const clause = result.clauseFailures[0];
    expect(clause.failureCount).toBe(1);
    expect(clause.violationP50).toBeCloseTo(20, 5);
    expect(clause.ceilingGap).toBeCloseTo(20, 5);
    expect(clause.maxObserved).toBeCloseTo(50, 5);
    expect(clause.thresholdValue).toBe(70);
  });

  it('estimates <= violations via leaf tracking', async () => {
    const sample = buildSample({ mood: { threat: 40 } });
    const { simulator } = buildSimulator({ samples: [sample] });

    const result = await simulator.simulate(lteViolationExpression, {
      sampleCount: 1,
    });

    const clause = result.clauseFailures[0];
    expect(clause.failureCount).toBe(1);
    expect(clause.violationP50).toBeCloseTo(10, 5);
  });

  it('adds strict inequality offset for < failures', async () => {
    const sample = buildSample({ mood: { threat: 20 } });
    const { simulator } = buildSimulator({ samples: [sample] });

    const result = await simulator.simulate(ltViolationExpression, {
      sampleCount: 1,
    });

    const clause = result.clauseFailures[0];
    expect(clause.failureCount).toBe(1);
    expect(clause.violationP50).toBeCloseTo(10.01, 5);
  });

  it('includes actual/threshold/violation when operand is on the right', async () => {
    const sample = buildSample({ mood: { valence: 60 } });
    const { simulator } = buildSimulator({ samples: [sample] });

    const result = await simulator.simulate(rightSideVarViolationExpression, {
      sampleCount: 1,
    });

    const nearestMiss = result.witnessAnalysis.nearestMiss;
    expect(nearestMiss).not.toBeNull();
    expect(nearestMiss.failedLeafCount).toBe(1);
    expect(nearestMiss.failedLeaves).toHaveLength(1);

    const failedLeaf = nearestMiss.failedLeaves[0];
    expect(failedLeaf.description).toContain('moodAxes.valence');
    expect(failedLeaf.actual).toBe(60);
    expect(failedLeaf.threshold).toBe(50);
    expect(failedLeaf.violation).toBe(10);
  });

  it('caps failed leaves summary at five entries', async () => {
    const sample = buildSample({
      mood: {
        valence: 10,
        arousal: 10,
        agency_control: 0,
        threat: 10,
        engagement: 0,
        affiliation: 0,
      },
    });
    const { simulator } = buildSimulator({ samples: [sample] });

    const result = await simulator.simulate(failedLeavesLimitExpression, {
      sampleCount: 1,
    });

    const nearestMiss = result.witnessAnalysis.nearestMiss;
    expect(nearestMiss).not.toBeNull();
    expect(nearestMiss.failedLeafCount).toBe(6);
    expect(nearestMiss.failedLeaves).toHaveLength(5);
  });

  it('returns nulls when operands cannot be evaluated', async () => {
    const sample = buildSample();
    const { simulator } = buildSimulator({ samples: [sample] });

    const result = await simulator.simulate(unknownVarViolationExpression, {
      sampleCount: 1,
    });

    const nearestMiss = result.witnessAnalysis.nearestMiss;
    expect(nearestMiss).not.toBeNull();
    expect(nearestMiss.failedLeafCount).toBe(1);

    const failedLeaf = nearestMiss.failedLeaves[0];
    expect(failedLeaf.actual).toBeNull();
    expect(failedLeaf.threshold).toBeNull();
    expect(failedLeaf.violation).toBeNull();
  });

  it('counts failed leaves without AND/OR short-circuiting', async () => {
    const sample = buildSample({ mood: { valence: 80, threat: 30 } });
    const { simulator } = buildSimulator({ samples: [sample] });

    const result = await simulator.simulate(partialFailureExpression, {
      sampleCount: 1,
    });

    const nearestMiss = result.witnessAnalysis.nearestMiss;
    expect(nearestMiss).not.toBeNull();
    expect(nearestMiss.failedLeafCount).toBe(1);
    expect(nearestMiss.failedLeaves).toHaveLength(1);
    expect(nearestMiss.failedLeaves[0].description).toContain('moodAxes.threat');
  });

  it('chooses the worst ceiling gap from compound clauses', async () => {
    const sample = buildSample({ mood: { valence: 50, arousal: 10 } });
    const { simulator } = buildSimulator({ samples: [sample] });

    const result = await simulator.simulate(compoundCeilingExpression, {
      sampleCount: 1,
    });

    const clause = result.clauseFailures[0];
    expect(clause.ceilingGap).toBeCloseTo(50, 5);
    expect(clause.maxObserved).toBeCloseTo(10, 5);
    expect(clause.thresholdValue).toBe(60);
  });

  it('returns null violation percentiles when clauses always pass', async () => {
    const sample = buildSample({ mood: { valence: 60 } });
    const { simulator } = buildSimulator({ samples: [sample] });

    const result = await simulator.simulate(passingExpression, {
      sampleCount: 1,
    });

    const clause = result.clauseFailures[0];
    expect(clause.failureCount).toBe(0);
    expect(clause.violationP50).toBeNull();
    expect(clause.violationP90).toBeNull();
  });
});
