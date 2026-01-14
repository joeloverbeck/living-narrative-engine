/**
 * @file Unit tests for RecommendationEngine.
 */

import { describe, it, expect } from '@jest/globals';
import RecommendationEngine from '../../../../src/expressionDiagnostics/services/RecommendationEngine.js';

const baseFacts = () => ({
  expressionId: 'expr:recommendation',
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
    {
      clauseId: 'axis:moodAxes.valence:>=:0.2',
      clauseLabel: 'moodAxes.valence >= 0.2',
      clauseType: 'threshold',
      operator: '>=',
      prototypeId: null,
      impact: 0.25,
      thresholdValue: 0.2,
    },
    {
      clauseId: 'var:emotions.sadness:>=:0.4',
      clauseLabel: 'emotions.sadness >= 0.4',
      clauseType: 'threshold',
      operator: '>=',
      prototypeId: 'sadness',
      impact: 0.22,
      thresholdValue: 0.4,
    },
  ],
  prototypes: [
    {
      prototypeId: 'joy',
      moodSampleCount: 400,
      gateFailCount: 120,
      gatePassCount: 280,
      thresholdPassGivenGateCount: 120,
      thresholdPassCount: 120,
      gateFailRate: 0.3,
      gatePassRate: 0.7,
      pThreshGivenGate: 120 / 280,
      pThreshEffective: 0.21,
      meanValueGivenGate: 0.5,
      failedGateCounts: [{ gateId: 'valence >= 0.4', count: 70 }],
      compatibilityScore: 0,
    },
    {
      prototypeId: 'sadness',
      moodSampleCount: 400,
      gateFailCount: 40,
      gatePassCount: 360,
      thresholdPassGivenGateCount: 40,
      thresholdPassCount: 40,
      gateFailRate: 0.1,
      gatePassRate: 0.9,
      pThreshGivenGate: 40 / 360,
      pThreshEffective: 0.1,
      meanValueGivenGate: 0.45,
      failedGateCounts: [{ gateId: 'valence >= 0.3', count: 30 }],
      compatibilityScore: 0,
    },
  ],
  invariants: [{ id: 'rate:overallPassRate', ok: true, message: '' }],
});

describe('RecommendationEngine', () => {
  it('emits gate mismatch recommendation with failed gate evidence', () => {
    const engine = new RecommendationEngine();
    const facts = baseFacts();
    facts.clauses[0] = {
      ...facts.clauses[0],
      rawPassInRegimeCount: 120,
      lostPassInRegimeCount: 40,
      lostPassRateInRegime: 40 / 120,
    };
    facts.prototypes[0] = {
      ...facts.prototypes[0],
      gateFailRate: 0.05,
      gateFailCount: 20,
      gatePassCount: 380,
    };

    const recommendations = engine.generate(facts);

    expect(recommendations).toHaveLength(1);
    expect(recommendations[0].type).toBe('prototype_mismatch');
    expect(recommendations[0].confidence).toBe('medium');
    expect(recommendations[0].evidence.length).toBeGreaterThanOrEqual(2);
    expect(
      recommendations[0].evidence.some((item) =>
        String(item.label).includes('valence >= 0.4')
      )
    ).toBe(true);
  });

  it('emits gate mismatch when lost-pass rate exceeds threshold even if gate fail rate is low', () => {
    const engine = new RecommendationEngine();
    const facts = baseFacts();
    facts.clauses[0] = {
      ...facts.clauses[0],
      rawPassInRegimeCount: 50,
      lostPassInRegimeCount: 20,
      lostPassRateInRegime: 0.4,
    };
    facts.prototypes[0] = {
      ...facts.prototypes[0],
      gateFailRate: 0.05,
      gateFailCount: 10,
      gatePassCount: 390,
    };

    const recommendations = engine.generate(facts);

    expect(recommendations).toHaveLength(1);
    expect(recommendations[0].type).toBe('prototype_mismatch');
    expect(recommendations[0].why).toContain('Lost-pass rate exceeds 25%');
  });

  it('emits threshold mismatch recommendation with low confidence messaging', () => {
    const engine = new RecommendationEngine();
    const facts = baseFacts();

    facts.prototypes[0] = {
      ...facts.prototypes[0],
      moodSampleCount: 120,
      gateFailCount: 20,
      gatePassCount: 100,
      thresholdPassGivenGateCount: 5,
      thresholdPassCount: 5,
      gateFailRate: 0.2,
      gatePassRate: 0.8,
      pThreshGivenGate: 0.05,
      pThreshEffective: 0.04,
      meanValueGivenGate: 0.35,
      failedGateCounts: [],
      compatibilityScore: 0,
    };

    const recommendations = engine.generate(facts);

    expect(recommendations).toHaveLength(1);
    expect(recommendations[0].confidence).toBe('low');
    expect(recommendations[0].why).toContain('Low confidence');
    expect(recommendations[0].evidence.length).toBeGreaterThanOrEqual(2);
    for (const item of recommendations[0].evidence) {
      expect(typeof item.denominator).toBe('number');
    }
  });

  it('suppresses recommendations when invariants fail', () => {
    const engine = new RecommendationEngine();
    const facts = baseFacts();
    facts.invariants = [
      { id: 'rate:overallPassRate', ok: false, message: 'bad rate' },
    ];

    const recommendations = engine.generate(facts);

    expect(recommendations).toEqual([]);
  });

  it('sorts recommendations by severity then impact then id', () => {
    const engine = new RecommendationEngine();
    const facts = baseFacts();
    facts.clauses[0] = {
      ...facts.clauses[0],
      rawPassInRegimeCount: 100,
      lostPassInRegimeCount: 30,
      lostPassRateInRegime: 0.3,
    };
    facts.clauses[2] = {
      ...facts.clauses[2],
      rawPassInRegimeCount: 80,
      lostPassInRegimeCount: 24,
      lostPassRateInRegime: 0.3,
    };

    facts.prototypes[0] = {
      ...facts.prototypes[0],
      gateFailCount: 150,
      gatePassCount: 250,
      thresholdPassGivenGateCount: 50,
      thresholdPassCount: 50,
      gateFailRate: 0.375,
      gatePassRate: 0.625,
      pThreshGivenGate: 0.2,
      pThreshEffective: 0.125,
      meanValueGivenGate: 0.5,
    };
    facts.prototypes[1] = {
      ...facts.prototypes[1],
      gateFailCount: 120,
      gatePassCount: 280,
      thresholdPassGivenGateCount: 56,
      thresholdPassCount: 56,
      gateFailRate: 0.3,
      gatePassRate: 0.7,
      pThreshGivenGate: 0.2,
      pThreshEffective: 0.14,
      meanValueGivenGate: 0.45,
    };

    const recommendations = engine.generate(facts);

    expect(recommendations).toHaveLength(2);
    expect(recommendations[0].relatedClauseIds[0]).toBe(
      'var:emotions.joy:>=:0.6'
    );
    expect(recommendations[1].relatedClauseIds[0]).toBe(
      'var:emotions.sadness:>=:0.4'
    );
  });

  it('does not emit gate mismatch for <= clauses', () => {
    const engine = new RecommendationEngine();
    const facts = {
      ...baseFacts(),
      clauses: [
        {
          clauseId: 'var:emotions.calm:<=:0.3',
          clauseLabel: 'emotions.calm <= 0.3',
          clauseType: 'threshold',
          operator: '<=',
          prototypeId: 'calm',
          impact: 0.3,
          thresholdValue: 0.3,
        },
      ],
      prototypes: [
        {
          prototypeId: 'calm',
          moodSampleCount: 400,
          gateFailCount: 140,
          gatePassCount: 260,
          thresholdPassGivenGateCount: 200,
          thresholdPassCount: 200,
          gateFailRate: 0.35,
          gatePassRate: 0.65,
          pThreshGivenGate: 200 / 260,
          pThreshEffective: 0.5,
          meanValueGivenGate: 0.5,
          failedGateCounts: [{ gateId: 'valence <= 0.2', count: 80 }],
          compatibilityScore: 0,
        },
      ],
    };

    const recommendations = engine.generate(facts);

    expect(recommendations).toEqual([]);
  });

  it('emits gate incompatibility recommendation when compatibility is negative', () => {
    const engine = new RecommendationEngine();
    const facts = {
      expressionId: 'expr:gate-incompat',
      sampleCount: 500,
      moodRegime: { definition: null, sampleCount: 300 },
      overallPassRate: 0.1,
      clauses: [
        {
          clauseId: 'var:emotions.pride:>=:0.6',
          clauseLabel: 'emotions.pride >= 0.6',
          clauseType: 'threshold',
          operator: '>=',
          prototypeId: 'pride',
          impact: 0.3,
          thresholdValue: 0.6,
        },
      ],
      prototypes: [
        {
          prototypeId: 'pride',
          moodSampleCount: 300,
          gateFailCount: 30,
          gatePassCount: 270,
          thresholdPassGivenGateCount: 200,
          thresholdPassCount: 200,
          gateFailRate: 0.1,
          gatePassRate: 0.9,
          pThreshGivenGate: 200 / 270,
          pThreshEffective: 0.6,
          meanValueGivenGate: 0.7,
          failedGateCounts: [{ gateId: 'valence >= 0.2', count: 20 }],
          compatibilityScore: -1,
        },
      ],
      invariants: [{ id: 'rate:overallPassRate', ok: true, message: '' }],
    };

    const recommendations = engine.generate(facts);

    expect(recommendations).toHaveLength(1);
    expect(recommendations[0].type).toBe('gate_incompatibility');
    expect(recommendations[0].why).toContain('always clamped');
    expect(
      recommendations[0].evidence.some((item) =>
        String(item.label).includes('Gate compatibility')
      )
    ).toBe(true);
  });

  it('does not emit gate incompatibility recommendation for <= clauses', () => {
    const engine = new RecommendationEngine();
    const facts = {
      expressionId: 'expr:gate-incompat-ceiling',
      sampleCount: 500,
      moodRegime: { definition: null, sampleCount: 300 },
      overallPassRate: 0.1,
      clauses: [
        {
          clauseId: 'var:emotions.pride:<=:0.6',
          clauseLabel: 'emotions.pride <= 0.6',
          clauseType: 'threshold',
          operator: '<=',
          prototypeId: 'pride',
          impact: 0.3,
          thresholdValue: 0.6,
        },
      ],
      prototypes: [
        {
          prototypeId: 'pride',
          moodSampleCount: 300,
          gateFailCount: 30,
          gatePassCount: 270,
          thresholdPassGivenGateCount: 200,
          thresholdPassCount: 200,
          gateFailRate: 0.1,
          gatePassRate: 0.9,
          pThreshGivenGate: 200 / 270,
          pThreshEffective: 0.6,
          meanValueGivenGate: 0.7,
          failedGateCounts: [{ gateId: 'valence >= 0.2', count: 20 }],
          compatibilityScore: -1,
        },
      ],
      invariants: [{ id: 'rate:overallPassRate', ok: true, message: '' }],
    };

    const recommendations = engine.generate(facts);

    expect(recommendations).toEqual([]);
  });

  it('emits axis sign conflict recommendation when conflicts are present', () => {
    const engine = new RecommendationEngine();
    const facts = {
      expressionId: 'expr:axis-conflict',
      sampleCount: 500,
      moodRegime: { definition: null, sampleCount: 300 },
      overallPassRate: 0.1,
      clauses: [
        {
          clauseId: 'var:emotions.joy:>=:0.6',
          clauseLabel: 'emotions.joy >= 0.6',
          clauseType: 'threshold',
          operator: '>=',
          prototypeId: 'joy',
          impact: 0.05,
          thresholdValue: 0.5,
        },
      ],
      prototypes: [
        {
          prototypeId: 'joy',
          moodSampleCount: 300,
          gateFailCount: 30,
          gatePassCount: 270,
          thresholdPassGivenGateCount: 200,
          thresholdPassCount: 200,
          gateFailRate: 0.1,
          gatePassRate: 0.9,
          pThreshGivenGate: 200 / 270,
          pThreshEffective: 0.6,
          meanValueGivenGate: 0.8,
          failedGateCounts: [],
          compatibilityScore: 0,
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
        },
      ],
      invariants: [{ id: 'rate:overallPassRate', ok: true, message: '' }],
    };

    const recommendations = engine.generate(facts);
    const axisEvidence = recommendations[0].evidence.find(
      (item) => item.axis === 'valence'
    );

    expect(recommendations).toHaveLength(1);
    expect(recommendations[0].type).toBe('axis_sign_conflict');
    expect(recommendations[0].severity).toBe('high');
    expect(recommendations[0].evidence.length).toBeGreaterThanOrEqual(1);
    expect(axisEvidence).toMatchObject({
      axis: 'valence',
      lostRawSum: 0.24,
      lostIntensity: 0.2,
      population: { name: 'mood-regime', count: 300 },
    });
    expect(
      recommendations[0].evidence.some((item) =>
        String(item.label).includes('Axis conflict')
      )
    ).toBe(true);
    expect(
      recommendations[0].actions.some((action) =>
        action.includes('moodAxes.valence >= 20')
      )
    ).toBe(true);
  });

  it('does not emit axis sign conflict recommendation for <= clauses', () => {
    const engine = new RecommendationEngine();
    const facts = {
      expressionId: 'expr:axis-conflict-lower',
      sampleCount: 500,
      moodRegime: { definition: null, sampleCount: 300 },
      overallPassRate: 0.1,
      clauses: [
        {
          clauseId: 'var:emotions.joy:<=:0.3',
          clauseLabel: 'emotions.joy <= 0.3',
          clauseType: 'threshold',
          operator: '<=',
          prototypeId: 'joy',
          impact: 0.2,
          thresholdValue: 0.3,
        },
      ],
      prototypes: [
        {
          prototypeId: 'joy',
          moodSampleCount: 300,
          gateFailCount: 30,
          gatePassCount: 270,
          thresholdPassGivenGateCount: 200,
          thresholdPassCount: 200,
          gateFailRate: 0.1,
          gatePassRate: 0.9,
          pThreshGivenGate: 200 / 270,
          pThreshEffective: 0.6,
          meanValueGivenGate: 0.2,
          failedGateCounts: [],
          compatibilityScore: 0,
          axisConflicts: [
            {
              axis: 'valence',
              weight: 0.8,
              constraintMin: -1,
              constraintMax: 0.2,
              conflictType: 'positive_weight_low_max',
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
        },
      ],
      invariants: [{ id: 'rate:overallPassRate', ok: true, message: '' }],
    };

    const recommendations = engine.generate(facts);

    expect(recommendations).toEqual([]);
  });

  it('emits gate clamp regime permissive recommendation with axis evidence', () => {
    const engine = new RecommendationEngine();
    const facts = baseFacts();

    facts.clauses[0] = {
      ...facts.clauses[0],
      gateClampRegimePermissive: {
        moodRegimeCount: 120,
        gatePassInRegimeCount: 84,
        gateFailInRegimeCount: 36,
        gateClampRateInRegime: 0.3,
        allGatesImplied: false,
        gatePredicates: [
          {
            axis: 'valence',
            operator: '>=',
            thresholdRaw: 20,
            impliedByRegime: false,
            regimeBounds: { min: -100, max: 100 },
          },
        ],
        axisEvidence: [
          {
            axis: 'valence',
            operator: '>=',
            thresholdRaw: 20,
            fractionBelow: { count: 36, denominator: 120, rate: 0.3 },
            fractionAbove: { count: 60, denominator: 120, rate: 0.5 },
            quantiles: { p10: -10, p50: 20, p90: 60 },
          },
        ],
        candidates: [
          {
            id: 'hard:valence:>=:20',
            kind: 'hard',
            axes: [
              { axis: 'valence', operator: '>=', thresholdRaw: 20 },
            ],
            keepRatio: 0.7,
            keepCount: 84,
            keepDenominator: 120,
            predClampRate: 0.1,
            predSampleCount: 84,
            predPassRate: 0.9,
          },
        ],
      },
    };

    const recommendations = engine.generate(facts);

    expect(recommendations).toHaveLength(1);
    expect(recommendations[0].type).toBe('gate_clamp_regime_permissive');
    expect(recommendations[0].confidence).toBe('low');
    expect(recommendations[0].relatedClauseIds).toEqual([
      'var:emotions.joy:>=:0.6',
    ]);
    expect(
      recommendations[0].evidence.some((item) =>
        String(item.label).includes('Axis below gate')
      )
    ).toBe(true);
    for (const item of recommendations[0].evidence) {
      expect(typeof item.denominator).toBe('number');
    }
  });

  it('does not emit gate clamp regime permissive when constraint is redundant', () => {
    const engine = new RecommendationEngine();
    const facts = baseFacts();

    facts.clauses[0] = {
      ...facts.clauses[0],
      gateClampRegimePermissive: {
        moodRegimeCount: 200,
        gatePassInRegimeCount: 140,
        gateFailInRegimeCount: 60,
        gateClampRateInRegime: 0.3,
        allGatesImplied: false,
        gatePredicates: [
          {
            axis: 'valence',
            operator: '>=',
            thresholdRaw: 20,
            impliedByRegime: false,
            regimeBounds: { min: 30, max: 100 },
          },
        ],
        axisEvidence: [
          {
            axis: 'valence',
            operator: '>=',
            thresholdRaw: 20,
            fractionBelow: { count: 60, denominator: 200, rate: 0.3 },
            fractionAbove: { count: 100, denominator: 200, rate: 0.5 },
            quantiles: { p10: 10, p50: 30, p90: 70 },
          },
        ],
        candidates: [
          {
            id: 'hard:valence:>=:20',
            kind: 'hard',
            axes: [
              { axis: 'valence', operator: '>=', thresholdRaw: 20 },
            ],
            keepRatio: 0.7,
            keepCount: 140,
            keepDenominator: 200,
            predClampRate: 0.1,
            predSampleCount: 140,
            predPassRate: 0.9,
          },
        ],
      },
    };

    const recommendations = engine.generate(facts);

    expect(recommendations).toEqual([]);
  });
});
