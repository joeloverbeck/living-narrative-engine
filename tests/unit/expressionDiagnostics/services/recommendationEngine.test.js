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

  // ============================================================================
  // Change D: Specific mismatch titles (Monte Carlo information improvements)
  // ============================================================================

  describe('mismatch title specificity (Change D)', () => {
    it('uses "gate suppresses emotion" title for gate-only mismatch', () => {
      const engine = new RecommendationEngine();
      const facts = baseFacts();
      facts.clauses[0] = {
        ...facts.clauses[0],
        rawPassInRegimeCount: 120,
        lostPassInRegimeCount: 40,
        lostPassRateInRegime: 40 / 120, // Triggers gate mismatch
      };
      facts.prototypes[0] = {
        ...facts.prototypes[0],
        gateFailRate: 0.05,
        gateFailCount: 20,
        gatePassCount: 380,
        pThreshGivenGate: 0.8, // High threshold pass given gate - no threshold mismatch
        meanValueGivenGate: 0.7, // High mean - no threshold mismatch
      };

      const recommendations = engine.generate(facts);

      expect(recommendations).toHaveLength(1);
      expect(recommendations[0].title).toBe(
        'Prototype gate suppresses emotion in this regime'
      );
    });

    it('uses "threshold too high" title for threshold-only mismatch', () => {
      const engine = new RecommendationEngine();
      const facts = baseFacts();
      facts.prototypes[0] = {
        ...facts.prototypes[0],
        moodSampleCount: 120,
        gateFailCount: 10, // Low gate fail rate - no gate mismatch
        gatePassCount: 110,
        thresholdPassGivenGateCount: 5,
        thresholdPassCount: 5,
        gateFailRate: 10 / 120, // ~8% - below 10% gate mismatch threshold
        gatePassRate: 110 / 120,
        pThreshGivenGate: 0.045, // Very low - triggers threshold mismatch
        pThreshEffective: 0.04,
        meanValueGivenGate: 0.35, // Low mean - triggers threshold mismatch
        failedGateCounts: [],
        compatibilityScore: 0,
      };

      const recommendations = engine.generate(facts);

      expect(recommendations).toHaveLength(1);
      expect(recommendations[0].title).toBe(
        'Threshold too high for observed distribution'
      );
    });

    it('uses "both misaligned" title when gate and threshold both mismatched', () => {
      const engine = new RecommendationEngine();
      const facts = baseFacts();
      facts.clauses[0] = {
        ...facts.clauses[0],
        rawPassInRegimeCount: 100,
        lostPassInRegimeCount: 30,
        lostPassRateInRegime: 0.3, // Triggers gate mismatch
      };
      facts.prototypes[0] = {
        ...facts.prototypes[0],
        moodSampleCount: 200,
        gateFailCount: 60, // 30% gate fail - triggers gate mismatch
        gatePassCount: 140,
        thresholdPassGivenGateCount: 7,
        thresholdPassCount: 7,
        gateFailRate: 0.3,
        gatePassRate: 0.7,
        pThreshGivenGate: 0.05, // Low - triggers threshold mismatch
        pThreshEffective: 0.035,
        meanValueGivenGate: 0.35, // Low - triggers threshold mismatch
        failedGateCounts: [{ gateId: 'valence >= 0.4', count: 40 }],
        compatibilityScore: 0,
      };

      const recommendations = engine.generate(facts);

      expect(recommendations).toHaveLength(1);
      expect(recommendations[0].title).toBe(
        'Prototype gate and threshold both misaligned'
      );
    });
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
    // New binary choice format should include Option A with regime constraint
    expect(
      recommendations[0].actions.some((action) =>
        action.includes('moodAxes.valence >= 20')
      )
    ).toBe(true);
    // Should have structuredActions for programmatic access
    expect(recommendations[0].structuredActions).toBeDefined();
    expect(recommendations[0].structuredActions.options).toHaveLength(2);
    expect(recommendations[0].structuredActions.options[0].id).toBe(
      'relax_regime'
    );
    expect(recommendations[0].structuredActions.options[1].id).toBe(
      'change_emotion'
    );
    // Predicted effect should mention binary choice
    expect(recommendations[0].predictedEffect).toContain('Option A or B');
  });

  it('axis sign conflict provides binary choice framing with both options', () => {
    const mockEmotionSimilarityService = {
      findEmotionsWithCompatibleAxisSign: (axisName, targetSign) => {
        if (axisName === 'engagement' && targetSign === 'positive') {
          return [
            { emotionName: 'enthusiasm', axisWeight: 0.7 },
            { emotionName: 'fascination', axisWeight: 1.0 },
          ];
        }
        return [];
      },
    };
    const engine = new RecommendationEngine({
      emotionSimilarityService: mockEmotionSimilarityService,
    });
    const facts = {
      expressionId: 'expr:binary-choice',
      sampleCount: 500,
      moodRegime: { definition: null, sampleCount: 300 },
      overallPassRate: 0.1,
      clauses: [
        {
          clauseId: 'var:emotions.disgust:>=:0.6',
          clauseLabel: 'emotions.disgust >= 0.6',
          clauseType: 'threshold',
          operator: '>=',
          prototypeId: 'disgust',
          impact: 0.5,
          thresholdValue: 0.6,
        },
      ],
      prototypes: [
        {
          prototypeId: 'disgust',
          moodSampleCount: 300,
          gateFailCount: 30,
          gatePassCount: 270,
          thresholdPassGivenGateCount: 50,
          thresholdPassCount: 50,
          gateFailRate: 0.1,
          gatePassRate: 0.9,
          pThreshGivenGate: 50 / 270,
          pThreshEffective: 0.15,
          meanValueGivenGate: 0.4,
          failedGateCounts: [],
          compatibilityScore: -0.5,
          axisConflicts: [
            {
              axis: 'engagement',
              weight: -0.3,
              constraintMin: 10,
              constraintMax: 100,
              conflictType: 'negative_weight_high_min',
              contributionDelta: 0.5,
              lostRawSum: 0.3,
              lostIntensity: 0.3,
              sources: [
                {
                  varPath: 'moodAxes.engagement',
                  operator: '>=',
                  threshold: 10,
                },
              ],
            },
          ],
        },
      ],
      invariants: [{ id: 'rate:overallPassRate', ok: true, message: '' }],
    };

    const recommendations = engine.generate(facts);

    // Filter for axis_sign_conflict (facts may also trigger gate_incompatibility)
    const axisConflictRecs = recommendations.filter(
      (r) => r.type === 'axis_sign_conflict'
    );
    expect(axisConflictRecs).toHaveLength(1);
    const rec = axisConflictRecs[0];

    // Verify actions array has binary choice structure
    expect(rec.actions.some((a) => a.includes('CONFLICT:'))).toBe(true);
    expect(rec.actions.some((a) => a.includes('OPTION A:'))).toBe(true);
    expect(rec.actions.some((a) => a.includes('OPTION B:'))).toBe(true);
    expect(rec.actions.some((a) => a.includes('Trade-off:'))).toBe(true);

    // Verify structuredActions has proper shape
    expect(rec.structuredActions).toBeDefined();
    expect(rec.structuredActions.conflictSummary).toBeTruthy();
    expect(rec.structuredActions.conflictSummary).toContain('Engagement');
    expect(rec.structuredActions.conflictSummary).toContain('disgust');

    // Option A: relax regime
    const optionA = rec.structuredActions.options[0];
    expect(optionA.id).toBe('relax_regime');
    expect(optionA.tradeoff).toContain('wider range');
    expect(
      optionA.actions.some((a) => a.includes('moodAxes.engagement >= 10'))
    ).toBe(true);

    // Option B: change emotion with alternatives
    const optionB = rec.structuredActions.options[1];
    expect(optionB.id).toBe('change_emotion');
    expect(optionB.tradeoff).toContain('emotional signature');
    expect(optionB.alternatives).toBeDefined();
    expect(optionB.alternatives.length).toBeGreaterThan(0);

    // Should include alternative emotion suggestions from the service
    expect(
      rec.actions.some((a) => a.includes('enthusiasm') || a.includes('Consider'))
    ).toBe(true);
  });

  it('axis sign conflict works without emotionSimilarityService', () => {
    const engine = new RecommendationEngine(); // No similarity service
    const facts = {
      expressionId: 'expr:no-similarity-service',
      sampleCount: 500,
      moodRegime: { definition: null, sampleCount: 300 },
      overallPassRate: 0.1,
      clauses: [
        {
          clauseId: 'var:emotions.fear:>=:0.5',
          clauseLabel: 'emotions.fear >= 0.5',
          clauseType: 'threshold',
          operator: '>=',
          prototypeId: 'fear',
          impact: 0.4,
          thresholdValue: 0.5,
        },
      ],
      prototypes: [
        {
          prototypeId: 'fear',
          moodSampleCount: 300,
          gateFailCount: 30,
          gatePassCount: 270,
          thresholdPassGivenGateCount: 60,
          thresholdPassCount: 60,
          gateFailRate: 0.1,
          gatePassRate: 0.9,
          pThreshGivenGate: 60 / 270,
          pThreshEffective: 0.18,
          meanValueGivenGate: 0.35,
          failedGateCounts: [],
          compatibilityScore: -0.4,
          axisConflicts: [
            {
              axis: 'agency_control',
              weight: -0.5,
              constraintMin: 5,
              constraintMax: 100,
              conflictType: 'negative_weight_high_min',
              contributionDelta: 0.4,
              lostRawSum: 0.2,
              lostIntensity: 0.25,
              sources: [
                {
                  varPath: 'moodAxes.agency_control',
                  operator: '>=',
                  threshold: 5,
                },
              ],
            },
          ],
        },
      ],
      invariants: [{ id: 'rate:overallPassRate', ok: true, message: '' }],
    };

    const recommendations = engine.generate(facts);

    // Filter for axis_sign_conflict (facts may also trigger gate_incompatibility)
    const axisConflictRecs = recommendations.filter(
      (r) => r.type === 'axis_sign_conflict'
    );
    expect(axisConflictRecs).toHaveLength(1);
    const rec = axisConflictRecs[0];

    // Should still provide binary choice even without alternatives
    expect(rec.actions.some((a) => a.includes('OPTION A:'))).toBe(true);
    expect(rec.actions.some((a) => a.includes('OPTION B:'))).toBe(true);

    // Option B should still have fallback action
    const optionB = rec.structuredActions.options[1];
    expect(
      optionB.actions.some((a) =>
        a.includes('Adjust') && a.includes('weight toward 0')
      )
    ).toBe(true);

    // Should format axis name nicely (snake_case to Title Case)
    expect(rec.structuredActions.conflictSummary).toContain('Agency Control');
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

describe('RecommendationEngine - prototype_create_suggestion', () => {
  // Mock synthesis service
  const createMockSynthesisService = (synthesizedResult) => ({
    synthesize: jest.fn(() => synthesizedResult),
  });

  // Helper to create extended facts for prototype_create_suggestion tests
  const createPrototypeCreateFacts = (overrides = {}) => ({
    expressionId: 'expr:create-suggestion',
    sampleCount: 800,
    moodRegime: {
      definition: null,
      sampleCount: 400,
      bounds: { valence: { min: -0.5, max: 0.5 } },
    },
    storedMoodRegimeContexts: [{ moodAxes: { valence: 0.2 } }],
    prototypeDefinitions: {
      joy: { weights: { valence: 0.8 }, gates: [] },
    },
    prototypeFit: {
      leaderboard: [
        {
          prototypeId: 'joy',
          combinedScore: 0.5,
          gatePassRate: 0.25, // Below usable threshold
          intensityDistribution: {
            p95: 0.4,
            pAboveThreshold: [{ t: 0.55, p: 0.05 }], // Below usable threshold
          },
          moodSampleCount: 400,
        },
      ],
    },
    gapDetection: {
      nearestDistance: 0.50, // Above gap threshold
      distancePercentile: 80,
      kNearestNeighbors: [],
    },
    targetSignature: {
      valence: { dir: 'up', importance: 0.7 },
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
        gateFailCount: 120,
        gatePassCount: 280,
        thresholdPassGivenGateCount: 120,
        thresholdPassCount: 120,
        gateFailRate: 0.3,
        gatePassRate: 0.7,
        pThreshGivenGate: 0.43,
        pThreshEffective: 0.21,
        meanValueGivenGate: 0.5,
        failedGateCounts: [],
        compatibilityScore: 0,
      },
    ],
    invariants: [{ id: 'rate:overallPassRate', ok: true, message: '' }],
    ...overrides,
  });

  it('does not emit prototype_create_suggestion when no synthesis service is provided', () => {
    const engine = new RecommendationEngine();
    const facts = createPrototypeCreateFacts();

    const recommendations = engine.generate(facts);

    expect(
      recommendations.find((r) => r.type === 'prototype_create_suggestion')
    ).toBeUndefined();
  });

  it('emits prototype_create_suggestion when A && B (no usable prototype, strong improvement)', () => {
    const mockSynthesis = createMockSynthesisService({
      name: 'up_valence_joy',
      weights: { valence: 0.9, arousal: 0.3, dominance: 0.2 },
      gates: [],
      predictedFit: {
        N: 400,
        gatePassRate: 0.8,
        mean: 0.65,
        p95: 0.85,
        pAtLeastT: [
          { t: 0.55, p: 0.35 }, // Strong improvement: 0.35 - 0.05 = 0.30
          { t: 0.45, p: 0.45 },
          { t: 0.65, p: 0.25 },
        ],
      },
    });

    const engine = new RecommendationEngine({
      prototypeSynthesisService: mockSynthesis,
    });

    const facts = createPrototypeCreateFacts({
      prototypeFit: {
        leaderboard: [
          {
            prototypeId: 'joy',
            combinedScore: 0.5,
            gatePassRate: 0.25, // Below usable 0.30
            intensityDistribution: {
              p95: 0.4,
              pAboveThreshold: [{ t: 0.6, p: 0.05 }],
            },
            moodSampleCount: 400,
          },
        ],
      },
    });

    const recommendations = engine.generate(facts);
    const suggestion = recommendations.find(
      (r) => r.type === 'prototype_create_suggestion'
    );

    expect(suggestion).toBeDefined();
    expect(suggestion.type).toBe('prototype_create_suggestion');
    expect(suggestion.confidence).toBe('high');
    expect(suggestion.proposedPrototype.name).toBe('up_valence_joy');
    expect(suggestion.proposedPrototype.weights).toEqual({
      valence: 0.9,
      arousal: 0.3,
      dominance: 0.2,
    });
    expect(suggestion.why).toContain('No existing prototype meets usability');
    expect(suggestion.relatedClauseIds).toContain('var:emotions.joy:>=:0.6');
  });

  it('emits prototype_create_suggestion when C true (gap signal) and sanity passes', () => {
    const mockSynthesis = createMockSynthesisService({
      name: 'up_valence_prototype',
      weights: { valence: 0.7, arousal: 0.4, dominance: 0.3 },
      gates: [],
      predictedFit: {
        N: 400,
        gatePassRate: 0.5, // Passes sanity >= 0.20
        mean: 0.55,
        p95: 0.7,
        pAtLeastT: [
          { t: 0.55, p: 0.12 }, // Does not meet B threshold
        ],
      },
    });

    const engine = new RecommendationEngine({
      prototypeSynthesisService: mockSynthesis,
    });

    const facts = createPrototypeCreateFacts({
      gapDetection: {
        nearestDistance: 0.55, // > 0.45 triggers C
        distancePercentile: 80,
      },
      prototypeFit: {
        leaderboard: [
          {
            prototypeId: 'joy',
            combinedScore: 0.5,
            gatePassRate: 0.40, // Usable
            intensityDistribution: {
              p95: 0.5,
              pAboveThreshold: [{ t: 0.55, p: 0.12 }], // Usable
            },
            moodSampleCount: 400,
          },
        ],
      },
    });

    const recommendations = engine.generate(facts);
    const suggestion = recommendations.find(
      (r) => r.type === 'prototype_create_suggestion'
    );

    expect(suggestion).toBeDefined();
    expect(suggestion.confidence).toBe('medium');
    expect(suggestion.why).toContain('gap detected');
    expect(
      suggestion.evidence.some((e) => e.label === 'Nearest prototype distance')
    ).toBe(true);
  });

  it('does not emit when usable prototype exists and C not triggered', () => {
    const mockSynthesis = createMockSynthesisService({
      name: 'up_valence_joy',
      weights: { valence: 0.9 },
      gates: [],
      predictedFit: {
        N: 400,
        gatePassRate: 0.8,
        mean: 0.65,
        p95: 0.85,
        pAtLeastT: [{ t: 0.55, p: 0.35 }],
      },
    });

    const engine = new RecommendationEngine({
      prototypeSynthesisService: mockSynthesis,
    });

    const facts = createPrototypeCreateFacts({
      gapDetection: {
        nearestDistance: 0.30, // Below gap threshold
        distancePercentile: 50,
      },
      prototypeFit: {
        leaderboard: [
          {
            prototypeId: 'joy',
            combinedScore: 0.5,
            gatePassRate: 0.50, // Usable >= 0.30
            intensityDistribution: {
              p95: 0.6,
              pAboveThreshold: [{ t: 0.55, p: 0.20 }], // Usable >= 0.10
            },
            moodSampleCount: 400,
          },
        ],
      },
    });

    const recommendations = engine.generate(facts);
    const suggestion = recommendations.find(
      (r) => r.type === 'prototype_create_suggestion'
    );

    expect(suggestion).toBeUndefined();
  });

  it('does not emit when B fails (improvement below threshold)', () => {
    const mockSynthesis = createMockSynthesisService({
      name: 'up_valence_joy',
      weights: { valence: 0.9 },
      gates: [],
      predictedFit: {
        N: 400,
        gatePassRate: 0.8,
        mean: 0.65,
        p95: 0.85,
        pAtLeastT: [{ t: 0.55, p: 0.12 }], // Only 0.02 improvement, below 0.15
      },
    });

    const engine = new RecommendationEngine({
      prototypeSynthesisService: mockSynthesis,
    });

    const facts = createPrototypeCreateFacts({
      gapDetection: {
        nearestDistance: 0.30, // Not triggering C
        distancePercentile: 50,
      },
      prototypeFit: {
        leaderboard: [
          {
            prototypeId: 'joy',
            combinedScore: 0.5,
            gatePassRate: 0.25, // Below usable, so A is true
            intensityDistribution: {
              p95: 0.4,
              pAboveThreshold: [{ t: 0.55, p: 0.10 }], // Improvement is only 0.02
            },
            moodSampleCount: 400,
          },
        ],
      },
    });

    const recommendations = engine.generate(facts);
    const suggestion = recommendations.find(
      (r) => r.type === 'prototype_create_suggestion'
    );

    expect(suggestion).toBeUndefined();
  });

  it('does not emit when spam brake triggers', () => {
    const mockSynthesis = createMockSynthesisService({
      name: 'up_valence_joy',
      weights: { valence: 0.9, arousal: 0.3, dominance: 0.2 },
      gates: [],
      predictedFit: {
        N: 400,
        gatePassRate: 0.8,
        mean: 0.65,
        p95: 0.85,
        pAtLeastT: [{ t: 0.55, p: 0.45 }],
      },
    });

    const engine = new RecommendationEngine({
      prototypeSynthesisService: mockSynthesis,
    });

    const facts = createPrototypeCreateFacts({
      gapDetection: {
        nearestDistance: 0.30, // <= 0.35 spam brake distance
        distancePercentile: 50,
      },
      prototypeFit: {
        leaderboard: [
          {
            prototypeId: 'joy',
            combinedScore: 0.5,
            gatePassRate: 0.25, // Below usable, A would be true
            intensityDistribution: {
              p95: 0.4,
              pAboveThreshold: [{ t: 0.55, p: 0.20 }], // >= 0.15 spam brake pAtLeastT
            },
            moodSampleCount: 400,
          },
        ],
      },
    });

    const recommendations = engine.generate(facts);
    const suggestion = recommendations.find(
      (r) => r.type === 'prototype_create_suggestion'
    );

    expect(suggestion).toBeUndefined();
  });

  it('uses anchor clause threshold when present', () => {
    const mockSynthesis = createMockSynthesisService({
      name: 'up_valence_joy',
      weights: { valence: 0.9, arousal: 0.3, dominance: 0.2 },
      gates: [],
      predictedFit: {
        N: 400,
        gatePassRate: 0.8,
        mean: 0.65,
        p95: 0.85,
        pAtLeastT: [
          { t: 0.7, p: 0.35 }, // Custom threshold from anchor clause
        ],
      },
    });

    const engine = new RecommendationEngine({
      prototypeSynthesisService: mockSynthesis,
    });

    const facts = createPrototypeCreateFacts({
      clauses: [
        {
          clauseId: 'var:emotions.joy:>=:0.7',
          clauseLabel: 'emotions.joy >= 0.7',
          clauseType: 'threshold',
          operator: '>=',
          prototypeId: 'joy',
          impact: 0.3,
          thresholdValue: 0.7, // Custom threshold
        },
      ],
      prototypeFit: {
        leaderboard: [
          {
            prototypeId: 'joy',
            combinedScore: 0.5,
            gatePassRate: 0.25,
            intensityDistribution: {
              p95: 0.4,
              pAboveThreshold: [{ t: 0.7, p: 0.05 }],
            },
            moodSampleCount: 400,
          },
        ],
      },
    });

    const recommendations = engine.generate(facts);
    const suggestion = recommendations.find(
      (r) => r.type === 'prototype_create_suggestion'
    );

    expect(suggestion).toBeDefined();
    expect(suggestion.evidence.some((e) => e.label.includes('0.70'))).toBe(true);
  });

  it('uses default threshold 0.55 when no anchor clause', () => {
    const mockSynthesis = createMockSynthesisService({
      name: 'up_valence_prototype',
      weights: { valence: 0.9, arousal: 0.3, dominance: 0.2 },
      gates: [],
      predictedFit: {
        N: 400,
        gatePassRate: 0.8,
        mean: 0.65,
        p95: 0.85,
        pAtLeastT: [{ t: 0.55, p: 0.35 }],
      },
    });

    const engine = new RecommendationEngine({
      prototypeSynthesisService: mockSynthesis,
    });

    const facts = createPrototypeCreateFacts({
      clauses: [
        {
          clauseId: 'axis:moodAxes.valence:>=:0.2',
          clauseLabel: 'moodAxes.valence >= 0.2',
          clauseType: 'threshold',
          operator: '>=',
          prototypeId: null, // No prototype - won't be selected as anchor
          impact: 0.3,
          thresholdValue: 0.2,
        },
      ],
    });

    const recommendations = engine.generate(facts);
    const suggestion = recommendations.find(
      (r) => r.type === 'prototype_create_suggestion'
    );

    expect(suggestion).toBeDefined();
    expect(suggestion.evidence.some((e) => e.label.includes('0.55'))).toBe(true);
  });

  it('confidence is high for (A && B) or (C && B)', () => {
    const mockSynthesis = createMockSynthesisService({
      name: 'up_valence_joy',
      weights: { valence: 0.9, arousal: 0.3, dominance: 0.2 },
      gates: [],
      predictedFit: {
        N: 400,
        gatePassRate: 0.8,
        mean: 0.65,
        p95: 0.85,
        pAtLeastT: [{ t: 0.55, p: 0.35 }],
      },
    });

    const engine = new RecommendationEngine({
      prototypeSynthesisService: mockSynthesis,
    });

    // Test (A && B) - no usable prototype + strong improvement
    const factsAB = createPrototypeCreateFacts({
      gapDetection: {
        nearestDistance: 0.50, // High enough to not hit spam brake
        distancePercentile: 80,
      },
      prototypeFit: {
        leaderboard: [
          {
            prototypeId: 'joy',
            combinedScore: 0.5,
            gatePassRate: 0.25, // Not usable
            intensityDistribution: {
              p95: 0.4,
              pAboveThreshold: [{ t: 0.55, p: 0.05 }], // Not usable
            },
            moodSampleCount: 400,
          },
        ],
      },
    });

    const recsAB = engine.generate(factsAB);
    const suggestionAB = recsAB.find(
      (r) => r.type === 'prototype_create_suggestion'
    );

    expect(suggestionAB).toBeDefined();
    expect(suggestionAB.confidence).toBe('high');
  });

  it('confidence is medium for C without B', () => {
    const mockSynthesis = createMockSynthesisService({
      name: 'up_valence_prototype',
      weights: { valence: 0.7, arousal: 0.4, dominance: 0.3 },
      gates: [],
      predictedFit: {
        N: 400,
        gatePassRate: 0.5,
        mean: 0.55,
        p95: 0.7,
        pAtLeastT: [{ t: 0.55, p: 0.14 }], // Small improvement, B fails
      },
    });

    const engine = new RecommendationEngine({
      prototypeSynthesisService: mockSynthesis,
    });

    const facts = createPrototypeCreateFacts({
      gapDetection: {
        nearestDistance: 0.55, // C triggers
        distancePercentile: 80,
      },
      prototypeFit: {
        leaderboard: [
          {
            prototypeId: 'joy',
            combinedScore: 0.5,
            gatePassRate: 0.40, // Usable, so A is false
            intensityDistribution: {
              p95: 0.5,
              pAboveThreshold: [{ t: 0.55, p: 0.12 }], // Usable
            },
            moodSampleCount: 400,
          },
        ],
      },
    });

    const recommendations = engine.generate(facts);
    const suggestion = recommendations.find(
      (r) => r.type === 'prototype_create_suggestion'
    );

    expect(suggestion).toBeDefined();
    expect(suggestion.confidence).toBe('medium');
  });

  it('maintains deterministic ordering with existing recommendations', () => {
    const mockSynthesis = createMockSynthesisService({
      name: 'up_valence_joy',
      weights: { valence: 0.9, arousal: 0.3, dominance: 0.2 },
      gates: [],
      predictedFit: {
        N: 400,
        gatePassRate: 0.8,
        mean: 0.65,
        p95: 0.85,
        pAtLeastT: [{ t: 0.6, p: 0.35 }],
      },
    });

    const engine = new RecommendationEngine({
      prototypeSynthesisService: mockSynthesis,
    });

    const facts = createPrototypeCreateFacts({
      clauses: [
        {
          clauseId: 'var:emotions.joy:>=:0.6',
          clauseLabel: 'emotions.joy >= 0.6',
          clauseType: 'threshold',
          operator: '>=',
          prototypeId: 'joy',
          impact: 0.3,
          thresholdValue: 0.6,
          rawPassInRegimeCount: 100,
          lostPassInRegimeCount: 30,
          lostPassRateInRegime: 0.3, // Triggers prototype_mismatch
        },
      ],
      prototypes: [
        {
          prototypeId: 'joy',
          moodSampleCount: 400,
          gateFailCount: 80,
          gatePassCount: 320,
          thresholdPassGivenGateCount: 64,
          thresholdPassCount: 64,
          gateFailRate: 0.2,
          gatePassRate: 0.8,
          pThreshGivenGate: 0.2,
          pThreshEffective: 0.16,
          meanValueGivenGate: 0.5,
          failedGateCounts: [{ gateId: 'valence >= 0.4', count: 50 }],
          compatibilityScore: 0,
        },
      ],
    });

    const recommendations = engine.generate(facts);

    // Both should be present and order is deterministic
    expect(recommendations.length).toBeGreaterThan(0);
    // Recommendations should be sorted by severity, then impact, then id
    for (let i = 0; i < recommendations.length - 1; i++) {
      const current = recommendations[i];
      const next = recommendations[i + 1];
      const sevOrder = { high: 0, medium: 1, low: 2 };
      expect(sevOrder[current.severity]).toBeLessThanOrEqual(
        sevOrder[next.severity]
      );
    }
  });
});

describe('RecommendationEngine - sole_blocker_edit recommendations', () => {
  const createSoleBlockerFacts = (overrides = {}) => ({
    expressionId: 'expr:test',
    sampleCount: 500,
    moodRegime: { definition: null, sampleCount: 500 },
    overallPassRate: 0.3,
    clauses: [
      {
        clauseId: 'var:emotions.anger:>=:0.5',
        clauseLabel: 'emotions.anger >= 0.5',
        clauseType: 'threshold',
        operator: '>=',
        thresholdValue: 0.5,
        impact: 0.4,
        lastMileFailRate: 0.42,
        soleBlockerP50: 0.32,
        soleBlockerP90: 0.18,
        soleBlockerSampleCount: 120,
        ...overrides,
      },
    ],
    // Need at least one prototype for generate() to not return early
    prototypes: [
      {
        prototypeId: 'proto:dummy',
        gateFailRate: 0,
        pThreshGivenGate: 1,
        moodSampleCount: 500,
      },
    ],
  });

  it('should generate sole_blocker_edit recommendation when conditions are met', () => {
    const engine = new RecommendationEngine();
    const facts = createSoleBlockerFacts();

    const recommendations = engine.generate(facts);

    const soleBlockerRec = recommendations.find(
      (r) => r.type === 'sole_blocker_edit'
    );
    expect(soleBlockerRec).toBeDefined();
    expect(soleBlockerRec.title).toContain('Best First Edit');
    expect(soleBlockerRec.title).toContain('Lower');
  });

  it('should include threshold suggestions with P50 and P90', () => {
    const engine = new RecommendationEngine();
    const facts = createSoleBlockerFacts();

    const recommendations = engine.generate(facts);

    const soleBlockerRec = recommendations.find(
      (r) => r.type === 'sole_blocker_edit'
    );
    expect(soleBlockerRec.thresholdSuggestions).toBeDefined();
    expect(soleBlockerRec.thresholdSuggestions.length).toBe(2);

    const p50Suggestion = soleBlockerRec.thresholdSuggestions.find(
      (s) => s.percentile === 'P50'
    );
    expect(p50Suggestion.targetPassRate).toBe(0.5);
    expect(p50Suggestion.suggestedThreshold).toBe(0.32);

    const p90Suggestion = soleBlockerRec.thresholdSuggestions.find(
      (s) => s.percentile === 'P90'
    );
    expect(p90Suggestion.targetPassRate).toBe(0.9);
    expect(p90Suggestion.suggestedThreshold).toBe(0.18);
  });

  it('should not generate recommendation when lastMileFailRate is too low', () => {
    const engine = new RecommendationEngine();
    const facts = createSoleBlockerFacts({
      lastMileFailRate: 0.05, // Below 0.1 threshold
    });

    const recommendations = engine.generate(facts);

    const soleBlockerRec = recommendations.find(
      (r) => r.type === 'sole_blocker_edit'
    );
    expect(soleBlockerRec).toBeUndefined();
  });

  it('should not generate recommendation when sample count is insufficient', () => {
    const engine = new RecommendationEngine();
    const facts = createSoleBlockerFacts({
      soleBlockerSampleCount: 5, // Below 10 threshold
    });

    const recommendations = engine.generate(facts);

    const soleBlockerRec = recommendations.find(
      (r) => r.type === 'sole_blocker_edit'
    );
    expect(soleBlockerRec).toBeUndefined();
  });

  it('should not generate recommendation when P50 is missing', () => {
    const engine = new RecommendationEngine();
    const facts = createSoleBlockerFacts({
      soleBlockerP50: null,
    });

    const recommendations = engine.generate(facts);

    const soleBlockerRec = recommendations.find(
      (r) => r.type === 'sole_blocker_edit'
    );
    expect(soleBlockerRec).toBeUndefined();
  });

  it('should suggest "Raise" direction for < or <= operators', () => {
    const engine = new RecommendationEngine();
    const facts = createSoleBlockerFacts({
      operator: '<',
      clauseLabel: 'emotions.anger < 0.5',
    });

    const recommendations = engine.generate(facts);

    const soleBlockerRec = recommendations.find(
      (r) => r.type === 'sole_blocker_edit'
    );
    expect(soleBlockerRec.title).toContain('Raise');
    expect(soleBlockerRec.thresholdSuggestions[0].direction).toBe('raise');
  });

  it('should include evidence with current threshold and percentiles', () => {
    const engine = new RecommendationEngine();
    const facts = createSoleBlockerFacts();

    const recommendations = engine.generate(facts);

    const soleBlockerRec = recommendations.find(
      (r) => r.type === 'sole_blocker_edit'
    );
    expect(soleBlockerRec.evidence).toBeDefined();
    expect(soleBlockerRec.evidence.length).toBeGreaterThanOrEqual(3);

    const thresholdEvidence = soleBlockerRec.evidence.find(
      (e) => e.label === 'Current threshold'
    );
    expect(thresholdEvidence.value).toBe('0.50');
  });

  it('should include actions with specific threshold suggestions', () => {
    const engine = new RecommendationEngine();
    const facts = createSoleBlockerFacts();

    const recommendations = engine.generate(facts);

    const soleBlockerRec = recommendations.find(
      (r) => r.type === 'sole_blocker_edit'
    );
    expect(soleBlockerRec.actions).toBeDefined();
    expect(soleBlockerRec.actions.length).toBe(2);
    expect(soleBlockerRec.actions[0].label).toContain('Lower threshold to');
    expect(soleBlockerRec.actions[0].detail).toContain('50%');
  });

  it('should set confidence based on sample count', () => {
    const engine = new RecommendationEngine();

    // Low sample count
    const lowSampleFacts = createSoleBlockerFacts({
      soleBlockerSampleCount: 15,
    });
    const lowResult = engine.generate(lowSampleFacts);
    const lowRec = lowResult.find((r) => r.type === 'sole_blocker_edit');
    expect(lowRec.confidence).toBe('low');

    // High sample count (requires 500+ for "high" confidence)
    const highSampleFacts = createSoleBlockerFacts({
      soleBlockerSampleCount: 500,
    });
    const highResult = engine.generate(highSampleFacts);
    const highRec = highResult.find((r) => r.type === 'sole_blocker_edit');
    expect(highRec.confidence).toBe('high');
  });

  it('should include relatedClauseIds for linking', () => {
    const engine = new RecommendationEngine();
    const facts = createSoleBlockerFacts();

    const recommendations = engine.generate(facts);

    const soleBlockerRec = recommendations.find(
      (r) => r.type === 'sole_blocker_edit'
    );
    expect(soleBlockerRec.relatedClauseIds).toContain(
      'var:emotions.anger:>=:0.5'
    );
  });
});
