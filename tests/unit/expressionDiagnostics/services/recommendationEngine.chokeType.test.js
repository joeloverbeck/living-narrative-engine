/**
 * @file Unit tests for RecommendationEngine choke type classification.
 */

import { describe, it, expect } from '@jest/globals';
import RecommendationEngine from '../../../../src/expressionDiagnostics/services/RecommendationEngine.js';

const baseFacts = () => ({
  expressionId: 'expr:choke-type',
  sampleCount: 800,
  moodRegime: {
    definition: null,
    sampleCount: 400,
  },
  overallPassRate: 0.2,
  clauses: [
    {
      clauseId: 'var:emotions.joy:>=:0.6',
      clauseLabel: 'emotions.joy >= 0.6',
      clauseType: 'threshold',
      operator: '>=',
      prototypeId: 'joy',
      impact: 0.3,
      thresholdValue: 0.6,
    },
  ],
  prototypes: [
    {
      prototypeId: 'joy',
      moodSampleCount: 400,
      gateFailCount: 160,
      gatePassCount: 240,
      thresholdPassGivenGateCount: 200,
      thresholdPassCount: 200,
      gateFailRate: 0.4,
      gatePassRate: 0.6,
      pThreshGivenGate: 0.9,
      pThreshEffective: 0.54,
      meanValueGivenGate: 0.7,
      failedGateCounts: [{ gateId: 'valence >= 0.4', count: 100 }],
      compatibilityScore: 0,
    },
  ],
  invariants: [{ id: 'rate:overallPassRate', ok: true, message: '' }],
});

describe('RecommendationEngine choke types', () => {
  it('emits gate-only evidence for gate chokes', () => {
    const engine = new RecommendationEngine();
    const facts = baseFacts();
    facts.clauses[0] = {
      ...facts.clauses[0],
      rawPassInRegimeCount: 200,
      lostPassInRegimeCount: 80,
      lostPassRateInRegime: 0.4,
    };
    facts.prototypes[0] = {
      ...facts.prototypes[0],
      pThreshGivenGate: 0.98,
      meanValueGivenGate: 0.72,
    };

    const recommendations = engine.generate(facts);
    const recommendation = recommendations[0];
    const labels = recommendation.evidence.map((item) => item.label);

    expect(recommendation.type).toBe('prototype_mismatch');
    expect(recommendation.chokeType).toBe('gate');
    expect(labels).toContain('Gate fail rate');
    expect(labels).not.toContain('Pass | gate');
    expect(labels).not.toContain('Clause threshold');
  });

  it('emits threshold-only evidence for threshold chokes', () => {
    const engine = new RecommendationEngine();
    const facts = baseFacts();
    facts.clauses[0] = {
      ...facts.clauses[0],
      thresholdValue: 0.8,
    };
    facts.prototypes[0] = {
      ...facts.prototypes[0],
      gateFailCount: 20,
      gatePassCount: 380,
      gateFailRate: 0.05,
      gatePassRate: 0.95,
      thresholdPassCount: 10,
      pThreshGivenGate: 0.05,
      meanValueGivenGate: 0.5,
    };

    const recommendations = engine.generate(facts);
    const recommendation = recommendations[0];
    const labels = recommendation.evidence.map((item) => item.label);

    expect(recommendation.type).toBe('prototype_mismatch');
    expect(recommendation.chokeType).toBe('threshold');
    expect(labels).toContain('Pass | gate');
    expect(labels).toContain('Clause threshold');
    expect(labels).not.toContain('Gate fail rate');
  });

  it('emits mixed evidence for mixed chokes', () => {
    const engine = new RecommendationEngine();
    const facts = baseFacts();
    facts.clauses[0] = {
      ...facts.clauses[0],
      rawPassInRegimeCount: 150,
      lostPassInRegimeCount: 60,
      lostPassRateInRegime: 0.4,
    };
    facts.prototypes[0] = {
      ...facts.prototypes[0],
      pThreshGivenGate: 0.05,
      meanValueGivenGate: 0.4,
    };

    const recommendations = engine.generate(facts);
    const recommendation = recommendations[0];
    const labels = recommendation.evidence.map((item) => item.label);

    expect(recommendation.type).toBe('prototype_mismatch');
    expect(recommendation.chokeType).toBe('mixed');
    expect(labels).toContain('Gate fail rate');
    expect(labels).toContain('Pass | gate');
  });

  it('suppresses axis sign conflict for gate-only high pass|gate', () => {
    const engine = new RecommendationEngine();
    const facts = baseFacts();
    facts.clauses[0] = {
      ...facts.clauses[0],
      rawPassInRegimeCount: 160,
      lostPassInRegimeCount: 50,
      lostPassRateInRegime: 0.3125,
    };
    facts.prototypes[0] = {
      ...facts.prototypes[0],
      pThreshGivenGate: 0.98,
      axisConflicts: [
        {
          axis: 'valence',
          weight: 0.8,
          constraintMin: -1,
          constraintMax: 0.2,
          conflictType: 'positive_weight_low_max',
          contributionDelta: 0.64,
          lostRawSum: 0.24,
          lostIntensity: 0.2,
          sources: [
            {
              varPath: 'moodAxes.valence',
              operator: '>=',
              threshold: 20,
            },
          ],
        },
      ],
    };

    const recommendations = engine.generate(facts);
    const types = recommendations.map((item) => item.type);

    expect(types).toContain('prototype_mismatch');
    expect(types).not.toContain('axis_sign_conflict');
  });
});
