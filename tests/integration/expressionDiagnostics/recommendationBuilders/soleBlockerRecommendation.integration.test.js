/**
 * @file Integration tests for SoleBlockerRecommendationBuilder with RecommendationEngine
 * @description Tests the full pipeline from RecommendationEngine through to builder,
 * verifying deterministic ordering and integration with the recommendation pipeline.
 */

import { describe, it, expect } from '@jest/globals';
import RecommendationEngine from '../../../../src/expressionDiagnostics/services/RecommendationEngine.js';
import SoleBlockerRecommendationBuilder from '../../../../src/expressionDiagnostics/services/recommendationBuilders/SoleBlockerRecommendationBuilder.js';

describe('SoleBlockerRecommendation - Integration', () => {
  // === TEST FIXTURES ===

  /**
   * Creates a clause with sole-blocker facts that will trigger recommendation.
   *
   * @param {object} overrides - Overrides for default clause.
   * @returns {object} Clause with sole-blocker facts.
   */
  const createSoleBlockerClause = (overrides = {}) => ({
    clauseId: 'var:emotions.joy:>=:0.6',
    clauseLabel: 'emotions.joy >= 0.6',
    clauseType: 'threshold',
    operator: '>=',
    impact: 0.35,
    thresholdValue: 0.6,
    lastMileFailRate: 0.25, // Above MIN_RATE (0.1)
    soleBlockerSampleCount: 300, // Above MIN_SAMPLES (10)
    soleBlockerP50: 0.45,
    soleBlockerP90: 0.55,
    ...overrides,
  });

  /**
   * Creates a dummy prototype entry to satisfy RecommendationEngine's guard.
   * The engine requires both clauses and prototypes to be non-empty.
   *
   * @returns {object} Minimal prototype object.
   */
  const createDummyPrototype = () => ({
    prototypeId: 'emotions_joy_dummy',
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
   * Creates diagnostic facts that will trigger sole_blocker_edit.
   *
   * @param {object} overrides - Overrides for the default facts.
   * @returns {object} Diagnostic facts object.
   */
  const createSoleBlockerFacts = (overrides = {}) => ({
    expressionId: 'expr:sole-blocker-integration',
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
    clauses: [createSoleBlockerClause()],
    prototypes: [createDummyPrototype()],
    invariants: [{ id: 'rate:overallPassRate', ok: true, message: '' }],
    ...overrides,
  });

  /**
   * Creates diagnostic facts with multiple clauses that trigger sole-blocker.
   *
   * @returns {object} Diagnostic facts with multiple sole-blocker triggers.
   */
  const createMultiClauseSoleBlockerFacts = () => ({
    expressionId: 'expr:multi-sole-blocker',
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
      createSoleBlockerClause({
        clauseId: 'var:emotions.joy:>=:0.6',
        impact: 0.4,
        lastMileFailRate: 0.3,
      }),
      // Second clause - different variable
      createSoleBlockerClause({
        clauseId: 'var:emotions.sadness:>=:0.5',
        clauseLabel: 'emotions.sadness >= 0.5',
        impact: 0.25,
        thresholdValue: 0.5,
        lastMileFailRate: 0.2,
        soleBlockerSampleCount: 250,
        soleBlockerP50: 0.38,
        soleBlockerP90: 0.48,
      }),
    ],
    prototypes: [createDummyPrototype()],
    invariants: [{ id: 'rate:overallPassRate', ok: true, message: '' }],
  });

  // === FULL PIPELINE TESTS ===

  describe('Full pipeline with RecommendationEngine', () => {
    it('should generate sole_blocker_edit through RecommendationEngine', () => {
      const soleBlockerBuilder = new SoleBlockerRecommendationBuilder();
      const engine = new RecommendationEngine({
        soleBlockerBuilder,
      });

      const facts = createSoleBlockerFacts();
      const recommendations = engine.generate(facts);

      const soleBlockerRec = recommendations.find(
        (r) => r.type === 'sole_blocker_edit'
      );

      expect(soleBlockerRec).toBeDefined();
      expect(soleBlockerRec.title).toContain('Best First Edit:');
      expect(soleBlockerRec.severity).toMatch(/high|medium|low/);
      expect(soleBlockerRec.confidence).toMatch(/high|medium|low/);
      expect(soleBlockerRec.evidence).toBeInstanceOf(Array);
      expect(soleBlockerRec.actions).toBeInstanceOf(Array);
      expect(soleBlockerRec.thresholdSuggestions).toBeInstanceOf(Array);
    });

    it('should include correct evidence structure', () => {
      const soleBlockerBuilder = new SoleBlockerRecommendationBuilder();
      const engine = new RecommendationEngine({
        soleBlockerBuilder,
      });

      const facts = createSoleBlockerFacts();
      const recommendations = engine.generate(facts);

      const soleBlockerRec = recommendations.find(
        (r) => r.type === 'sole_blocker_edit'
      );

      expect(soleBlockerRec.evidence.length).toBeGreaterThan(0);

      // Check sole-blocker rate evidence
      const rateEvidence = soleBlockerRec.evidence.find(
        (e) => e.label === 'Sole-blocker rate'
      );
      expect(rateEvidence).toBeDefined();
      expect(rateEvidence.value).toBe('25%');
    });

    it('should include threshold suggestions with P50 and P90', () => {
      const soleBlockerBuilder = new SoleBlockerRecommendationBuilder();
      const engine = new RecommendationEngine({
        soleBlockerBuilder,
      });

      const facts = createSoleBlockerFacts();
      const recommendations = engine.generate(facts);

      const soleBlockerRec = recommendations.find(
        (r) => r.type === 'sole_blocker_edit'
      );

      expect(soleBlockerRec.thresholdSuggestions).toHaveLength(2);
      const percentiles = soleBlockerRec.thresholdSuggestions.map(
        (s) => s.percentile
      );
      expect(percentiles).toContain('P50');
      expect(percentiles).toContain('P90');
    });

    it('should NOT generate sole_blocker_edit when clause does not meet criteria', () => {
      const soleBlockerBuilder = new SoleBlockerRecommendationBuilder();
      const engine = new RecommendationEngine({
        soleBlockerBuilder,
      });

      // Create facts with low sole-blocker rate (below MIN_RATE)
      const facts = createSoleBlockerFacts({
        clauses: [
          createSoleBlockerClause({
            lastMileFailRate: 0.05, // Below MIN_RATE (0.1)
          }),
        ],
      });

      const recommendations = engine.generate(facts);

      const soleBlockerRec = recommendations.find(
        (r) => r.type === 'sole_blocker_edit'
      );

      expect(soleBlockerRec).toBeUndefined();
    });
  });

  // === COEXISTENCE WITH OTHER RECOMMENDATION TYPES ===

  describe('Coexistence with other recommendations', () => {
    it('should coexist with other recommendation types in output', () => {
      const soleBlockerBuilder = new SoleBlockerRecommendationBuilder();
      const engine = new RecommendationEngine({
        soleBlockerBuilder,
      });

      // Create facts that could trigger multiple types
      const facts = createSoleBlockerFacts();
      const recommendations = engine.generate(facts);

      // Sole-blocker should exist
      const soleBlockerRec = recommendations.find(
        (r) => r.type === 'sole_blocker_edit'
      );
      expect(soleBlockerRec).toBeDefined();

      // Output should be an array that could contain other types
      expect(Array.isArray(recommendations)).toBe(true);
    });
  });

  // === DETERMINISTIC ORDERING TESTS ===

  describe('Deterministic ordering', () => {
    it('should produce identical recommendation order across multiple runs', () => {
      const soleBlockerBuilder = new SoleBlockerRecommendationBuilder();
      const engine = new RecommendationEngine({
        soleBlockerBuilder,
      });

      const facts = createMultiClauseSoleBlockerFacts();

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
      const soleBlockerBuilder = new SoleBlockerRecommendationBuilder();
      const engine = new RecommendationEngine({
        soleBlockerBuilder,
      });

      const facts = createSoleBlockerFacts();

      const recommendations1 = engine.generate(facts);
      const recommendations2 = engine.generate(facts);

      expect(recommendations1).toEqual(recommendations2);
    });

    it('should maintain severity-based ordering', () => {
      const soleBlockerBuilder = new SoleBlockerRecommendationBuilder();
      const engine = new RecommendationEngine({
        soleBlockerBuilder,
      });

      const facts = createMultiClauseSoleBlockerFacts();
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
      const builder = new SoleBlockerRecommendationBuilder();
      const soleBlockerBuilder = new SoleBlockerRecommendationBuilder();
      const engine = new RecommendationEngine({
        soleBlockerBuilder,
      });

      const clause = createSoleBlockerClause();
      const facts = createSoleBlockerFacts();

      // Direct builder call
      const directResult = builder.build(clause);

      // Through engine
      const engineResults = engine.generate(facts);
      const engineResult = engineResults.find(
        (r) => r.type === 'sole_blocker_edit'
      );

      // Should have same structure
      expect(directResult.type).toBe(engineResult.type);
      expect(directResult.title).toBe(engineResult.title);
      expect(directResult.severity).toBe(engineResult.severity);
      expect(directResult.predictedEffect).toBe(engineResult.predictedEffect);
    });

    it('should be stateless across multiple builds', () => {
      const builder = new SoleBlockerRecommendationBuilder();

      const clause1 = createSoleBlockerClause({ clauseId: 'clause1' });
      const clause2 = createSoleBlockerClause({ clauseId: 'clause2' });

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
      const soleBlockerBuilder = new SoleBlockerRecommendationBuilder();
      const engine = new RecommendationEngine({
        soleBlockerBuilder,
      });

      const facts = createSoleBlockerFacts({ clauses: [] });
      const recommendations = engine.generate(facts);

      expect(Array.isArray(recommendations)).toBe(true);
      const soleBlockerRec = recommendations.find(
        (r) => r.type === 'sole_blocker_edit'
      );
      expect(soleBlockerRec).toBeUndefined();
    });

    it('should handle invariant failures by returning empty array', () => {
      const soleBlockerBuilder = new SoleBlockerRecommendationBuilder();
      const engine = new RecommendationEngine({
        soleBlockerBuilder,
      });

      const facts = createSoleBlockerFacts({
        invariants: [
          { id: 'rate:overallPassRate', ok: false, message: 'Failed' },
        ],
      });

      const recommendations = engine.generate(facts);
      expect(recommendations).toEqual([]);
    });

    it('should handle null diagnosticFacts gracefully', () => {
      const soleBlockerBuilder = new SoleBlockerRecommendationBuilder();
      const engine = new RecommendationEngine({
        soleBlockerBuilder,
      });

      const recommendations = engine.generate(null);
      expect(recommendations).toEqual([]);
    });

    it('should handle clause with missing sole-blocker data', () => {
      const soleBlockerBuilder = new SoleBlockerRecommendationBuilder();
      const engine = new RecommendationEngine({
        soleBlockerBuilder,
      });

      const clause = createSoleBlockerClause();
      delete clause.lastMileFailRate;

      const facts = createSoleBlockerFacts({ clauses: [clause] });
      const recommendations = engine.generate(facts);

      // Should not crash, just no sole-blocker recommendation
      expect(Array.isArray(recommendations)).toBe(true);
    });
  });
});
