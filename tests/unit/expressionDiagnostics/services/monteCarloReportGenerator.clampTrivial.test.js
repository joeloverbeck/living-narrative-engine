/**
 * @file Unit tests for clamp-trivial labeling and ranking in MonteCarloReportGenerator.
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import MonteCarloReportGenerator from '../../../../src/expressionDiagnostics/services/MonteCarloReportGenerator.js';

const createMockSimulationResult = (overrides = {}) => ({
  triggerRate: 0.1,
  triggerCount: 100,
  sampleCount: 1000,
  confidenceInterval: { low: 0.08, high: 0.12 },
  distribution: 'uniform',
  clauseFailures: [],
  storedContexts: [],
  ...overrides,
});

const createClampTrivialLeaf = () => ({
  nodeType: 'leaf',
  isCompound: false,
  description: 'emotions.joy <= 0.1',
  variablePath: 'emotions.joy',
  comparisonOperator: '<=',
  thresholdValue: 0.1,
  failureRate: 0.9,
  evaluationCount: 100,
  inRegimeEvaluationCount: 50,
  inRegimeFailureCount: 50,
  inRegimeFailureRate: 1,
  inRegimeMaxObservedValue: 0,
  minObservedValue: 0,
  gatePassRateInRegime: 0,
  gatePassInRegimeCount: 0,
  gateFailInRegimeCount: 50,
  gateClampRateInRegime: 1,
  passRateGivenGateInRegime: null,
  inRegimePassRate: 0,
  lastMileFailRate: 0.8,
  othersPassedCount: 40,
});

const createNonClampLeaf = () => ({
  nodeType: 'leaf',
  isCompound: false,
  description: 'emotions.sadness >= 0.5',
  variablePath: 'emotions.sadness',
  comparisonOperator: '>=',
  thresholdValue: 0.5,
  failureRate: 0.6,
  evaluationCount: 100,
  inRegimeEvaluationCount: 50,
  inRegimeFailureCount: 20,
  inRegimeFailureRate: 0.4,
  inRegimeMaxObservedValue: 0.9,
  maxObservedValue: 0.9,
  gatePassRateInRegime: 0.4,
  gatePassInRegimeCount: 20,
  gateFailInRegimeCount: 30,
  gateClampRateInRegime: 0.6,
  passRateGivenGateInRegime: 0.5,
  inRegimePassRate: 0.6,
  lastMileFailRate: 0.2,
  othersPassedCount: 40,
});

const createBlocker = (overrides = {}) => {
  const clampLeaf = createClampTrivialLeaf();
  const nonClampLeaf = createNonClampLeaf();

  return {
    clauseDescription: 'emotions.joy <= 0.1 AND emotions.sadness >= 0.5',
    failureRate: 0.75,
    averageViolation: 0.3,
    rank: 1,
    severity: 'high',
    advancedAnalysis: {
      percentileAnalysis: { status: 'normal', insight: 'ok' },
      nearMissAnalysis: { status: 'moderate', tunability: 'moderate', insight: 'ok' },
      ceilingAnalysis: { status: 'achievable', achievable: true, headroom: 0.1, insight: 'ok' },
      lastMileAnalysis: { status: 'moderate', isDecisive: false, insight: 'ok' },
      recommendation: { action: 'tune_threshold', priority: 'medium', message: 'ok' },
    },
    hierarchicalBreakdown: {
      nodeType: 'and',
      isCompound: true,
      children: [clampLeaf, nonClampLeaf],
    },
    worstOffenders: [
      { description: clampLeaf.description, failureRate: clampLeaf.failureRate },
      { description: nonClampLeaf.description, failureRate: nonClampLeaf.failureRate },
    ],
    ...overrides,
  };
};

describe('MonteCarloReportGenerator clamp-trivial labeling', () => {
  let mockLogger;

  beforeEach(() => {
    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    };
  });

  it('labels clamp-trivial leaves in the breakdown table', () => {
    const generator = new MonteCarloReportGenerator({ logger: mockLogger });
    const report = generator.generate({
      expressionName: 'test:expression',
      simulationResult: createMockSimulationResult(),
      blockers: [createBlocker()],
      summary: 'Test summary',
      prerequisites: [],
    });

    expect(report).toContain('Clamp-trivial (regime)');
    expect(report).toContain('Trivially satisfied (clamped)');
  });

  it('excludes clamp-trivial clauses from worst-offender analysis by default', () => {
    const generator = new MonteCarloReportGenerator({ logger: mockLogger });
    const report = generator.generate({
      expressionName: 'test:expression',
      simulationResult: createMockSimulationResult(),
      blockers: [createBlocker()],
      summary: 'Test summary',
      prerequisites: [],
    });

    const offenderSection = report.split('#### Worst Offender Analysis')[1] ?? '';
    expect(offenderSection).toContain('emotions.sadness >= 0.5');
    expect(offenderSection).not.toContain('emotions.joy <= 0.1');
  });

  it('includes clamp-trivial clauses in worst-offender analysis when opted in', () => {
    const generator = new MonteCarloReportGenerator({ logger: mockLogger });
    const report = generator.generate({
      expressionName: 'test:expression',
      simulationResult: createMockSimulationResult(),
      blockers: [createBlocker({ includeClampTrivialOffenders: true })],
      summary: 'Test summary',
      prerequisites: [],
    });

    const offenderSection = report.split('#### Worst Offender Analysis')[1] ?? '';
    expect(offenderSection).toContain('emotions.joy <= 0.1');
    expect(offenderSection).toContain('emotions.sadness >= 0.5');
  });
});
