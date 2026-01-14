/**
 * @file Unit tests for MonteCarloSimulator OR overlap counters
 */

import { describe, it, expect, jest } from '@jest/globals';
import MonteCarloSimulator from '../../../../src/expressionDiagnostics/services/MonteCarloSimulator.js';

const buildSample = (mood) => ({
  current: { mood, sexual: {} },
  previous: { mood, sexual: {} },
  affectTraits: {},
});

const buildSimulator = (samples) => {
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
      const sample = samples[index];
      index += 1;
      return sample;
    }),
  };

  return new MonteCarloSimulator({
    dataRegistry: mockDataRegistry,
    logger: mockLogger,
    emotionCalculatorAdapter: mockEmotionCalculatorAdapter,
    randomStateGenerator: mockRandomStateGenerator,
  });
};

describe('MonteCarloSimulator - OR overlap counters', () => {
  it('tracks union, exclusive, and pairwise pass counts for global and in-regime populations', async () => {
    const samples = [
      buildSample({ valence: 10, joy: 0.8, fear: 0.2 }),
      buildSample({ valence: 5, joy: 0.7, fear: 0.7 }),
      buildSample({ valence: -10, joy: 0.7, fear: 0.7 }),
    ];
    const simulator = buildSimulator(samples);
    const expression = {
      id: 'expr:or-overlap',
      prerequisites: [
        {
          logic: {
            and: [
              { '>=': [{ var: 'moodAxes.valence' }, 0] },
              {
                or: [
                  { '>=': [{ var: 'emotions.joy' }, 0.5] },
                  { '>=': [{ var: 'emotions.fear' }, 0.5] },
                ],
              },
            ],
          },
        },
      ],
    };

    const result = await simulator.simulate(expression, {
      sampleCount: samples.length,
      validateVarPaths: false,
    });
    const breakdown = result.clauseFailures[0].hierarchicalBreakdown;
    const orNode = breakdown.children.find((child) => child.nodeType === 'or');

    expect(orNode.orUnionPassCount).toBe(3);
    expect(orNode.orUnionPassInRegimeCount).toBe(2);
    expect(orNode.orBlockExclusivePassCount).toBe(1);
    expect(orNode.orBlockExclusivePassInRegimeCount).toBe(1);
    expect(orNode.orPairPassCounts).toHaveLength(1);
    expect(orNode.orPairPassInRegimeCounts).toHaveLength(1);

    const leftId = orNode.children[0].id;
    const rightId = orNode.children[1].id;
    const pairEntry = orNode.orPairPassCounts.find(
      (pair) =>
        (pair.leftId === leftId && pair.rightId === rightId) ||
        (pair.leftId === rightId && pair.rightId === leftId)
    );
    const inRegimePairEntry = orNode.orPairPassInRegimeCounts.find(
      (pair) =>
        (pair.leftId === leftId && pair.rightId === rightId) ||
        (pair.leftId === rightId && pair.rightId === leftId)
    );

    expect(pairEntry?.passCount).toBe(2);
    expect(inRegimePairEntry?.passCount).toBe(1);
  });
});
