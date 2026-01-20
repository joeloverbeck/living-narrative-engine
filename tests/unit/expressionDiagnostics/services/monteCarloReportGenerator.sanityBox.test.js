/**
 * @file Unit tests for MonteCarloReportGenerator sanity box integration
 *
 * Tests that the sanity box section is properly included in generated reports:
 * - Section presence in output
 * - Correct placement after executive summary
 * - Integration with blockers data
 * - Handling of various simulation scenarios
 * @see replicated-riding-lerdorf.md (Expected Trigger Rate Sanity Box plan)
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import MonteCarloReportGenerator from '../../../../src/expressionDiagnostics/services/MonteCarloReportGenerator.js';

const createMockSimulationResult = (overrides = {}) => ({
  triggerRate: 0.15,
  triggerCount: 1500,
  sampleCount: 10000,
  confidenceInterval: { low: 0.14, high: 0.16 },
  distribution: 'uniform',
  clauseFailures: [],
  storedContexts: [],
  ...overrides,
});

const createMockBlocker = (overrides = {}) => ({
  clauseDescription: 'emotions.joy >= 0.5',
  failureRate: 0.85,
  averageViolation: 0.25,
  rank: 1,
  severity: 'high',
  nodeType: 'and',
  children: [
    {
      nodeType: 'leaf',
      clauseId: 'emotions.joy >= 0.5',
      inRegimePassRate: 0.15,
      failureRate: 0.85,
    },
  ],
  advancedAnalysis: {
    percentileAnalysis: {
      status: 'normal',
      insight: 'Distribution is normal',
    },
    nearMissAnalysis: {
      status: 'moderate',
      tunability: 'moderate',
      insight: 'Some near misses',
    },
    ceilingAnalysis: {
      status: 'achievable',
      achievable: true,
      headroom: 0.1,
      insight: 'Threshold is reachable',
    },
    lastMileAnalysis: {
      status: 'moderate',
      isDecisive: false,
      insight: 'Not decisive',
    },
    recommendation: {
      action: 'tune_threshold',
      priority: 'medium',
      message: 'Consider adjusting threshold',
    },
  },
  hierarchicalBreakdown: {
    variablePath: 'emotions.joy',
    comparisonOperator: '>=',
    thresholdValue: 0.5,
    violationP50: 0.15,
    violationP90: 0.4,
    nearMissRate: 0.05,
    nearMissEpsilon: 0.05,
    maxObservedValue: 0.6,
    ceilingGap: -0.1,
    lastMileFailRate: 0.3,
    othersPassedCount: 5000,
    isSingleClause: false,
  },
  ...overrides,
});

describe('MonteCarloReportGenerator - Sanity Box Integration', () => {
  let mockLogger;
  let prototypeConstraintAnalyzer;

  beforeEach(() => {
    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    };

    prototypeConstraintAnalyzer = {
      extractAxisConstraints: jest.fn(() => new Map()),
      analyzeEmotionThreshold: jest.fn(() => ({
        prototypeId: 'joy',
        type: 'emotion',
        threshold: 0.5,
        maxAchievable: 1,
        minAchievable: 0,
        weights: { valence: 1 },
        gates: [],
        gateStatus: { allSatisfiable: true, gates: [] },
        bindingAxes: [],
        axisAnalysis: [],
        sumAbsWeights: 1,
        requiredRawSum: 0.5,
        explanation: 'Test analysis',
      })),
    };
  });

  it('should include sanity box section in generated report', () => {
    const generator = new MonteCarloReportGenerator({
      logger: mockLogger,
      prototypeConstraintAnalyzer,
    });

    const report = generator.generate({
      expressionName: 'test:expression',
      simulationResult: createMockSimulationResult(),
      blockers: [createMockBlocker()],
      summary: 'Test summary',
      prerequisites: [],
    });

    expect(report).toContain('## Independence Baseline Comparison');
  });

  it('should place sanity box after executive summary', () => {
    const generator = new MonteCarloReportGenerator({
      logger: mockLogger,
      prototypeConstraintAnalyzer,
    });

    const report = generator.generate({
      expressionName: 'test:expression',
      simulationResult: createMockSimulationResult(),
      blockers: [createMockBlocker()],
      summary: 'Test summary',
      prerequisites: [],
    });

    const execSummaryIndex = report.indexOf('## Executive Summary');
    const sanityBoxIndex = report.indexOf('## Independence Baseline Comparison');
    const blockerIndex = report.indexOf('## Blocker Analysis');

    expect(sanityBoxIndex).toBeGreaterThan(execSummaryIndex);
    expect(sanityBoxIndex).toBeLessThan(blockerIndex);
  });

  it('should calculate expected hits from blockers', () => {
    const generator = new MonteCarloReportGenerator({
      logger: mockLogger,
      prototypeConstraintAnalyzer,
    });

    const blockers = [
      createMockBlocker({
        children: [
          {
            nodeType: 'leaf',
            clauseId: 'clause1',
            inRegimePassRate: 0.001,
          },
        ],
      }),
    ];

    const report = generator.generate({
      expressionName: 'test:expression',
      simulationResult: createMockSimulationResult({ sampleCount: 100000 }),
      blockers,
      summary: 'Test summary',
      prerequisites: [],
    });

    expect(report).toContain('Expected hits');
    expect(report).toContain('100,000');
  });

  it('should handle zero-hit simulation result', () => {
    const generator = new MonteCarloReportGenerator({
      logger: mockLogger,
      prototypeConstraintAnalyzer,
    });

    const report = generator.generate({
      expressionName: 'test:expression',
      simulationResult: createMockSimulationResult({
        triggerCount: 0,
        triggerRate: 0,
        sampleCount: 100000,
      }),
      blockers: [
        createMockBlocker({
          children: [
            {
              nodeType: 'leaf',
              clauseId: 'rare_clause',
              inRegimePassRate: 0.00001,
            },
          ],
        }),
      ],
      summary: 'Test summary',
      prerequisites: [],
    });

    expect(report).toContain('## Independence Baseline Comparison');
    expect(report).toContain('| Actual hits |');
    expect(report).toContain('| 0 |');
  });

  it('should handle high-hit simulation result', () => {
    const generator = new MonteCarloReportGenerator({
      logger: mockLogger,
      prototypeConstraintAnalyzer,
    });

    const report = generator.generate({
      expressionName: 'test:expression',
      simulationResult: createMockSimulationResult({
        triggerCount: 50000,
        triggerRate: 0.5,
        sampleCount: 100000,
      }),
      blockers: [
        createMockBlocker({
          children: [
            {
              nodeType: 'leaf',
              clauseId: 'common_clause',
              inRegimePassRate: 0.5,
            },
          ],
        }),
      ],
      summary: 'Test summary',
      prerequisites: [],
    });

    expect(report).toContain('## Independence Baseline Comparison');
    expect(report).toContain('Normal');
  });

  it('should include interpretation section', () => {
    const generator = new MonteCarloReportGenerator({
      logger: mockLogger,
      prototypeConstraintAnalyzer,
    });

    const report = generator.generate({
      expressionName: 'test:expression',
      simulationResult: createMockSimulationResult(),
      blockers: [createMockBlocker()],
      summary: 'Test summary',
      prerequisites: [],
    });

    expect(report).toContain('### Interpretation');
  });

  it('should include P(0 hits) in sanity box', () => {
    const generator = new MonteCarloReportGenerator({
      logger: mockLogger,
      prototypeConstraintAnalyzer,
    });

    const report = generator.generate({
      expressionName: 'test:expression',
      simulationResult: createMockSimulationResult({
        triggerCount: 0,
        sampleCount: 100000,
      }),
      blockers: [
        createMockBlocker({
          children: [
            {
              nodeType: 'leaf',
              clauseId: 'clause1',
              inRegimePassRate: 0.01,
            },
          ],
        }),
      ],
      summary: 'Test summary',
      prerequisites: [],
    });

    expect(report).toContain('P(0 hits');
  });

  it('should handle blockers with OR nodes', () => {
    const generator = new MonteCarloReportGenerator({
      logger: mockLogger,
      prototypeConstraintAnalyzer,
    });

    const blockers = [
      {
        nodeType: 'and',
        rank: 1,
        hierarchicalBreakdown: {
          nodeType: 'and',
          children: [
            {
              nodeType: 'or',
              id: 'mood_or',
              orUnionPassCount: 80,
              inRegimeEvaluationCount: 100,
              children: [
                { nodeType: 'leaf', clauseId: 'joy', inRegimePassRate: 0.5 },
                { nodeType: 'leaf', clauseId: 'happy', inRegimePassRate: 0.5 },
              ],
            },
            {
              nodeType: 'leaf',
              clauseId: 'intensity',
              inRegimePassRate: 0.8,
            },
          ],
        },
        advancedAnalysis: {
          percentileAnalysis: { status: 'normal', insight: 'Normal' },
          nearMissAnalysis: { status: 'low', tunability: 'low', insight: '' },
          ceilingAnalysis: { status: 'achievable', achievable: true, headroom: 0.1, insight: '' },
          lastMileAnalysis: { status: 'low', isDecisive: false, insight: '' },
          recommendation: { action: 'none', priority: 'low', message: '' },
        },
      },
    ];

    const report = generator.generate({
      expressionName: 'test:expression',
      simulationResult: createMockSimulationResult(),
      blockers,
      summary: 'Test summary',
      prerequisites: [],
    });

    expect(report).toContain('## Independence Baseline Comparison');
    expect(report).toContain('OR Block');
  });

  it('should handle nested AND blockers', () => {
    const generator = new MonteCarloReportGenerator({
      logger: mockLogger,
      prototypeConstraintAnalyzer,
    });

    const blockers = [
      {
        nodeType: 'and',
        rank: 1,
        hierarchicalBreakdown: {
          nodeType: 'and',
          children: [
            {
              nodeType: 'and',
              children: [
                { nodeType: 'leaf', clauseId: 'nested1', inRegimePassRate: 0.9 },
                { nodeType: 'leaf', clauseId: 'nested2', inRegimePassRate: 0.8 },
              ],
            },
            {
              nodeType: 'leaf',
              clauseId: 'top_level',
              inRegimePassRate: 0.7,
            },
          ],
        },
        advancedAnalysis: {
          percentileAnalysis: { status: 'normal', insight: 'Normal' },
          nearMissAnalysis: { status: 'low', tunability: 'low', insight: '' },
          ceilingAnalysis: { status: 'achievable', achievable: true, headroom: 0.1, insight: '' },
          lastMileAnalysis: { status: 'low', isDecisive: false, insight: '' },
          recommendation: { action: 'none', priority: 'low', message: '' },
        },
      },
    ];

    const report = generator.generate({
      expressionName: 'test:expression',
      simulationResult: createMockSimulationResult(),
      blockers,
      summary: 'Test summary',
      prerequisites: [],
    });

    expect(report).toContain('## Independence Baseline Comparison');
    expect(report).toContain('nested1');
    expect(report).toContain('nested2');
    expect(report).toContain('top_level');
  });
});
