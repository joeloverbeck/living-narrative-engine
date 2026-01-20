/**
 * @file Unit tests for MonteCarloReportGenerator probability funnel.
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import MonteCarloReportGenerator from '../../../../src/expressionDiagnostics/services/MonteCarloReportGenerator.js';

const createMockSimulationResult = (overrides = {}) => ({
  triggerRate: 0.04,
  triggerCount: 40,
  sampleCount: 1000,
  inRegimeSampleCount: 200,
  confidenceInterval: { low: 0.02, high: 0.06 },
  distribution: 'uniform',
  clauseFailures: [],
  storedContexts: [],
  ablationImpact: {
    clauseImpacts: [
      {
        clauseId: 'clause-a',
        impact: 0.2,
      },
      {
        clauseId: 'clause-b',
        impact: 0.1,
      },
    ],
  },
  ...overrides,
});

const createHierarchy = () => ({
  nodeType: 'and',
  isCompound: true,
  children: [
    {
      nodeType: 'leaf',
      clauseId: 'clause-a',
      description: 'emotions.joy >= 0.5',
      comparisonOperator: '>=',
      thresholdValue: 0.5,
      variablePath: 'emotions.joy',
      gatePassInRegimeCount: 120,
      gatePassAndClausePassInRegimeCount: 60, // 50% of gate-passers also pass threshold
      inRegimeEvaluationCount: 200,
      failureRate: 0.6,
      inRegimeFailureRate: 0.5,
    },
    {
      nodeType: 'leaf',
      clauseId: 'clause-b',
      description: 'emotions.sadness >= 0.3',
      comparisonOperator: '>=',
      thresholdValue: 0.3,
      variablePath: 'emotions.sadness',
      gatePassInRegimeCount: 80,
      gatePassAndClausePassInRegimeCount: 56, // 70% of gate-passers also pass threshold
      inRegimeEvaluationCount: 200,
      failureRate: 0.4,
      inRegimeFailureRate: 0.3,
    },
    {
      nodeType: 'or',
      id: 'or-1',
      isCompound: true,
      evaluationCount: 1000,
      failureCount: 600,
      inRegimeEvaluationCount: 200,
      inRegimeFailureCount: 120,
      children: [
        {
          nodeType: 'leaf',
          description: 'alt A',
          failureRate: 0.5,
          evaluationCount: 1000,
          inRegimeFailureRate: 0.4,
        },
        {
          nodeType: 'leaf',
          description: 'alt B',
          failureRate: 0.5,
          evaluationCount: 1000,
          inRegimeFailureRate: 0.4,
        },
      ],
    },
  ],
});

const createMockBlocker = (overrides = {}) => ({
  clauseDescription: 'compound clause',
  failureRate: 0.2,
  rank: 1,
  severity: 'high',
  advancedAnalysis: {
    percentileAnalysis: { status: 'normal', insight: 'ok' },
    nearMissAnalysis: { status: 'low', tunability: 'low', insight: 'ok' },
    ceilingAnalysis: {
      status: 'achievable',
      achievable: true,
      headroom: 0.1,
      insight: 'ok',
    },
    lastMileAnalysis: { status: 'low', isDecisive: false, insight: 'ok' },
    recommendation: { action: 'none', priority: 'low', message: 'ok' },
  },
  hierarchicalBreakdown: createHierarchy(),
  ...overrides,
});

describe('MonteCarloReportGenerator probability funnel', () => {
  let mockLogger;

  beforeEach(() => {
    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    };
  });

  it('adds a probability funnel section with key drop-offs', () => {
    const generator = new MonteCarloReportGenerator({ logger: mockLogger });

    const report = generator.generate({
      expressionName: 'test:expression',
      simulationResult: createMockSimulationResult(),
      blockers: [createMockBlocker()],
      summary: 'Test summary',
      prerequisites: [],
    });

    expect(report).toContain('### Probability Funnel');
    expect(report).toContain('- **Full sample**: 1,000');
    expect(report).toContain('- **Mood-regime pass**: 20.00% (200 / 1000)');
    // New format: separate gate pass and threshold pass lines (Change A)
    expect(report).toContain(
      '- **Prototype gate pass (`joy`)**: 60.00% (120 / 200)'
    );
    expect(report).toContain(
      '- **Threshold pass | gate (`emotions.joy >= 0.5`)**: 50.00% (60 / 120)'
    );
    expect(report).toContain(
      '- **Prototype gate pass (`sadness`)**: 40.00% (80 / 200)'
    );
    expect(report).toContain(
      '- **Threshold pass | gate (`emotions.sadness >= 0.3`)**: 70.00% (56 / 80)'
    );
    expect(report).toContain(
      '- **OR union pass | mood-pass (OR Block #1)**: 40.00% (80 / 200)'
    );
    expect(report).toContain('- **Final trigger**: 4.00% (40 / 1000)');
  });
});
