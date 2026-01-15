/**
 * @file Integration tests for Monte Carlo report recommendations section.
 */

import { describe, it, expect, jest } from '@jest/globals';
import MonteCarloReportGenerator from '../../../src/expressionDiagnostics/services/MonteCarloReportGenerator.js';

const logger = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
};

const CLAUSE_ID = 'var:emotions.joy:>=:0.4';
const GATE_AXIS = 'valence';

function createSimulationResult(overrides = {}) {
  return {
    triggerRate: 0.1,
    triggerCount: 10,
    sampleCount: 100,
    confidenceInterval: { low: 0.08, high: 0.12 },
    distribution: 'uniform',
    samplingMode: 'uniform',
    inRegimeSampleCount: 80,
    storedContexts: [],
    clauseFailures: [],
    ...overrides,
  };
}

function createBlocker(overrides = {}) {
  return {
    clauseDescription: 'emotions.joy >= 0.4',
    failureRate: 0.6,
    averageViolation: 0.2,
    rank: 1,
    severity: 'high',
    hierarchicalBreakdown: {
      clauseId: 'var:emotions.joy:>=:0.4',
      variablePath: 'emotions.joy',
      comparisonOperator: '>=',
      thresholdValue: 0.4,
      inRegimeFailureRate: 0.5,
      averageViolation: 0.2,
      nearMissRate: 0.1,
    },
    ...overrides,
  };
}

function buildReservoirSamples({ sampleCount, passCount, threshold }) {
  const samples = [];
  const failCount = Math.max(sampleCount - passCount, 0);
  for (let i = 0; i < failCount; i += 1) {
    samples.push({ [GATE_AXIS]: threshold - 1 });
  }
  for (let i = 0; i < passCount; i += 1) {
    samples.push({ [GATE_AXIS]: threshold + 1 });
  }
  return samples.slice(0, sampleCount);
}

function buildHistogram({ sampleCount, passCount }) {
  const min = 0;
  const max = 100;
  const binCount = 11;
  const bins = Array(binCount).fill(0);
  const belowCount = Math.max(sampleCount - passCount, 0);
  const atCount = Math.min(10, passCount);
  const aboveCount = Math.max(passCount - atCount, 0);
  const belowBins = [0, 1, 2, 3];
  const atBin = 4;
  const aboveBins = [5, 6, 7, 8, 9, 10];

  for (let i = 0; i < belowCount; i += 1) {
    bins[belowBins[i % belowBins.length]] += 1;
  }
  bins[atBin] += atCount;
  for (let i = 0; i < aboveCount; i += 1) {
    bins[aboveBins[i % aboveBins.length]] += 1;
  }

  return {
    min,
    max,
    binCount,
    bins,
    sampleCount,
  };
}

function createGateClampSimulationResult({
  moodRegimeCount = 100,
  gatePassInRegimeCount = 60,
  gateFailInRegimeCount = 40,
  gateThreshold = 40,
} = {}) {
  const gateClampRateInRegime =
    moodRegimeCount > 0 ? gateFailInRegimeCount / moodRegimeCount : 0;
  const gatePassAndClausePassInRegimeCount = Math.round(
    gatePassInRegimeCount * 0.5
  );
  const reservoirSamples = buildReservoirSamples({
    sampleCount: moodRegimeCount,
    passCount: gatePassInRegimeCount,
    threshold: gateThreshold,
  });
  const histogram = buildHistogram({
    sampleCount: moodRegimeCount,
    passCount: gatePassInRegimeCount,
  });

  return createSimulationResult({
    inRegimeSampleCount: moodRegimeCount,
    clauseFailures: [
      {
        clauseDescription: 'emotions.joy >= 0.4',
        inRegimeFailureRate: gateClampRateInRegime,
        averageViolation: 0.1,
        hierarchicalBreakdown: {
          nodeType: 'leaf',
          clauseId: CLAUSE_ID,
          clauseType: 'threshold',
          description: 'emotions.joy >= 0.4',
          variablePath: 'emotions.joy',
          comparisonOperator: '>=',
          thresholdValue: 0.4,
          inRegimeFailureRate: gateClampRateInRegime,
          averageViolation: 0.1,
          siblingConditionedFailRate: 0.1,
          nearMissRate: 0.05,
          gatePassInRegimeCount,
          gatePassAndClausePassInRegimeCount,
          gateFailInRegimeCount,
          inRegimeEvaluationCount: moodRegimeCount,
          gateClampRateInRegime,
          rawPassInRegimeCount: gatePassInRegimeCount,
          lostPassInRegimeCount: Math.round(gatePassInRegimeCount * 0.1),
          lostPassRateInRegime: 0.1,
        },
      },
    ],
    ablationImpact: {
      clauseImpacts: [{ clauseId: CLAUSE_ID, impact: 0.12 }],
    },
    prototypeEvaluationSummary: {
      emotions: {
        joy: {
          moodSampleCount: moodRegimeCount,
          gatePassCount: gatePassInRegimeCount,
          gateFailCount: gateFailInRegimeCount,
          failedGateCounts: { 'valence >= 40': gateFailInRegimeCount },
          valueSumGivenGate: gatePassInRegimeCount * 0.6,
        },
      },
      sexualStates: {},
    },
    gateCompatibility: {
      emotions: {
        joy: { compatible: true, reason: 'ok' },
      },
      sexualStates: {},
    },
    gateClampRegimePlan: {
      gateClampConfig: { softAlignmentEnabled: false },
      clauseGateMap: {
        [CLAUSE_ID]: {
          gatePredicates: [
            {
              axis: GATE_AXIS,
              operator: '>=',
              thresholdRaw: gateThreshold,
              thresholdNormalized: gateThreshold / 100,
            },
          ],
        },
      },
      trackedGateAxes: [GATE_AXIS],
    },
    moodRegimeAxisHistograms: {
      [GATE_AXIS]: histogram,
    },
    moodRegimeSampleReservoir: {
      sampleCount: moodRegimeCount,
      samples: reservoirSamples,
    },
  });
}

describe('MonteCarloReportGenerator recommendations section', () => {
  it('renders recommendations with evidence, confidence, and anchors', () => {
    const simulationResult = createSimulationResult({
      clauseFailures: [
        {
          clauseDescription: 'emotions.joy >= 0.4',
          inRegimeFailureRate: 0.5,
          averageViolation: 0.1,
          hierarchicalBreakdown: {
            nodeType: 'leaf',
            clauseId: 'var:emotions.joy:>=:0.4',
            clauseType: 'threshold',
            description: 'emotions.joy >= 0.4',
            variablePath: 'emotions.joy',
            comparisonOperator: '>=',
            thresholdValue: 0.4,
            inRegimeFailureRate: 0.5,
            averageViolation: 0.1,
            siblingConditionedFailRate: 0.6,
            nearMissRate: 0.2,
            gatePassInRegimeCount: 40,
            gatePassAndClausePassInRegimeCount: 2,
            lostPassRateInRegime: 0.3,
          },
        },
      ],
      ablationImpact: {
        clauseImpacts: [
          { clauseId: 'var:emotions.joy:>=:0.4', impact: 0.2 },
        ],
      },
      prototypeEvaluationSummary: {
        emotions: {
          joy: {
            moodSampleCount: 80,
            gatePassCount: 40,
            gateFailCount: 40,
            failedGateCounts: { 'valence >= 0.4': 30 },
            valueSumGivenGate: 10,
          },
        },
        sexualStates: {},
      },
      gateCompatibility: {
        emotions: {
          joy: { compatible: false, reason: 'conflict' },
        },
        sexualStates: {},
      },
    });
    const blockers = [createBlocker()];

    const generator = new MonteCarloReportGenerator({ logger });
    const report = generator.generate({
      expressionName: 'test-expression',
      simulationResult,
      blockers,
      summary: 'Summary',
      prerequisites: [
        { logic: { '>=': [{ var: 'moodAxes.valence' }, 0.2] } },
      ],
    });

    expect(report).toContain('## Recommendations');
    expect(report).toContain('Prototype structurally mismatched');
    expect(report).toContain('Gate fail rate: 40/80');
    expect(report).toContain('Pass | gate: 2/40');
    expect(report).toContain('- **Confidence**: low');
    expect(report).toContain('[var:emotions.joy:>=:0.4](#clause-var-emotions-joy-0-4)');
    expect(report).toContain('<a id="clause-var-emotions-joy-0-4"></a>');
  });

  it('renders gate-clamp regime permissive recommendations', () => {
    const simulationResult = createGateClampSimulationResult();

    const generator = new MonteCarloReportGenerator({ logger });
    const report = generator.generate({
      expressionName: 'test-expression',
      simulationResult,
      blockers: [createBlocker()],
      summary: 'Summary',
      prerequisites: [
        { logic: { '>=': [{ var: 'moodAxes.valence' }, 0] } },
      ],
    });

    expect(report).toContain('## Recommendations');
    expect(report).toContain(
      'Recommendation 1: Mood regime allows gate-clamped states'
    );
    expect(report).toContain('**Type**: gate_clamp_regime_permissive');
    expect(report).toContain('Gate clamp rate (mood regime): 40/100 (40.00%)');
    expect(report).toContain('Keep ratio for proposed constraint: 60/100 (60.00%)');
    expect(report).toContain(
      'Add regime bounds aligned with gate predicates: valence >= 40.'
    );
  });

  it('suppresses gate-clamp recommendation when clamp rate is too low', () => {
    const simulationResult = createGateClampSimulationResult({
      gatePassInRegimeCount: 81,
      gateFailInRegimeCount: 19,
    });

    const generator = new MonteCarloReportGenerator({ logger });
    const report = generator.generate({
      expressionName: 'test-expression',
      simulationResult,
      blockers: [createBlocker()],
      summary: 'Summary',
      prerequisites: [
        { logic: { '>=': [{ var: 'moodAxes.valence' }, 0] } },
      ],
    });

    expect(report).not.toContain('gate_clamp_regime_permissive');
    expect(report).not.toContain('Mood regime allows gate-clamped states');
  });

  it('suppresses gate-clamp recommendation when regime implies gates', () => {
    const simulationResult = createGateClampSimulationResult();

    const generator = new MonteCarloReportGenerator({ logger });
    const report = generator.generate({
      expressionName: 'test-expression',
      simulationResult,
      blockers: [createBlocker()],
      summary: 'Summary',
      prerequisites: [
        { logic: { '>=': [{ var: 'moodAxes.valence' }, 50] } },
      ],
    });

    expect(report).not.toContain('gate_clamp_regime_permissive');
    expect(report).not.toContain('Mood regime allows gate-clamped states');
  });

  it('suppresses gate-clamp recommendation when keep ratio is too low', () => {
    const simulationResult = createGateClampSimulationResult({
      gatePassInRegimeCount: 40,
      gateFailInRegimeCount: 60,
    });

    const generator = new MonteCarloReportGenerator({ logger });
    const report = generator.generate({
      expressionName: 'test-expression',
      simulationResult,
      blockers: [createBlocker()],
      summary: 'Summary',
      prerequisites: [
        { logic: { '>=': [{ var: 'moodAxes.valence' }, 0] } },
      ],
    });

    expect(report).not.toContain('gate_clamp_regime_permissive');
    expect(report).not.toContain('Mood regime allows gate-clamped states');
  });

  it('suppresses recommendations when invariants fail', () => {
    const simulationResult = createSimulationResult({
      clauseFailures: [
        {
          clauseDescription: 'emotions.joy >= 0.4',
          inRegimeFailureRate: 0.5,
          averageViolation: 0.1,
          hierarchicalBreakdown: {
            nodeType: 'leaf',
            clauseId: 'var:emotions.joy:>=:0.4',
            clauseType: 'threshold',
            description: 'emotions.joy >= 0.4',
            variablePath: 'emotions.joy',
            thresholdValue: 0.4,
            inRegimeFailureRate: 0.5,
            averageViolation: 0.1,
            siblingConditionedFailRate: 0.6,
            nearMissRate: 0.2,
            gatePassInRegimeCount: 40,
            gatePassAndClausePassInRegimeCount: 2,
          },
        },
      ],
      ablationImpact: {
        clauseImpacts: [
          { clauseId: 'var:emotions.joy:>=:0.4', impact: 0.2 },
        ],
      },
      prototypeEvaluationSummary: {
        emotions: {
          joy: {
            moodSampleCount: 10,
            gatePassCount: 12,
            gateFailCount: 0,
            failedGateCounts: {},
            valueSumGivenGate: 2,
          },
        },
        sexualStates: {},
      },
    });

    const generator = new MonteCarloReportGenerator({ logger });
    const report = generator.generate({
      expressionName: 'test-expression',
      simulationResult,
      blockers: [createBlocker()],
      summary: 'Summary',
      prerequisites: [
        { logic: { '>=': [{ var: 'moodAxes.valence' }, 0.2] } },
      ],
    });

    expect(report).toContain('## Recommendations');
    expect(report).toContain(
      'Recommendations suppressed: invariant violations detected in diagnostic facts.'
    );
    expect(report).not.toContain('Recommendation 1: Prototype structurally mismatched');
  });
});
