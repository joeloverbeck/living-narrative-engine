/**
 * @file Integration tests pinning ExpressionEvaluator behavior before refactoring.
 * @see reports/monte-carlo-simulator-architecture-refactoring.md
 */

import { describe, it, expect, jest } from '@jest/globals';
import InMemoryDataRegistry from '../../../src/data/inMemoryDataRegistry.js';
import MonteCarloSimulator from '../../../src/expressionDiagnostics/services/MonteCarloSimulator.js';
import EmotionCalculatorAdapter from '../../../src/expressionDiagnostics/adapters/EmotionCalculatorAdapter.js';
import EmotionCalculatorService from '../../../src/emotions/emotionCalculatorService.js';
import {
  operatorExpressions,
  prerequisiteAndExpression,
  orExpression,
  variableResolutionExpression,
  emptyPrereqsExpression,
  undefinedVarExpression,
} from '../../fixtures/expressionDiagnostics/expressionEvaluationFixtures.js';
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
  arousal: 10,
  agency_control: 0,
  threat: 20,
  engagement: 0,
  future_expectancy: 0,
  self_evaluation: 0,
  affiliation: 0,
  inhibitory_control: 0,
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

describe('MonteCarloSimulator - Expression Evaluation Behavior', () => {
  it('evaluates >= comparison operator via JSON Logic', async () => {
    const sample = buildSample();
    const { simulator } = buildSimulator({ samples: [sample] });

    const result = await simulator.simulate(operatorExpressions.gte, {
      sampleCount: 1,
    });

    expect(result.triggerRate).toBe(1);
    expect(result.triggerCount).toBe(1);
    expect(result.clauseFailures).toHaveLength(1);
    expect(result.clauseFailures[0].failureRate).toBe(0);
  });

  it('evaluates <= comparison operator via JSON Logic', async () => {
    const sample = buildSample();
    const { simulator } = buildSimulator({ samples: [sample] });

    const result = await simulator.simulate(operatorExpressions.lte, {
      sampleCount: 1,
    });

    expect(result.triggerRate).toBe(1);
  });

  it('evaluates > comparison operator via JSON Logic', async () => {
    const sample = buildSample();
    const { simulator } = buildSimulator({ samples: [sample] });

    const result = await simulator.simulate(operatorExpressions.gt, {
      sampleCount: 1,
    });

    expect(result.triggerRate).toBe(1);
  });

  it('evaluates < comparison operator via JSON Logic', async () => {
    const sample = buildSample();
    const { simulator } = buildSimulator({ samples: [sample] });

    const result = await simulator.simulate(operatorExpressions.lt, {
      sampleCount: 1,
    });

    expect(result.triggerRate).toBe(1);
  });

  it('evaluates == comparison operator via JSON Logic', async () => {
    const sample = buildSample();
    const { simulator } = buildSimulator({ samples: [sample] });

    const result = await simulator.simulate(operatorExpressions.eq, {
      sampleCount: 1,
    });

    expect(result.triggerRate).toBe(1);
  });

  it('treats multiple prerequisites as AND and tracks clause failures', async () => {
    const sample = buildSample({ mood: { threat: 40 } });
    const { simulator } = buildSimulator({ samples: [sample] });

    const result = await simulator.simulate(prerequisiteAndExpression, {
      sampleCount: 1,
    });

    expect(result.triggerRate).toBe(0);
    expect(result.clauseFailures).toHaveLength(2);

    const firstClause = result.clauseFailures.find(
      (clause) => clause.clauseIndex === 0
    );
    const secondClause = result.clauseFailures.find(
      (clause) => clause.clauseIndex === 1
    );

    expect(firstClause).toEqual(
      expect.objectContaining({
        failureCount: 0,
        clauseDescription: expect.stringContaining('moodAxes.valence'),
      })
    );
    expect(secondClause).toEqual(
      expect.objectContaining({
        failureCount: 1,
        clauseDescription: expect.stringContaining('moodAxes.threat'),
      })
    );
  });

  it('builds hierarchical breakdown for compound logic', async () => {
    const sample = buildSample();
    const { simulator } = buildSimulator({ samples: [sample] });

    const result = await simulator.simulate(orExpression, { sampleCount: 1 });

    expect(result.clauseFailures).toHaveLength(1);
    expect(result.clauseFailures[0].hierarchicalBreakdown).toEqual(
      expect.objectContaining({
        nodeType: 'or',
        children: expect.any(Array),
      })
    );
    expect(result.clauseFailures[0].hierarchicalBreakdown.children).toHaveLength(
      2
    );
  });

  it('handles empty prerequisites as always true', async () => {
    const sample = buildSample();
    const { simulator } = buildSimulator({ samples: [sample] });

    const result = await simulator.simulate(emptyPrereqsExpression, {
      sampleCount: 1,
    });

    expect(result.triggerRate).toBe(1);
    expect(result.clauseFailures).toHaveLength(0);
  });

  it('treats undefined variables as false without throwing', async () => {
    const sample = buildSample();
    const { simulator } = buildSimulator({ samples: [sample] });

    const result = await simulator.simulate(undefinedVarExpression, {
      sampleCount: 1,
    });

    expect(result.triggerRate).toBe(0);
    expect(result.clauseFailures).toHaveLength(1);
    expect(result.clauseFailures[0].failureCount).toBe(1);
  });

  it('resolves mood, emotion, and sexual state variables', async () => {
    const sample = buildSample();
    const { simulator } = buildSimulator({ samples: [sample] });

    const result = await simulator.simulate(variableResolutionExpression, {
      sampleCount: 1,
    });

    expect(result.triggerRate).toBe(1);
    expect(result.clauseFailures).toHaveLength(1);
    expect(result.clauseFailures[0].failureCount).toBe(0);
  });
});
