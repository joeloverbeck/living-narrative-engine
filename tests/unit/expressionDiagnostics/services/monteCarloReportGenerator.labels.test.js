/**
 * @file Unit tests for MonteCarloReportGenerator feasibility/regime labels.
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
  advancedAnalysis: {
    percentileAnalysis: { status: 'normal', insight: 'Distribution is normal' },
    nearMissAnalysis: { status: 'moderate', tunability: 'moderate', insight: 'Some near misses' },
    ceilingAnalysis: { status: 'achievable', achievable: true, headroom: 0.1, insight: 'Threshold is reachable' },
    lastMileAnalysis: { status: 'moderate', isDecisive: false, insight: 'Not decisive' },
    recommendation: { action: 'tune_threshold', priority: 'medium', message: 'Consider adjusting threshold' },
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

const buildAnalysis = () => ({
  prototypeId: 'joy',
  type: 'emotion',
  threshold: 0.5,
  maxAchievable: 1,
  minAchievable: 0,
  weights: { valence: 1 },
  gates: [],
  gateStatus: { allSatisfiable: true, gates: [] },
  bindingAxes: [],
  axisAnalysis: [
    {
      axis: 'valence',
      weight: 1,
      constraintMin: -1,
      constraintMax: 1,
      optimalValue: 1,
      contribution: 1,
      isBinding: false,
      conflictType: null,
    },
  ],
  sumAbsWeights: 1,
  requiredRawSum: 0.5,
  explanation: 'Test analysis',
});

describe('MonteCarloReportGenerator labels', () => {
  let mockLogger;

  beforeEach(() => {
    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    };
  });

  it('labels theoretical range and observed maxima in regime stats', () => {
    const prototypeConstraintAnalyzer = {
      extractAxisConstraints: jest.fn(() => new Map()),
      analyzeEmotionThreshold: jest.fn(() => buildAnalysis()),
    };

    const generator = new MonteCarloReportGenerator({
      logger: mockLogger,
      prototypeConstraintAnalyzer,
    });

    const storedContexts = [
      { moodAxes: { valence: 80 } },
      { moodAxes: { valence: 60 } },
    ];

    const report = generator.generate({
      expressionName: 'test:expression',
      simulationResult: createMockSimulationResult({ storedContexts }),
      blockers: [createMockBlocker()],
      summary: 'Test summary',
      prerequisites: [],
    });

    expect(report).toContain('**Theoretical range (mood constraints, AND-only)**');
    expect(report).toContain('**Observed max (global, final)**');
    expect(report).toContain('**Observed max (mood-regime, final)**');
  });
});
