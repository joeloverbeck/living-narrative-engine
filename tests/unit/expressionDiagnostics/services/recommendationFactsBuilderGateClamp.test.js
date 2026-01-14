/**
 * @file Unit tests for RecommendationFactsBuilder gate-clamp permissive facts.
 */

import { describe, it, expect } from '@jest/globals';
import RecommendationFactsBuilder from '../../../../src/expressionDiagnostics/services/RecommendationFactsBuilder.js';

const buildHistogram = (axis, values, { min = -100, max = 100 } = {}) => {
  const binCount = max - min + 1;
  const bins = Array.from({ length: binCount }, () => 0);
  for (const value of values) {
    const rounded = Math.round(value);
    const clamped = Math.max(min, Math.min(max, rounded));
    bins[clamped - min] += 1;
  }
  return {
    axis,
    min,
    max,
    binCount,
    bins,
    sampleCount: values.length,
  };
};

const buildReservoir = (axis, values) => ({
  sampleCount: values.length,
  storedCount: values.length,
  limit: values.length,
  samples: values.map((value) => ({ [axis]: value })),
});

describe('RecommendationFactsBuilder gate-clamp permissive facts', () => {
  it('builds gate-clamp evidence with replay predictions and soft alignment', () => {
    const builder = new RecommendationFactsBuilder({
      gateClampConfig: { softAlignmentEnabled: true },
    });

    const clauseId = 'var:emotions.joy:>=:0.4';
    const values = [-10, 0, 10, 20, 20, 30, 40, 50, 60, 70];

    const simulationResult = {
      sampleCount: 10,
      clauseFailures: [
        {
          clauseDescription: 'emotions.joy >= 0.4',
          hierarchicalBreakdown: {
            nodeType: 'leaf',
            clauseId,
            clauseType: 'threshold',
            description: 'emotions.joy >= 0.4',
            variablePath: 'emotions.joy',
            inRegimeEvaluationCount: 10,
            gatePassInRegimeCount: 7,
            gateFailInRegimeCount: 3,
            gateClampRateInRegime: 0.3,
          },
        },
      ],
      gateClampRegimePlan: {
        trackedGateAxes: ['valence'],
        clauseGateMap: {
          [clauseId]: {
            prototypeId: 'joy',
            type: 'emotion',
            usePrevious: false,
            gatePredicates: [
              {
                axis: 'valence',
                operator: '>=',
                thresholdNormalized: 0.2,
                thresholdRaw: 20,
              },
            ],
          },
        },
      },
      moodRegimeAxisHistograms: {
        valence: buildHistogram('valence', values),
      },
      moodRegimeSampleReservoir: buildReservoir('valence', values),
    };

    const expression = {
      id: 'expr:gate-clamp-soft',
      prerequisites: [{ logic: { '>=': [{ var: 'moodAxes.valence' }, 10] } }],
    };

    const facts = builder.build({ expression, simulationResult });
    const clause = facts.clauses.find((item) => item.clauseId === clauseId);
    const gateFacts = clause.gateClampRegimePermissive;

    expect(gateFacts).toBeDefined();
    expect(gateFacts.moodRegimeCount).toBe(10);
    expect(gateFacts.gateFailInRegimeCount).toBe(3);
    expect(gateFacts.gateClampRateInRegime).toBeCloseTo(0.3, 6);
    expect(gateFacts.allGatesImplied).toBe(false);

    const evidence = gateFacts.axisEvidence[0];
    expect(evidence.fractionBelow.rate).toBeCloseTo(0.3, 6);
    expect(evidence.fractionAbove.rate).toBeCloseTo(0.5, 6);
    expect(evidence.quantiles.p10).toBe(-10);
    expect(evidence.quantiles.p50).toBe(20);
    expect(evidence.quantiles.p90).toBe(60);

    const hardCandidate = gateFacts.candidates.find(
      (candidate) => candidate.kind === 'hard'
    );
    expect(hardCandidate.keepRatio).toBeCloseTo(0.7, 6);
    expect(hardCandidate.predClampRate).toBeCloseTo(0, 6);

    const softCandidate = gateFacts.candidates.find(
      (candidate) => candidate.kind === 'soft'
    );
    expect(softCandidate.keepRatio).toBeCloseTo(1, 6);
    expect(softCandidate.predClampRate).toBeCloseTo(0.3, 6);
  });

  it('omits candidates when regime bounds imply all gates', () => {
    const builder = new RecommendationFactsBuilder();
    const clauseId = 'var:emotions.joy:>=:0.4';

    const simulationResult = {
      sampleCount: 5,
      clauseFailures: [
        {
          clauseDescription: 'emotions.joy >= 0.4',
          hierarchicalBreakdown: {
            nodeType: 'leaf',
            clauseId,
            clauseType: 'threshold',
            description: 'emotions.joy >= 0.4',
            variablePath: 'emotions.joy',
            inRegimeEvaluationCount: 5,
            gatePassInRegimeCount: 5,
            gateFailInRegimeCount: 0,
            gateClampRateInRegime: 0,
          },
        },
      ],
      gateClampRegimePlan: {
        trackedGateAxes: ['valence'],
        clauseGateMap: {
          [clauseId]: {
            prototypeId: 'joy',
            type: 'emotion',
            usePrevious: false,
            gatePredicates: [
              {
                axis: 'valence',
                operator: '>=',
                thresholdNormalized: 0.2,
                thresholdRaw: 20,
              },
            ],
          },
        },
      },
    };

    const expression = {
      id: 'expr:gate-clamp-implied',
      prerequisites: [{ logic: { '>=': [{ var: 'moodAxes.valence' }, 30] } }],
    };

    const facts = builder.build({ expression, simulationResult });
    const clause = facts.clauses.find((item) => item.clauseId === clauseId);
    const gateFacts = clause.gateClampRegimePermissive;

    expect(gateFacts.allGatesImplied).toBe(true);
    expect(gateFacts.candidates).toHaveLength(0);
  });

  it('falls back to histogram keep ratios without reservoir replay', () => {
    const builder = new RecommendationFactsBuilder();
    const clauseId = 'var:emotions.joy:>=:0.4';
    const values = [-10, 0, 10, 20, 30, 40, 50, 60, 70, 80];
    const arousalValues = [-20, -10, 0, 10, 20, 30, 40, 50, 60, 70];

    const simulationResult = {
      sampleCount: 10,
      clauseFailures: [
        {
          clauseDescription: 'emotions.joy >= 0.4',
          hierarchicalBreakdown: {
            nodeType: 'leaf',
            clauseId,
            clauseType: 'threshold',
            description: 'emotions.joy >= 0.4',
            variablePath: 'emotions.joy',
            inRegimeEvaluationCount: 10,
            gatePassInRegimeCount: 6,
            gateFailInRegimeCount: 4,
            gateClampRateInRegime: 0.4,
          },
        },
      ],
      gateClampRegimePlan: {
        trackedGateAxes: ['valence', 'arousal'],
        clauseGateMap: {
          [clauseId]: {
            prototypeId: 'joy',
            type: 'emotion',
            usePrevious: false,
            gatePredicates: [
              {
                axis: 'valence',
                operator: '>=',
                thresholdNormalized: 0.2,
                thresholdRaw: 20,
              },
              {
                axis: 'arousal',
                operator: '<=',
                thresholdNormalized: 0.5,
                thresholdRaw: 50,
              },
            ],
          },
        },
      },
      moodRegimeAxisHistograms: {
        valence: buildHistogram('valence', values),
        arousal: buildHistogram('arousal', arousalValues),
      },
      moodRegimeSampleReservoir: {
        sampleCount: 0,
        storedCount: 0,
        limit: 0,
        samples: [],
      },
    };

    const expression = { id: 'expr:gate-clamp-hist', prerequisites: [] };

    const facts = builder.build({ expression, simulationResult });
    const clause = facts.clauses.find((item) => item.clauseId === clauseId);
    const gateFacts = clause.gateClampRegimePermissive;

    expect(gateFacts.candidates).toHaveLength(2);
    const valenceCandidate = gateFacts.candidates.find((candidate) =>
      candidate.id.startsWith('hard:valence')
    );
    const arousalCandidate = gateFacts.candidates.find((candidate) =>
      candidate.id.startsWith('hard:arousal')
    );
    expect(valenceCandidate.keepRatio).toBeCloseTo(0.7, 6);
    expect(valenceCandidate.predClampRate).toBeNull();
    expect(arousalCandidate.keepRatio).toBeCloseTo(0.8, 6);
  });
});
