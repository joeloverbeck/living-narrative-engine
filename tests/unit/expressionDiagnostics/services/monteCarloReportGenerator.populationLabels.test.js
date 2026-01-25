/**
 * @file Unit tests for MonteCarloReportGenerator population labeling
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import MonteCarloReportGenerator from '../../../../src/expressionDiagnostics/services/MonteCarloReportGenerator.js';

const createMockLogger = () => ({
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
});

const createPopulationSummary = (overrides = {}) => ({
  sampleCount: 100,
  inRegimeSampleCount: 10,
  inRegimeSampleRate: 0.1,
  storedContextCount: 20,
  storedContextLimit: 20,
  storedInRegimeCount: 2,
  storedInRegimeRate: 0.1,
  ...overrides,
});

const createStoredContexts = (count) =>
  Array.from({ length: count }, () => ({
    moodAxes: {
      valence: 20,
      threat: 0.2,
    },
    emotions: {
      joy: 0.5,
    },
    sexualStates: {},
  }));

describe('MonteCarloReportGenerator - Population Labels', () => {
  let logger;

  beforeEach(() => {
    logger = createMockLogger();
  });

  it('adds a population summary block with the stored-context cap note', () => {
    const generator = new MonteCarloReportGenerator({ logger });
    const populationSummary = createPopulationSummary({
      sampleCount: 100,
      storedContextCount: 20,
      storedContextLimit: 20,
    });
    const report = generator.generate({
      expressionName: 'test-expression',
      simulationResult: {
        sampleCount: 100,
        triggerRate: 0.1,
        confidenceInterval: { low: 0.05, high: 0.15 },
        distribution: 'uniform',
        samplingMode: 'static',
        samplingMetadata: {},
        storedContexts: [],
        populationSummary,
      },
      blockers: [],
      summary: 'Summary text',
    });

    expect(report).toContain('## Population Summary');
    expect(report).toContain('**Stored contexts**: 20 of 100');
    expect(report).toContain('Stored contexts are capped at 20');
    expect(report).toContain('**Mood regime**: Mood axis constraints derived from gates');
  });

  it('adds stored-context population labels to every stored-context section', () => {
    const prototypeConstraintAnalyzer = {
      extractAxisConstraints: jest
        .fn()
        .mockReturnValue(new Map([['valence', { min: -1, max: 1 }]])),
      analyzeEmotionThreshold: jest.fn((prototypeId, type, threshold) => ({
        prototypeId,
        type,
        threshold,
        maxAchievable: 1,
        minAchievable: 0,
        weights: { valence: 0.6, arousal: -0.2 },
        gates: ['threat >= 0.30'],
        gateStatus: {
          allSatisfiable: true,
          gates: [{ gate: 'threat >= 0.30', satisfiable: true, reason: 'ok' }],
        },
        bindingAxes: [],
        axisAnalysis: [
          {
            axis: 'valence',
            weight: 0.6,
            constraintMin: -1,
            constraintMax: 1,
            optimalValue: 0.5,
            contribution: 0.3,
            isBinding: false,
          },
        ],
        sumAbsWeights: 0.8,
        requiredRawSum: 0.5,
        explanation: 'ok',
        operator: '>=',
      })),
    };

    const prototypeFitRankingService = {
      analyzeAllPrototypeFit: jest.fn(() => ({
        leaderboard: [
          {
            rank: 1,
            prototypeId: 'joy',
            gatePassRate: 0.6,
            intensityDistribution: { pAboveThreshold: 0.2, p50: 0.5, p90: 0.7, p95: 0.8 },
            conflictScore: 0.1,
            compositeScore: 0.9,
            conflictingAxes: [],
            conflictMagnitude: 0,
          },
        ],
      })),
      computeImpliedPrototype: jest.fn(() => ({
        targetSignature: new Map([['valence', { direction: 1, importance: 0.8 }]]),
        bySimilarity: [
          {
            prototypeId: 'joy',
            cosineSimilarity: 0.9,
            gatePassRate: 0.6,
            combinedScore: 0.85,
          },
        ],
        byGatePass: [
          {
            prototypeId: 'joy',
            cosineSimilarity: 0.9,
            gatePassRate: 0.6,
            combinedScore: 0.85,
          },
        ],
        byCombined: [
          {
            prototypeId: 'joy',
            cosineSimilarity: 0.9,
            gatePassRate: 0.6,
            combinedScore: 0.85,
          },
        ],
      })),
      detectPrototypeGaps: jest.fn(() => ({
        gapDetected: false,
        nearestDistance: 0.2,
        distanceContext: 'ok',
        kNearestNeighbors: [
          {
            prototypeId: 'joy',
            combinedDistance: 0.2,
            weightDistance: 0.1,
            gateDistance: 0.1,
          },
        ],
      })),
    };

    const generator = new MonteCarloReportGenerator({
      logger,
      prototypeConstraintAnalyzer,
      prototypeFitRankingService,
    });

    const storedContexts = createStoredContexts(12);
    const populationSummary = createPopulationSummary({
      storedContextCount: 12,
      storedContextLimit: 20,
      storedInRegimeCount: 12,
      storedInRegimeRate: 1,
    });

    const report = generator.generate({
      expressionName: 'test-expression',
      simulationResult: {
        sampleCount: 100,
        triggerRate: 0.1,
        confidenceInterval: { low: 0.05, high: 0.15 },
        distribution: 'uniform',
        samplingMode: 'static',
        samplingMetadata: {},
        storedContexts,
        populationSummary,
        gateCompatibility: {
          emotions: {
            joy: { compatible: true },
          },
        },
      },
      blockers: [
        {
          clauseDescription: 'emotions.joy >= 0.9',
          failureRate: 0.2,
          averageViolation: 0.1,
          rank: 1,
          severity: 'high',
          hierarchicalBreakdown: {
            variablePath: 'emotions.joy',
            comparisonOperator: '>=',
            thresholdValue: 0.9,
            failureRate: 0.2,
            inRegimeFailureRate: 0.1,
            inRegimeFailureCount: 2,
            inRegimeEvaluationCount: 20,
            violationP50: 0.1,
            violationP90: 0.2,
            observedMin: 0,
            observedMean: 0.4,
            nearMissRate: 0.03,
            nearMissEpsilon: 0.01,
            lastMileFailRate: 0.2,
            othersPassedCount: 5,
          },
          advancedAnalysis: {
            percentileAnalysis: { insight: 'ok' },
            nearMissAnalysis: { tunability: 'moderate', insight: 'ok' },
            ceilingAnalysis: { status: 'achievable', achievable: true, headroom: 0.1, insight: 'ok' },
            lastMileAnalysis: { lastMileFailRate: 0.2, isDecisive: true, status: 'moderate', insight: 'ok' },
            recommendation: { action: 'tune_threshold', priority: 'low', message: 'ok' },
          },
        },
      ],
      summary: 'Summary text',
      prerequisites: [
        {
          logic: {
            and: [
              { '>=': [{ var: 'moodAxes.valence' }, 10] },
              { '>=': [{ var: 'emotions.joy' }, 0.5] },
            ],
          },
        },
      ],
      sensitivityData: [
        {
          kind: 'marginalClausePassRateSweep',
          conditionPath: 'emotions.joy',
          operator: '>=',
          originalThreshold: 0.5,
          grid: [
            { threshold: 0.5, passRate: 0.2, sampleCount: 12 },
            { threshold: 0.6, passRate: 0.1, sampleCount: 12 },
          ],
        },
      ],
      globalSensitivityData: [
        {
          kind: 'expressionTriggerRateSweep',
          varPath: 'emotions.joy',
          operator: '>=',
          originalThreshold: 0.5,
          grid: [
            { threshold: 0.5, triggerRate: 0.1, sampleCount: 100 },
            { threshold: 0.6, triggerRate: 0.05, sampleCount: 100 },
          ],
        },
      ],
    });

    // Change C: Population labels now use normalized types
    // - 'stored-global' becomes 'stored' (contains 'stored' but not 'mood'/'regime')
    // - 'stored-mood-regime' stays as 'stored-mood-regime' (contains 'mood' or 'regime')
    expect(report).toMatch(/## Conditional Pass Rates[\s\S]*\*\*Population\*\*: stored-mood-regime/);
    expect(report).toMatch(/## Last-Mile Decomposition[\s\S]*\*\*Population\*\*: stored/);
    expect(report).toMatch(/## Marginal Clause Pass-Rate Sweep[\s\S]*\*\*Population\*\*: stored/);
    expect(report).toMatch(/## Global Expression Sensitivity Analysis[\s\S]*\*\*Population\*\*: stored/);
    expect(report).toMatch(/## .*Prototype Fit Analysis[\s\S]*\*\*Population\*\*: stored-mood-regime/);
    expect(report).toMatch(/## .*Implied Prototype from Prerequisites[\s\S]*\*\*Population\*\*: stored-mood-regime/);
    expect(report).toMatch(/## .*Prototype Gap Detection[\s\S]*\*\*Population\*\*: stored-mood-regime/);
    expect(report).toMatch(/#### Prototype Math Analysis[\s\S]*\*\*Population\*\*: stored/);
  });
});
