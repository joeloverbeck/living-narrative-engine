/**
 * @file Unit tests for MonteCarloReportGenerator report integrity warnings.
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
  maxAchievable: 0.2,
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

describe('MonteCarloReportGenerator report integrity warnings', () => {
  let mockLogger;

  beforeEach(() => {
    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    };
  });

  it('emits warnings and attaches them to the simulation result', () => {
    const gates = ['valence >= 0.9'];
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
        emotions: { joy: 0.7 },
      },
    ];

    const simulationResult = createMockSimulationResult({ storedContexts });

    const report = generator.generate({
      expressionName: 'test:expression',
      simulationResult,
      blockers: [createMockBlocker()],
      summary: 'Test summary',
      prerequisites: [],
    });

    const warningCodes = (simulationResult.reportIntegrityWarnings || []).map(
      (warning) => warning.code
    );

    expect(report).toContain('Report Integrity Warnings');
    expect(report).toContain('## Integrity Summary');
    expect(report).toContain('**Integrity warnings**: 4');
    expect(report).toContain('**Gate/final mismatches**: 3');
    expect(warningCodes).toEqual(
      expect.arrayContaining([
        'I1_GATE_FAILED_NONZERO_FINAL',
        'I2_PASSRATE_EXCEEDS_GATEPASS',
        'I3_GATEPASS_ZERO_NONZERO_FINAL',
        'I4_OBSERVED_EXCEEDS_THEORETICAL',
      ])
    );
    expect(simulationResult.reportIntegrityWarnings[0]).toEqual(
      expect.objectContaining({
        code: expect.any(String),
        message: expect.any(String),
        populationHash: expect.any(String),
        signal: expect.any(String),
        prototypeId: 'joy',
        details: expect.any(Object),
      })
    );
    expect(simulationResult.reportIntegrityWarnings[0].details).toEqual(
      expect.objectContaining({
        sampleIndices: expect.arrayContaining([0]),
      })
    );
    expect(report).toContain('examples: index 0');
    expect(report).toContain('**Example indices**: 0');
    expect(report).toContain('Impact (full sample)');
  });

  it('renders cached integrity warnings and marks gate-dependent metrics as UNRELIABLE', () => {
    const generator = new MonteCarloReportGenerator({
      logger: mockLogger,
    });

    const simulationResult = createMockSimulationResult({
      storedContexts: [],
      reportIntegrityWarnings: [
        {
          code: 'I1_GATE_FAILED_NONZERO_FINAL',
          message: 'Gate failed but final intensity is non-zero in stored contexts.',
          populationHash: 'pop-123',
          prototypeId: 'joy',
        },
      ],
    });

    const report = generator.generate({
      expressionName: 'test:cached_warnings',
      simulationResult,
      blockers: [],
      summary: 'Test summary',
      prerequisites: [],
    });

    expect(report).toContain('Report Integrity Warnings');
    expect(report).toContain('I1_GATE_FAILED_NONZERO_FINAL');
    expect(report).toContain('Gate-dependent metrics');
    expect(report).toContain('UNRELIABLE');
  });

  it('includes non-monotonic sweep warnings in report output', () => {
    const generator = new MonteCarloReportGenerator({
      logger: mockLogger,
    });

    const simulationResult = createMockSimulationResult({
      storedContexts: [],
    });

    const sensitivityData = [
      {
        kind: 'marginalClausePassRateSweep',
        conditionPath: 'emotions.joy',
        operator: '>=',
        originalThreshold: 0.2,
        grid: [
          { threshold: 0.1, passRate: 0.6, sampleCount: 10 },
          { threshold: 0.2, passRate: 0.7, sampleCount: 10 },
          { threshold: 0.3, passRate: 0.5, sampleCount: 10 },
        ],
      },
    ];

    const report = generator.generate({
      expressionName: 'test:non_monotonic',
      simulationResult,
      blockers: [],
      summary: 'Test summary',
      prerequisites: [],
      sensitivityData,
      globalSensitivityData: [],
    });

    expect(report).toContain('> ⚠️ Sweep for emotions.joy is not non-increasing');
    expect(report).toContain('S4_SWEEP_NON_MONOTONIC');
  });
});
