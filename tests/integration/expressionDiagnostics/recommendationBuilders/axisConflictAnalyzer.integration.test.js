/**
 * @file Integration tests for AxisConflictAnalyzer with RecommendationEngine
 * @description Tests the full pipeline from RecommendationEngine through to analyzer,
 * verifying axis sign conflict recommendations are correctly generated.
 */

import { describe, it, expect } from '@jest/globals';
import RecommendationEngine from '../../../../src/expressionDiagnostics/services/RecommendationEngine.js';
import AxisConflictAnalyzer from '../../../../src/expressionDiagnostics/services/recommendationBuilders/AxisConflictAnalyzer.js';
import GateClampRecommendationBuilder from '../../../../src/expressionDiagnostics/services/recommendationBuilders/GateClampRecommendationBuilder.js';

describe('AxisConflictAnalyzer - Integration', () => {
  // === TEST FIXTURES ===

  /**
   * Creates a prototype with axis conflicts that will trigger recommendation.
   *
   * @param {object} overrides - Overrides for default prototype.
   * @returns {object} Prototype with axis conflicts.
   */
  const createAxisConflictPrototype = (overrides = {}) => ({
    prototypeId: 'joy',
    moodSampleCount: 500,
    gateFailCount: 100,
    gatePassCount: 400,
    thresholdPassGivenGateCount: 40,
    thresholdPassCount: 40,
    gateFailRate: 0.2,
    gatePassRate: 0.8,
    pThreshGivenGate: 0.1, // Low pass rate to trigger axis sign conflict
    pThreshEffective: 0.08,
    meanValueGivenGate: 0.35,
    failedGateCounts: [],
    compatibilityScore: 0.3,
    axisConflicts: [
      {
        axis: 'valence',
        conflictType: 'sign_mismatch',
        weight: -0.5,
        constraintMin: 0.3,
        constraintMax: 1.0,
        lostRawSum: 0.25,
        lostIntensity: 0.15,
        sources: [
          {
            varPath: 'mood.valence',
            operator: '>=',
            threshold: 0.6,
          },
        ],
      },
    ],
    ...overrides,
  });

  /**
   * Creates a clause that will trigger axis sign conflict analysis.
   *
   * @param {object} overrides - Overrides for default clause.
   * @returns {object} Clause with prototype link.
   */
  const createAxisConflictClause = (overrides = {}) => ({
    clauseId: 'var:mood.valence:>=:0.6',
    clauseLabel: 'mood.valence >= 0.6',
    clauseType: 'threshold',
    operator: '>=', // Blocking operator required for axis sign conflict
    impact: 0.35,
    thresholdValue: 0.6,
    prototypeId: 'joy',
    lostPassRateInRegime: 0.15,
    ...overrides,
  });

  /**
   * Creates diagnostic facts that will trigger axis_sign_conflict.
   *
   * @param {object} overrides - Overrides for the default facts.
   * @returns {object} Diagnostic facts object.
   */
  const createAxisConflictFacts = (overrides = {}) => ({
    expressionId: 'expr:axis-conflict-integration',
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
    overallPassRate: 0.08,
    clauses: [createAxisConflictClause()],
    prototypes: [createAxisConflictPrototype()],
    invariants: [{ id: 'rate:overallPassRate', ok: true, message: '' }],
    ...overrides,
  });

  /**
   * Creates a mock EmotionSimilarityService for testing alternative suggestions.
   *
   * @returns {object} Mock emotion similarity service.
   */
  const createMockEmotionSimilarityService = () => ({
    // eslint-disable-next-line no-unused-vars
    findEmotionsWithCompatibleAxisSign: (axisName, targetSign, minWeight, maxResults) => {
      if (axisName === 'valence' && targetSign === 'positive') {
        return [
          { emotionName: 'contentment', axisWeight: 0.6 },
          { emotionName: 'serenity', axisWeight: 0.4 },
        ];
      }
      return [];
    },
  });

  // === FULL PIPELINE TESTS ===

  describe('Full pipeline with RecommendationEngine', () => {
    it('should generate axis_sign_conflict through RecommendationEngine', () => {
      const axisConflictAnalyzer = new AxisConflictAnalyzer();
      const gateClampBuilder = new GateClampRecommendationBuilder();
      const engine = new RecommendationEngine({
        axisConflictAnalyzer,
        gateClampBuilder,
      });

      const facts = createAxisConflictFacts();
      const recommendations = engine.generate(facts);

      const axisConflictRec = recommendations.find(
        (r) => r.type === 'axis_sign_conflict'
      );

      expect(axisConflictRec).toBeDefined();
      expect(axisConflictRec.title).toBe('Prototype axis sign conflict');
      expect(axisConflictRec.severity).toMatch(/high|medium|low/);
      expect(axisConflictRec.confidence).toMatch(/high|medium|low/);
      expect(axisConflictRec.evidence).toBeInstanceOf(Array);
      expect(axisConflictRec.actions).toBeInstanceOf(Array);
    });

    it('should include binary choice framing in structuredActions', () => {
      const axisConflictAnalyzer = new AxisConflictAnalyzer();
      const gateClampBuilder = new GateClampRecommendationBuilder();
      const engine = new RecommendationEngine({
        axisConflictAnalyzer,
        gateClampBuilder,
      });

      const facts = createAxisConflictFacts();
      const recommendations = engine.generate(facts);

      const axisConflictRec = recommendations.find(
        (r) => r.type === 'axis_sign_conflict'
      );

      expect(axisConflictRec.structuredActions).toBeDefined();
      expect(axisConflictRec.structuredActions.options).toHaveLength(2);

      const optionA = axisConflictRec.structuredActions.options.find(
        (o) => o.id === 'relax_regime'
      );
      const optionB = axisConflictRec.structuredActions.options.find(
        (o) => o.id === 'change_emotion'
      );

      expect(optionA).toBeDefined();
      expect(optionA.label).toBe('Option A: Keep emotion, adjust regime');
      expect(optionB).toBeDefined();
      expect(optionB.label).toBe('Option B: Keep regime, change emotion');
    });

    it('should include axis conflict evidence with conflict details', () => {
      const axisConflictAnalyzer = new AxisConflictAnalyzer();
      const gateClampBuilder = new GateClampRecommendationBuilder();
      const engine = new RecommendationEngine({
        axisConflictAnalyzer,
        gateClampBuilder,
      });

      const facts = createAxisConflictFacts();
      const recommendations = engine.generate(facts);

      const axisConflictRec = recommendations.find(
        (r) => r.type === 'axis_sign_conflict'
      );

      // Find axis conflict evidence
      const conflictEvidence = axisConflictRec.evidence.find(
        (e) => e.label && e.label.includes('Axis conflict')
      );

      expect(conflictEvidence).toBeDefined();
      expect(conflictEvidence.axis).toBe('valence');
      expect(conflictEvidence.weight).toBe(-0.5);
      expect(conflictEvidence.lostIntensity).toBe(0.15);
    });

    it('should include predicted effect with option guidance', () => {
      const axisConflictAnalyzer = new AxisConflictAnalyzer();
      const gateClampBuilder = new GateClampRecommendationBuilder();
      const engine = new RecommendationEngine({
        axisConflictAnalyzer,
        gateClampBuilder,
      });

      const facts = createAxisConflictFacts();
      const recommendations = engine.generate(facts);

      const axisConflictRec = recommendations.find(
        (r) => r.type === 'axis_sign_conflict'
      );

      expect(axisConflictRec.predictedEffect).toBe(
        'Choose Option A or B based on your design intent.'
      );
    });
  });

  // === ALTERNATIVE EMOTION SUGGESTIONS ===

  describe('Alternative emotion suggestions', () => {
    it('should include alternative emotions when EmotionSimilarityService is provided', () => {
      const mockService = createMockEmotionSimilarityService();
      const axisConflictAnalyzer = new AxisConflictAnalyzer({
        emotionSimilarityService: mockService,
      });
      const gateClampBuilder = new GateClampRecommendationBuilder();
      const engine = new RecommendationEngine({
        axisConflictAnalyzer,
        gateClampBuilder,
      });

      const facts = createAxisConflictFacts();
      const recommendations = engine.generate(facts);

      const axisConflictRec = recommendations.find(
        (r) => r.type === 'axis_sign_conflict'
      );

      // Check Option B has alternatives
      const optionB = axisConflictRec.structuredActions.options.find(
        (o) => o.id === 'change_emotion'
      );

      expect(optionB.alternatives).toBeDefined();
      expect(optionB.alternatives.length).toBeGreaterThan(0);
      expect(optionB.alternatives[0].emotionName).toBe('contentment');
    });

    it('should include alternative suggestions in actions text', () => {
      const mockService = createMockEmotionSimilarityService();
      const axisConflictAnalyzer = new AxisConflictAnalyzer({
        emotionSimilarityService: mockService,
      });
      const gateClampBuilder = new GateClampRecommendationBuilder();
      const engine = new RecommendationEngine({
        axisConflictAnalyzer,
        gateClampBuilder,
      });

      const facts = createAxisConflictFacts();
      const recommendations = engine.generate(facts);

      const axisConflictRec = recommendations.find(
        (r) => r.type === 'axis_sign_conflict'
      );

      // Should have action text mentioning alternative emotions
      const hasAlternativeAction = axisConflictRec.actions.some(
        (a) => a.includes('Consider:') && a.includes('contentment')
      );

      expect(hasAlternativeAction).toBe(true);
    });

    it('should work without EmotionSimilarityService', () => {
      const axisConflictAnalyzer = new AxisConflictAnalyzer();
      const gateClampBuilder = new GateClampRecommendationBuilder();
      const engine = new RecommendationEngine({
        axisConflictAnalyzer,
        gateClampBuilder,
      });

      const facts = createAxisConflictFacts();
      const recommendations = engine.generate(facts);

      const axisConflictRec = recommendations.find(
        (r) => r.type === 'axis_sign_conflict'
      );

      // Should still produce recommendation without alternatives
      expect(axisConflictRec).toBeDefined();

      const optionB = axisConflictRec.structuredActions.options.find(
        (o) => o.id === 'change_emotion'
      );

      expect(optionB.alternatives).toEqual([]);
    });
  });

  // === OPERATOR SUPPRESSION TESTS ===

  describe('Axis sign conflict suppression for <= operator', () => {
    it('should NOT generate axis_sign_conflict for <= operator clauses', () => {
      const axisConflictAnalyzer = new AxisConflictAnalyzer();
      const gateClampBuilder = new GateClampRecommendationBuilder();
      const engine = new RecommendationEngine({
        axisConflictAnalyzer,
        gateClampBuilder,
      });

      const facts = createAxisConflictFacts({
        clauses: [
          createAxisConflictClause({
            operator: '<=', // Non-blocking operator
          }),
        ],
      });

      const recommendations = engine.generate(facts);

      const axisConflictRec = recommendations.find(
        (r) => r.type === 'axis_sign_conflict'
      );

      expect(axisConflictRec).toBeUndefined();
    });

    it('should NOT generate axis_sign_conflict for < operator clauses', () => {
      const axisConflictAnalyzer = new AxisConflictAnalyzer();
      const gateClampBuilder = new GateClampRecommendationBuilder();
      const engine = new RecommendationEngine({
        axisConflictAnalyzer,
        gateClampBuilder,
      });

      const facts = createAxisConflictFacts({
        clauses: [
          createAxisConflictClause({
            operator: '<', // Non-blocking operator
          }),
        ],
      });

      const recommendations = engine.generate(facts);

      const axisConflictRec = recommendations.find(
        (r) => r.type === 'axis_sign_conflict'
      );

      expect(axisConflictRec).toBeUndefined();
    });

    it('should generate axis_sign_conflict for > operator clauses', () => {
      const axisConflictAnalyzer = new AxisConflictAnalyzer();
      const gateClampBuilder = new GateClampRecommendationBuilder();
      const engine = new RecommendationEngine({
        axisConflictAnalyzer,
        gateClampBuilder,
      });

      const facts = createAxisConflictFacts({
        clauses: [
          createAxisConflictClause({
            operator: '>', // Blocking operator
          }),
        ],
      });

      const recommendations = engine.generate(facts);

      const axisConflictRec = recommendations.find(
        (r) => r.type === 'axis_sign_conflict'
      );

      expect(axisConflictRec).toBeDefined();
    });
  });

  // === DETERMINISTIC ORDERING TESTS ===

  describe('Deterministic ordering', () => {
    it('should produce identical recommendation order across multiple runs', () => {
      const axisConflictAnalyzer = new AxisConflictAnalyzer();
      const gateClampBuilder = new GateClampRecommendationBuilder();
      const engine = new RecommendationEngine({
        axisConflictAnalyzer,
        gateClampBuilder,
      });

      const facts = createAxisConflictFacts();

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
      const axisConflictAnalyzer = new AxisConflictAnalyzer();
      const gateClampBuilder = new GateClampRecommendationBuilder();
      const engine = new RecommendationEngine({
        axisConflictAnalyzer,
        gateClampBuilder,
      });

      const facts = createAxisConflictFacts();

      const recommendations1 = engine.generate(facts);
      const recommendations2 = engine.generate(facts);

      expect(recommendations1).toEqual(recommendations2);
    });
  });

  // === EDGE CASES ===

  describe('Edge cases', () => {
    it('should handle prototype without axisConflicts', () => {
      const axisConflictAnalyzer = new AxisConflictAnalyzer();
      const gateClampBuilder = new GateClampRecommendationBuilder();
      const engine = new RecommendationEngine({
        axisConflictAnalyzer,
        gateClampBuilder,
      });

      const facts = createAxisConflictFacts({
        prototypes: [
          createAxisConflictPrototype({
            axisConflicts: [], // Empty axis conflicts
          }),
        ],
      });

      const recommendations = engine.generate(facts);

      const axisConflictRec = recommendations.find(
        (r) => r.type === 'axis_sign_conflict'
      );

      expect(axisConflictRec).toBeUndefined();
    });

    it('should handle prototype with high pThreshGivenGate (no choke)', () => {
      const axisConflictAnalyzer = new AxisConflictAnalyzer();
      const gateClampBuilder = new GateClampRecommendationBuilder();
      const engine = new RecommendationEngine({
        axisConflictAnalyzer,
        gateClampBuilder,
      });

      const facts = createAxisConflictFacts({
        prototypes: [
          createAxisConflictPrototype({
            pThreshGivenGate: 0.96, // Above CHOKE_PASS_GIVEN_GATE_MAX (0.95) - no choke
          }),
        ],
      });

      const recommendations = engine.generate(facts);

      const axisConflictRec = recommendations.find(
        (r) => r.type === 'axis_sign_conflict'
      );

      expect(axisConflictRec).toBeUndefined();
    });

    it('should handle multiple axis conflicts', () => {
      const axisConflictAnalyzer = new AxisConflictAnalyzer();
      const gateClampBuilder = new GateClampRecommendationBuilder();
      const engine = new RecommendationEngine({
        axisConflictAnalyzer,
        gateClampBuilder,
      });

      const facts = createAxisConflictFacts({
        prototypes: [
          createAxisConflictPrototype({
            axisConflicts: [
              {
                axis: 'valence',
                conflictType: 'sign_mismatch',
                weight: -0.5,
                constraintMin: 0.3,
                constraintMax: 1.0,
                lostRawSum: 0.25,
                lostIntensity: 0.15,
                sources: [{ varPath: 'mood.valence', operator: '>=', threshold: 0.6 }],
              },
              {
                axis: 'arousal',
                conflictType: 'sign_mismatch',
                weight: -0.3,
                constraintMin: 0.2,
                constraintMax: 0.8,
                lostRawSum: 0.18,
                lostIntensity: 0.12,
                sources: [{ varPath: 'mood.arousal', operator: '>=', threshold: 0.5 }],
              },
            ],
          }),
        ],
      });

      const recommendations = engine.generate(facts);

      const axisConflictRec = recommendations.find(
        (r) => r.type === 'axis_sign_conflict'
      );

      expect(axisConflictRec).toBeDefined();
      // Should include evidence for multiple conflicts (limited to 3)
      const conflictEvidence = axisConflictRec.evidence.filter(
        (e) => e.label && e.label.includes('Axis conflict')
      );
      expect(conflictEvidence.length).toBe(2);
    });

    it('should handle invariant failures by returning empty array', () => {
      const axisConflictAnalyzer = new AxisConflictAnalyzer();
      const gateClampBuilder = new GateClampRecommendationBuilder();
      const engine = new RecommendationEngine({
        axisConflictAnalyzer,
        gateClampBuilder,
      });

      const facts = createAxisConflictFacts({
        invariants: [{ id: 'rate:overallPassRate', ok: false, message: 'Failed' }],
      });

      const recommendations = engine.generate(facts);
      expect(recommendations).toEqual([]);
    });

    it('should handle null diagnosticFacts gracefully', () => {
      const axisConflictAnalyzer = new AxisConflictAnalyzer();
      const gateClampBuilder = new GateClampRecommendationBuilder();
      const engine = new RecommendationEngine({
        axisConflictAnalyzer,
        gateClampBuilder,
      });

      const recommendations = engine.generate(null);
      expect(recommendations).toEqual([]);
    });
  });
});
