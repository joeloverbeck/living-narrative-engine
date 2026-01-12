/**
 * @file Unit tests for MonteCarloReportGenerator gate normalization behavior.
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

const buildAnalysis = (gates) => ({
  prototypeId: 'joy',
  type: 'emotion',
  threshold: 0.5,
  maxAchievable: 1,
  minAchievable: 0,
  weights: { valence: 1 },
  gates,
  gateStatus: {
    allSatisfiable: true,
    gates: gates.map((gate) => ({
      gate,
      satisfiable: true,
      reason: 'ok',
    })),
  },
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

const extractGlobalGatePassRate = (report) => {
  const match = report.match(/\| Global \|[^\n]*\| ([0-9.]+%) \|/);
  return match ? match[1] : null;
};

const extractObservedFailRate = (report) => {
  const match = report.match(/\*\*Observed Fail Rate\*\*: ([0-9.]+%)/);
  return match ? match[1] : null;
};

describe('MonteCarloReportGenerator gate normalization', () => {
  let mockLogger;

  beforeEach(() => {
    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    };
  });

  it('uses normalized mood and trait axes for gate pass rate', () => {
    const gates = ['valence >= 0.9', 'affective_empathy >= 0.6'];
    const analysis = buildAnalysis(gates);

    const prototypeConstraintAnalyzer = {
      extractAxisConstraints: jest.fn(() => new Map()),
      analyzeEmotionThreshold: jest.fn(() => analysis),
    };

    const generator = new MonteCarloReportGenerator({
      logger: mockLogger,
      prototypeConstraintAnalyzer,
    });

    const storedContexts = [
      {
        moodAxes: { valence: 80 },
        sexualAxes: { sex_excitation: 0, sex_inhibition: 0, baseline_libido: 0 },
        sexualArousal: 0,
        affectTraits: {
          affective_empathy: 40,
          cognitive_empathy: 50,
          harm_aversion: 50,
        },
        emotions: { joy: 0.2 },
      },
      {
        moodAxes: { valence: 100 },
        sexualAxes: { sex_excitation: 0, sex_inhibition: 0, baseline_libido: 0 },
        sexualArousal: 0,
        affectTraits: {
          affective_empathy: 70,
          cognitive_empathy: 50,
          harm_aversion: 50,
        },
        emotions: { joy: 0.3 },
      },
    ];

    const report = generator.generate({
      expressionName: 'test:expression',
      simulationResult: createMockSimulationResult({ storedContexts }),
      blockers: [createMockBlocker()],
      summary: 'Test summary',
      prerequisites: [],
    });

    expect(extractGlobalGatePassRate(report)).toBe('50.00%');
  });

  it('uses sexual_arousal aliasing when computing gate failure rates', () => {
    const gates = ['SA >= 0.5'];
    const analysis = buildAnalysis(gates);

    const prototypeConstraintAnalyzer = {
      extractAxisConstraints: jest.fn(() => new Map()),
      analyzeEmotionThreshold: jest.fn(() => analysis),
    };

    const generator = new MonteCarloReportGenerator({
      logger: mockLogger,
      prototypeConstraintAnalyzer,
    });

    const storedContexts = [
      {
        moodAxes: { valence: 0 },
        sexualAxes: {
          sex_excitation: 70,
          sex_inhibition: 10,
          baseline_libido: 0,
        },
        affectTraits: {
          affective_empathy: 50,
          cognitive_empathy: 50,
          harm_aversion: 50,
        },
        emotions: { joy: 0.1 },
      },
      {
        moodAxes: { valence: 0 },
        sexualAxes: {
          sex_excitation: 30,
          sex_inhibition: 10,
          baseline_libido: 0,
        },
        affectTraits: {
          affective_empathy: 50,
          cognitive_empathy: 50,
          harm_aversion: 50,
        },
        emotions: { joy: 0.1 },
      },
    ];

    const report = generator.generate({
      expressionName: 'test:expression',
      simulationResult: createMockSimulationResult({ storedContexts }),
      blockers: [createMockBlocker()],
      summary: 'Test summary',
      prerequisites: [],
    });

    expect(extractObservedFailRate(report)).toBe('50.00%');
  });
});
