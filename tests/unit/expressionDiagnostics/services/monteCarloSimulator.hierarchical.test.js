/**
 * @file Unit tests for MonteCarloSimulator hierarchical clause tracking
 */

import { describe, it, expect, jest } from '@jest/globals';
import MonteCarloSimulator from '../../../../src/expressionDiagnostics/services/MonteCarloSimulator.js';

const buildSimulator = ({
  emotions = {},
  sexualStates = {},
  sexualArousal = 0,
  currentMood = {},
  currentSexual = {},
  previousMood = {},
  previousSexual = {},
  affectTraits = {},
} = {}) => {
  const mockLogger = {
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };

  const mockDataRegistry = {
    get: jest.fn(() => null),
  };

  const mockEmotionCalculatorAdapter = {
    calculateEmotions: jest.fn(() => emotions),
    calculateEmotionsFiltered: jest.fn(() => emotions),
    calculateEmotionTraces: jest.fn(() => ({})),
    calculateEmotionTracesFiltered: jest.fn(() => ({})),
    calculateSexualStateTraces: jest.fn(() => ({})),
    calculateSexualArousal: jest.fn(() => sexualArousal),
    calculateSexualStates: jest.fn(() => sexualStates),
  };

  const mockRandomStateGenerator = {
    generate: jest.fn(() => ({
      current: { mood: currentMood, sexual: currentSexual },
      previous: { mood: previousMood, sexual: previousSexual },
      affectTraits,
    })),
  };

  return new MonteCarloSimulator({
    dataRegistry: mockDataRegistry,
    logger: mockLogger,
    emotionCalculatorAdapter: mockEmotionCalculatorAdapter,
    randomStateGenerator: mockRandomStateGenerator,
  });
};

const runSimulation = async (simulator, expression, overrides = {}) =>
  simulator.simulate(expression, {
    sampleCount: 1,
    validateVarPaths: false,
    ...overrides,
  });

const countLeaves = (node) => {
  if (!node) return 0;
  if (node.nodeType === 'leaf') return 1;
  return node.children.reduce((sum, child) => sum + countLeaves(child), 0);
};

describe('MonteCarloSimulator - hierarchical clause tracking', () => {
  it('builds a leaf node with description and threshold metadata', async () => {
    const simulator = buildSimulator({ emotions: { joy: 0.8 } });
    const expression = {
      id: 'expr:leaf',
      prerequisites: [
        {
          logic: { '>': [{ var: 'emotions.joy' }, 0.5] },
        },
      ],
    };

    const result = await runSimulation(simulator, expression);
    const breakdown = result.clauseFailures[0].hierarchicalBreakdown;

    expect(breakdown.nodeType).toBe('leaf');
    expect(breakdown.description).toBe('emotions.joy > 0.5');
    expect(breakdown.thresholdValue).toBe(0.5);
    expect(breakdown.comparisonOperator).toBe('>');
    expect(breakdown.variablePath).toBe('emotions.joy');
    expect(breakdown.parentNodeType).toBe('root');
  });

  it('builds nested AND/OR structures with correct parent node types', async () => {
    const simulator = buildSimulator({ emotions: { joy: 0.8, fear: 0.2 } });
    const expression = {
      id: 'expr:nested',
      prerequisites: [
        {
          logic: {
            and: [
              { '>': [{ var: 'emotions.joy' }, 0.5] },
              {
                or: [
                  { '<': [{ var: 'emotions.fear' }, 0.3] },
                  { '>': [{ var: 'emotions.joy' }, 0.7] },
                ],
              },
            ],
          },
        },
      ],
    };

    const result = await runSimulation(simulator, expression);
    const breakdown = result.clauseFailures[0].hierarchicalBreakdown;

    expect(breakdown.nodeType).toBe('and');
    expect(breakdown.children).toHaveLength(2);
    expect(breakdown.children[0].nodeType).toBe('leaf');
    expect(breakdown.children[0].parentNodeType).toBe('and');
    expect(breakdown.children[1].nodeType).toBe('or');
    expect(breakdown.children[1].parentNodeType).toBe('and');
    expect(breakdown.children[1].children).toHaveLength(2);
    expect(breakdown.children[1].children[0].parentNodeType).toBe('or');
    expect(countLeaves(breakdown)).toBe(3);
  });

  it('tracks evaluation and sibling-conditioned failures for AND nodes', async () => {
    const simulator = buildSimulator({ emotions: { joy: 0.6, fear: 0.3 } });
    const expression = {
      id: 'expr:and-fail',
      prerequisites: [
        {
          logic: {
            and: [
              { '>=': [{ var: 'emotions.joy' }, 0.5] },
              { '<': [{ var: 'emotions.fear' }, 0.2] },
            ],
          },
        },
      ],
    };

    const result = await runSimulation(simulator, expression);
    const breakdown = result.clauseFailures[0].hierarchicalBreakdown;
    const [joyNode, fearNode] = breakdown.children;

    expect(breakdown.failureCount).toBe(1);
    expect(breakdown.evaluationCount).toBe(1);
    expect(joyNode.failureCount).toBe(0);
    expect(joyNode.evaluationCount).toBe(1);
    expect(fearNode.failureCount).toBe(1);
    expect(fearNode.evaluationCount).toBe(1);
    expect(fearNode.siblingsPassedCount).toBe(1);
    expect(fearNode.siblingConditionedFailCount).toBe(1);
    expect(joyNode.siblingsPassedCount).toBe(0);
  });

  it('tracks OR contribution counts when one branch passes', async () => {
    const simulator = buildSimulator({ emotions: { joy: 0.6, fear: 0.2 } });
    const expression = {
      id: 'expr:or',
      prerequisites: [
        {
          logic: {
            or: [
              { '>=': [{ var: 'emotions.joy' }, 0.5] },
              { '>=': [{ var: 'emotions.fear' }, 0.5] },
            ],
          },
        },
      ],
    };

    const result = await runSimulation(simulator, expression);
    const breakdown = result.clauseFailures[0].hierarchicalBreakdown;
    const [joyNode, fearNode] = breakdown.children;

    expect(breakdown.failureCount).toBe(0);
    expect(breakdown.evaluationCount).toBe(1);
    expect(joyNode.orSuccessCount).toBe(1);
    expect(joyNode.orContributionCount).toBe(1);
    expect(joyNode.orPassCount).toBe(1);
    expect(joyNode.orExclusivePassCount).toBe(1);
    expect(fearNode.orSuccessCount).toBe(1);
    expect(fearNode.orContributionCount).toBe(0);
    expect(fearNode.orPassCount).toBe(0);
    expect(fearNode.orExclusivePassCount).toBe(0);
  });

  it('selects the worst ceiling gap from compound clauses', async () => {
    const simulator = buildSimulator({ emotions: { joy: 0.4, fear: 0.2 } });
    const expression = {
      id: 'expr:ceiling',
      prerequisites: [
        {
          logic: {
            and: [
              { '>=': [{ var: 'emotions.joy' }, 0.9] },
              { '>=': [{ var: 'emotions.fear' }, 0.3] },
            ],
          },
        },
      ],
    };

    const result = await runSimulation(simulator, expression);
    const clause = result.clauseFailures[0];

    expect(clause.ceilingGap).toBeCloseTo(0.5, 5);
    expect(clause.maxObserved).toBeCloseTo(0.4, 5);
    expect(clause.thresholdValue).toBeCloseTo(0.9, 5);
  });

  it('records last-mile stats when other clauses pass', async () => {
    const simulator = buildSimulator({ emotions: { joy: 0.6, fear: 0.2 } });
    const expression = {
      id: 'expr:last-mile',
      prerequisites: [
        {
          logic: { '>=': [{ var: 'emotions.joy' }, 0.5] },
        },
        {
          logic: { '<': [{ var: 'emotions.fear' }, 0.1] },
        },
      ],
    };

    const result = await runSimulation(simulator, expression);
    const joyClause = result.clauseFailures.find(
      (clause) => clause.clauseIndex === 0
    );
    const fearClause = result.clauseFailures.find(
      (clause) => clause.clauseIndex === 1
    );

    expect(joyClause.lastMileFailRate).toBeNull();
    expect(joyClause.lastMileContext.othersPassedCount).toBe(0);
    expect(fearClause.lastMileFailRate).toBe(1);
    expect(fearClause.lastMileContext.othersPassedCount).toBe(1);
    expect(fearClause.lastMileContext.lastMileFailCount).toBe(1);
  });
});
