/**
 * @file Unit tests for MonteCarloSimulator ablation impact tracking.
 */

import { describe, it, expect, jest } from '@jest/globals';
import MonteCarloSimulator from '../../../../src/expressionDiagnostics/services/MonteCarloSimulator.js';

const buildSimulator = (sequence) => {
  const mockLogger = {
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };

  const mockDataRegistry = {
    get: jest.fn(() => null),
  };

  const mockEmotionCalculatorAdapter = {
    calculateEmotions: jest.fn((mood) => ({ ...mood })),
    calculateEmotionsFiltered: jest.fn((mood) => ({ ...mood })),
    calculateEmotionTraces: jest.fn(() => ({})),
    calculateEmotionTracesFiltered: jest.fn(() => ({})),
    calculateSexualStateTraces: jest.fn(() => ({})),
    calculateSexualArousal: jest.fn(() => 0),
    calculateSexualStates: jest.fn(() => ({})),
  };

  let index = 0;
  const mockRandomStateGenerator = {
    generate: jest.fn(() => {
      const next = sequence[Math.min(index, sequence.length - 1)];
      index += 1;
      return next;
    }),
  };

  return new MonteCarloSimulator({
    dataRegistry: mockDataRegistry,
    logger: mockLogger,
    emotionCalculatorAdapter: mockEmotionCalculatorAdapter,
    randomStateGenerator: mockRandomStateGenerator,
  });
};

const buildSample = (mood) => ({
  current: { mood, sexual: {} },
  previous: { mood, sexual: {} },
  affectTraits: {},
});

describe('MonteCarloSimulator - ablation impact', () => {
  it('computes deterministic ablation impact and choke ranks', async () => {
    const samples = [
      buildSample({ joy: 0.4, fear: 0.3, sadness: 0.4 }),
      buildSample({ joy: 0.6, fear: 0.1, sadness: 0.2 }),
      buildSample({ joy: 0.6, fear: 0.3, sadness: 0.4 }),
    ];

    const simulator = buildSimulator(samples);
    const expression = {
      id: 'expr:ablation',
      prerequisites: [
        {
          logic: {
            and: [
              { '>=': [{ var: 'emotions.joy' }, 0.5] },
              { '>=': [{ var: 'emotions.fear' }, 0.2] },
            ],
          },
        },
        {
          logic: {
            '>=': [{ var: 'emotions.sadness' }, 0.3],
          },
        },
      ],
    };

    const result = await simulator.simulate(expression, {
      sampleCount: samples.length,
      validateVarPaths: false,
    });

    const ablationImpact = result.ablationImpact;
    expect(ablationImpact).not.toBeNull();
    expect(ablationImpact.originalPassRate).toBeCloseTo(1 / 3, 6);

    const byClauseId = Object.fromEntries(
      ablationImpact.clauseImpacts.map((entry) => [entry.clauseId, entry])
    );

    expect(byClauseId['var:emotions.joy:>=:0.5'].passWithoutRate).toBeCloseTo(
      2 / 3,
      6
    );
    expect(byClauseId['var:emotions.joy:>=:0.5'].impact).toBeCloseTo(1 / 3, 6);
    expect(byClauseId['var:emotions.fear:>=:0.2'].impact).toBeCloseTo(0, 6);
    expect(byClauseId['var:emotions.sadness:>=:0.3'].impact).toBeCloseTo(0, 6);

    for (const entry of ablationImpact.clauseImpacts) {
      expect(entry.passWithoutRate).toBeGreaterThanOrEqual(
        ablationImpact.originalPassRate
      );
    }

    expect(ablationImpact.clauseImpacts[0].clauseId).toBe(
      'var:emotions.joy:>=:0.5'
    );
    expect(ablationImpact.clauseImpacts[1].clauseId).toBe(
      'var:emotions.fear:>=:0.2'
    );
    expect(ablationImpact.clauseImpacts[2].clauseId).toBe(
      'var:emotions.sadness:>=:0.3'
    );
    expect(ablationImpact.clauseImpacts[0].chokeRank).toBe(1);
    expect(ablationImpact.clauseImpacts[1].chokeRank).toBe(2);

    const topLevelByIndex = Object.fromEntries(
      ablationImpact.topLevelImpacts.map((entry) => [
        entry.clauseIndex,
        entry,
      ])
    );
    expect(topLevelByIndex[0].passWithoutRate).toBeCloseTo(2 / 3, 6);
    expect(topLevelByIndex[0].impact).toBeCloseTo(1 / 3, 6);
    expect(topLevelByIndex[1].passWithoutRate).toBeCloseTo(1 / 3, 6);
    expect(topLevelByIndex[1].impact).toBeCloseTo(0, 6);
  });
});
