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
