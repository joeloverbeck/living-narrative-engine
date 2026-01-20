/**
 * @file Integration tests for GateClampRecommendationBuilder with RecommendationEngine
 * @description Tests the full pipeline from RecommendationEngine through to builder,
 * verifying deterministic ordering and integration with the recommendation pipeline.
 */

import { describe, it, expect } from '@jest/globals';
import RecommendationEngine from '../../../../src/expressionDiagnostics/services/RecommendationEngine.js';
import GateClampRecommendationBuilder from '../../../../src/expressionDiagnostics/services/recommendationBuilders/GateClampRecommendationBuilder.js';

describe('GateClampRecommendation - Integration', () => {
  // === TEST FIXTURES ===

  /**
   * Creates a clause with gate clamp facts that will trigger recommendation.
   *
   * @param {object} overrides - Overrides for default clause.
   * @returns {object} Clause with gate clamp facts.
   */
  const createGateClampClause = (overrides = {}) => ({
    clauseId: 'var:mood.valence:>=:0.6',
    clauseLabel: 'mood.valence >= 0.6',
    clauseType: 'threshold',
    operator: '>=',
    impact: 0.35,
    thresholdValue: 0.6,
    gateClampRegimePermissive: {
      gateClampRateInRegime: 0.35, // Above MIN_RATE (0.2)
      allGatesImplied: false,
      moodRegimeCount: 500,
      gateFailInRegimeCount: 175,
      gatePassInRegimeCount: 325,
      candidates: [
        {
          id: 'candidate_valence_0.5',
          keepRatio: 0.65, // Above MIN_KEEP (0.5)
          keepCount: 325,
          keepDenominator: 500,
          predClampRate: 0.15, // Delta = 0.35 - 0.15 = 0.2, above MIN_DELTA (0.1)
          predSampleCount: 325,
          axes: [
            {
              axis: 'valence',
              operator: '>=',
              thresholdRaw: 0.5,
            },
          ],
        },
      ],
      gatePredicates: [
        {
          axis: 'valence',
          operator: '>=',
          threshold: 0.6,
          regimeBounds: { min: 0.3, max: 1.0 },
        },
      ],
      axisEvidence: [
        {
          axis: 'valence',
          operator: '>=',
          thresholdRaw: 0.6,
          fractionBelow: { count: 175, rate: 0.35, denominator: 500 },
          fractionAbove: { count: 325, rate: 0.65, denominator: 500 },
        },
      ],
    },
    ...overrides,
  });

  /**
   * Creates a dummy prototype entry to satisfy RecommendationEngine's guard.
   * The engine requires both clauses and prototypes to be non-empty.
   *
   * @returns {object} Minimal prototype object.
   */
  const createDummyPrototype = () => ({
    prototypeId: 'mood_valence_dummy',
    moodSampleCount: 500,
    gateFailCount: 50,
    gatePassCount: 450,
    thresholdPassGivenGateCount: 300,
    thresholdPassCount: 300,
    gateFailRate: 0.1,
    gatePassRate: 0.9,
    pThreshGivenGate: 0.67,
    pThreshEffective: 0.6,
    meanValueGivenGate: 0.65,
    failedGateCounts: [],
    compatibilityScore: 0.5,
  });

  /**
   * Creates diagnostic facts that will trigger gate_clamp_regime_permissive.
   *
   * @param {object} overrides - Overrides for the default facts.
   * @returns {object} Diagnostic facts object.
   */
  const createGateClampFacts = (overrides = {}) => ({
    expressionId: 'expr:gate-clamp-integration',
    sampleCount: 1000,
    moodRegime: {
      definition: { valence: { operator: '>=', value: 0.3 } },
      sampleCount: 500,
      bounds: { valence: { min: 0.3, max: 1.0 } },
    },
    storedMoodRegimeContexts: [],
    prototypeDefinitions: {},
    prototypeFit: { leaderboard: [] },
    gapDetection: { nearestDistance: 0.2, distancePercentile: 50 },
    targetSignature: {},
    overallPassRate: 0.25,
    clauses: [createGateClampClause()],
    // Need at least one prototype for RecommendationEngine's hasClauseData guard
    prototypes: [createDummyPrototype()],
    invariants: [{ id: 'rate:overallPassRate', ok: true, message: '' }],
    ...overrides,
  });

  /**
   * Creates diagnostic facts with multiple clauses that trigger gate clamp.
   *
   * @returns {object} Diagnostic facts with multiple gate clamp triggers.
   */
  const createMultiClauseGateClampFacts = () => ({
    expressionId: 'expr:multi-gate-clamp',
    sampleCount: 1000,
    moodRegime: {
      definition: { valence: { operator: '>=', value: 0.3 } },
      sampleCount: 500,
      bounds: { valence: { min: 0.3, max: 1.0 } },
    },
    storedMoodRegimeContexts: [],
    prototypeDefinitions: {},
    prototypeFit: { leaderboard: [] },
    gapDetection: { nearestDistance: 0.2, distancePercentile: 50 },
    targetSignature: {},
    overallPassRate: 0.2,
    clauses: [
      // First clause - higher impact
      createGateClampClause({
        clauseId: 'var:mood.valence:>=:0.6',
        impact: 0.4,
      }),
      // Second clause - different axis
      createGateClampClause({
        clauseId: 'var:mood.arousal:>=:0.5',
        impact: 0.3,
        gateClampRegimePermissive: {
          gateClampRateInRegime: 0.28,
          allGatesImplied: false,
          moodRegimeCount: 500,
          gateFailInRegimeCount: 140,
          gatePassInRegimeCount: 360,
          candidates: [
            {
              id: 'candidate_arousal_0.4',
              keepRatio: 0.72,
              keepCount: 360,
              keepDenominator: 500,
              predClampRate: 0.12,
              predSampleCount: 360,
              axes: [
                {
                  axis: 'arousal',
                  operator: '>=',
                  thresholdRaw: 0.4,
                },
              ],
            },
          ],
          gatePredicates: [
            {
              axis: 'arousal',
              operator: '>=',
              threshold: 0.5,
              regimeBounds: { min: 0.2, max: 0.9 },
            },
          ],
          axisEvidence: [],
        },
      }),
    ],
    // Need at least one prototype for RecommendationEngine's hasClauseData guard
    prototypes: [createDummyPrototype()],
    invariants: [{ id: 'rate:overallPassRate', ok: true, message: '' }],
  });

  // === FULL PIPELINE TESTS ===

  describe('Full pipeline with RecommendationEngine', () => {
    it('should generate gate_clamp_regime_permissive through RecommendationEngine', () => {
      const gateClampBuilder = new GateClampRecommendationBuilder();
      const engine = new RecommendationEngine({
        gateClampBuilder,
      });

      const facts = createGateClampFacts();
      const recommendations = engine.generate(facts);

      const gateClampRec = recommendations.find(
        (r) => r.type === 'gate_clamp_regime_permissive'
      );

      expect(gateClampRec).toBeDefined();
      expect(gateClampRec.title).toBe('Mood regime allows gate-clamped states');
      expect(gateClampRec.severity).toMatch(/high|medium|low/);
      expect(gateClampRec.confidence).toMatch(/high|medium|low/);
      expect(gateClampRec.evidence).toBeInstanceOf(Array);
      expect(gateClampRec.actions).toBeInstanceOf(Array);
    });

    it('should include correct evidence structure', () => {
      const gateClampBuilder = new GateClampRecommendationBuilder();
      const engine = new RecommendationEngine({
        gateClampBuilder,
      });

      const facts = createGateClampFacts();
      const recommendations = engine.generate(facts);

      const gateClampRec = recommendations.find(
        (r) => r.type === 'gate_clamp_regime_permissive'
      );

      expect(gateClampRec.evidence.length).toBeGreaterThan(0);

      // Check gate clamp rate evidence
      const clampRateEvidence = gateClampRec.evidence.find((e) =>
        e.label.includes('Gate clamp rate')
      );
      expect(clampRateEvidence).toBeDefined();
      expect(clampRateEvidence.value).toBeCloseTo(0.35, 2);
    });

    it('should include actions with axis hints', () => {
      const gateClampBuilder = new GateClampRecommendationBuilder();
      const engine = new RecommendationEngine({
        gateClampBuilder,
      });

      const facts = createGateClampFacts();
      const recommendations = engine.generate(facts);

      const gateClampRec = recommendations.find(
        (r) => r.type === 'gate_clamp_regime_permissive'
      );

      expect(gateClampRec.actions).toContain(
        'Tighten mood-regime axis constraints that allow gate-clamped states.'
      );
      // Should include axis hints from candidate
      const axisAction = gateClampRec.actions.find((a) =>
        a.includes('valence')
      );
      expect(axisAction).toBeDefined();
    });

    it('should NOT generate gate_clamp when clause does not meet criteria', () => {
      const gateClampBuilder = new GateClampRecommendationBuilder();
      const engine = new RecommendationEngine({
        gateClampBuilder,
      });

      // Create facts with low gate clamp rate (below MIN_RATE)
      const facts = createGateClampFacts({
        clauses: [
          createGateClampClause({
            gateClampRegimePermissive: {
              gateClampRateInRegime: 0.1, // Below MIN_RATE (0.2)
              allGatesImplied: false,
              moodRegimeCount: 500,
              candidates: [],
            },
          }),
        ],
      });

      const recommendations = engine.generate(facts);

      const gateClampRec = recommendations.find(
        (r) => r.type === 'gate_clamp_regime_permissive'
      );

      expect(gateClampRec).toBeUndefined();
    });
  });

  // === DETERMINISTIC ORDERING TESTS ===

  describe('Deterministic ordering', () => {
    it('should produce identical recommendation order across multiple runs', () => {
      const gateClampBuilder = new GateClampRecommendationBuilder();
      const engine = new RecommendationEngine({
        gateClampBuilder,
      });

      const facts = createMultiClauseGateClampFacts();

      // Run 5 times and verify identical order
      const runs = [];
      for (let i = 0; i < 5; i++) {
        const recommendations = engine.generate(facts);
        runs.push(recommendations.map((r) => r.id));
      }

      // All runs should have identical ID sequences
      for (let i = 1; i < runs.length; i++) {
        expect(runs[i]).toEqual(runs[0]);
      }
    });

    it('should produce identical output for identical input', () => {
      const gateClampBuilder = new GateClampRecommendationBuilder();
      const engine = new RecommendationEngine({
        gateClampBuilder,
      });

      const facts = createGateClampFacts();

      const recommendations1 = engine.generate(facts);
      const recommendations2 = engine.generate(facts);

      expect(recommendations1).toEqual(recommendations2);
    });

    it('should maintain severity-based ordering', () => {
      const gateClampBuilder = new GateClampRecommendationBuilder();
      const engine = new RecommendationEngine({
        gateClampBuilder,
      });

      const facts = createMultiClauseGateClampFacts();
      const recommendations = engine.generate(facts);

      // Verify sorted order: high severity before medium before low
      const severityOrder = { high: 0, medium: 1, low: 2 };
      for (let i = 1; i < recommendations.length; i++) {
        const prevSeverity = recommendations[i - 1].severity;
        const currSeverity = recommendations[i].severity;

        expect(severityOrder[currSeverity]).toBeGreaterThanOrEqual(
          severityOrder[prevSeverity]
        );
      }
    });
  });

  // === BUILDER ISOLATION TESTS ===

  describe('Builder isolation', () => {
    it('should produce same output whether called directly or through engine', () => {
      const builder = new GateClampRecommendationBuilder();
      const gateClampBuilder = new GateClampRecommendationBuilder();
      const engine = new RecommendationEngine({
        gateClampBuilder,
      });

      const clause = createGateClampClause();
      const facts = createGateClampFacts();

      // Direct builder call
      const directResult = builder.build(clause);

      // Through engine
      const engineResults = engine.generate(facts);
      const engineResult = engineResults.find(
        (r) => r.type === 'gate_clamp_regime_permissive'
      );

      // Should have same structure (IDs may differ based on clause processing)
      expect(directResult.type).toBe(engineResult.type);
      expect(directResult.title).toBe(engineResult.title);
      expect(directResult.severity).toBe(engineResult.severity);
      expect(directResult.predictedEffect).toBe(engineResult.predictedEffect);
    });

    it('should be stateless across multiple builds', () => {
      const builder = new GateClampRecommendationBuilder();

      const clause1 = createGateClampClause({ clauseId: 'clause1' });
      const clause2 = createGateClampClause({ clauseId: 'clause2' });

      const result1a = builder.build(clause1);
      const result2 = builder.build(clause2);
      const result1b = builder.build(clause1);

      // Results for same clause should be identical regardless of order
      expect(result1a).toEqual(result1b);
      // Results for different clauses should have different IDs
      expect(result1a.id).not.toBe(result2.id);
    });
  });

  // === EDGE CASES ===

  describe('Edge cases', () => {
    it('should handle empty clauses array', () => {
      const gateClampBuilder = new GateClampRecommendationBuilder();
      const engine = new RecommendationEngine({
        gateClampBuilder,
      });

      const facts = createGateClampFacts({ clauses: [] });
      const recommendations = engine.generate(facts);

      // Should not crash, may have no gate clamp recommendations
      expect(Array.isArray(recommendations)).toBe(true);
      const gateClampRec = recommendations.find(
        (r) => r.type === 'gate_clamp_regime_permissive'
      );
      expect(gateClampRec).toBeUndefined();
    });

    it('should handle invariant failures by returning empty array', () => {
      const gateClampBuilder = new GateClampRecommendationBuilder();
      const engine = new RecommendationEngine({
        gateClampBuilder,
      });

      const facts = createGateClampFacts({
        invariants: [{ id: 'rate:overallPassRate', ok: false, message: 'Failed' }],
      });

      const recommendations = engine.generate(facts);
      expect(recommendations).toEqual([]);
    });

    it('should handle null diagnosticFacts gracefully', () => {
      const gateClampBuilder = new GateClampRecommendationBuilder();
      const engine = new RecommendationEngine({
        gateClampBuilder,
      });

      const recommendations = engine.generate(null);
      expect(recommendations).toEqual([]);
    });

    it('should handle clause with missing gateClampRegimePermissive', () => {
      const gateClampBuilder = new GateClampRecommendationBuilder();
      const engine = new RecommendationEngine({
        gateClampBuilder,
      });

      const clause = createGateClampClause();
      delete clause.gateClampRegimePermissive;

      const facts = createGateClampFacts({ clauses: [clause] });
      const recommendations = engine.generate(facts);

      // Should not crash, just no gate clamp recommendation
      expect(Array.isArray(recommendations)).toBe(true);
    });
  });
});
