/**
 * @file Unit tests for MonteCarloReportGenerator OR overlap section.
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
      id: 'or-1',
      evaluationCount: 100,
      failureCount: 20,
      inRegimeEvaluationCount: 40,
      inRegimeFailureCount: 10,
      orUnionPassCount: 80,
      orUnionPassInRegimeCount: 30,
      orBlockExclusivePassCount: 50,
      orBlockExclusivePassInRegimeCount: 10,
      orPairPassCounts: [
        { leftId: 'child-a', rightId: 'child-b', passCount: 20 },
      ],
      orPairPassInRegimeCounts: [
        { leftId: 'child-a', rightId: 'child-b', passCount: 5 },
      ],
      children: [
        {
          nodeType: 'leaf',
          id: 'child-a',
          description: 'alt A',
          failureRate: 0.5,
          evaluationCount: 100,
          inRegimeFailureRate: 0.4,
          orPassCount: 60,
          orExclusivePassCount: 30,
        },
        {
          nodeType: 'leaf',
          id: 'child-b',
          description: 'alt B',
          failureRate: 0.5,
          evaluationCount: 100,
          inRegimeFailureRate: 0.4,
          orPassCount: 40,
          orExclusivePassCount: 20,
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

describe('MonteCarloReportGenerator OR overlap section', () => {
  let mockLogger;

  beforeEach(() => {
    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    };
  });

  it('renders absolute union, exclusive, and overlap rates with top pair', () => {
    const generator = new MonteCarloReportGenerator({ logger: mockLogger });

    const report = generator.generate({
      expressionName: 'test:expression',
      simulationResult: createMockSimulationResult(),
      blockers: [createMockBlocker()],
      summary: 'Test summary',
      prerequisites: [],
    });

    expect(report).toContain('**OR Block #1 OR Overlap (absolute rates)**');
    expect(report).toContain('Global | 80.00% (80/100) | 50.00% (50/100) | 30.00% (30/100)');
    expect(report).toContain('Mood regime | 75.00% (30/40) | 25.00% (10/40) | 50.00% (20/40)');
    expect(report).toContain('`alt A` + `alt B` 20.00% (20/100)');
    expect(report).toContain('`alt A` + `alt B` 12.50% (5/40)');
  });
});
