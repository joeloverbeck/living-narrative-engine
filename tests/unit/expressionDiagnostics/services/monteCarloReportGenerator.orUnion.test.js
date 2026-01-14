/**
 * @file Unit tests for MonteCarloReportGenerator OR union pass rates.
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import MonteCarloReportGenerator from '../../../../src/expressionDiagnostics/services/MonteCarloReportGenerator.js';

const createMockSimulationResult = (overrides = {}) => ({
  triggerRate: 0.1,
  triggerCount: 10,
  sampleCount: 100,
  confidenceInterval: { low: 0.05, high: 0.15 },
  distribution: 'uniform',
  clauseFailures: [],
  storedContexts: [],
  ...overrides,
});

const createOrBreakdown = () => ({
  nodeType: 'and',
  isCompound: true,
  children: [
    {
      nodeType: 'or',
      isCompound: true,
      evaluationCount: 100,
      failureCount: 20,
      failureRate: 0.9,
      inRegimeEvaluationCount: 40,
      inRegimeFailureCount: 10,
      inRegimeFailureRate: 0.5,
      children: [
        {
          nodeType: 'leaf',
          description: 'alt A',
          failureRate: 0.5,
          evaluationCount: 100,
          inRegimeFailureRate: 0.4,
        },
        {
          nodeType: 'leaf',
          description: 'alt B',
          failureRate: 0.5,
          evaluationCount: 100,
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
  hierarchicalBreakdown: createOrBreakdown(),
  ...overrides,
});

describe('MonteCarloReportGenerator OR union rates', () => {
  let mockLogger;

  beforeEach(() => {
    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    };
  });

  it('uses OR node union counts for combined pass/fail rates', () => {
    const generator = new MonteCarloReportGenerator({ logger: mockLogger });

    const report = generator.generate({
      expressionName: 'test:expression',
      simulationResult: createMockSimulationResult(),
      blockers: [createMockBlocker()],
      summary: 'Test summary',
      prerequisites: [],
    });

    expect(report).toContain('**Combined OR Block**: 80.00% pass rate');
    expect(report).toContain('Fail% global: 20.00%');
    expect(report).toContain('Fail% \\| mood-pass: 25.00%');
  });
});
