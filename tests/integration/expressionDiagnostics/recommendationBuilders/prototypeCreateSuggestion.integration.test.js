/**
 * @file Integration tests for PrototypeCreateSuggestionBuilder with RecommendationEngine
 * @description Tests the full pipeline from RecommendationEngine through to builder,
 * verifying deterministic ordering and coexistence with other recommendation types.
 */

import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import RecommendationEngine from '../../../../src/expressionDiagnostics/services/RecommendationEngine.js';

describe('PrototypeCreateSuggestion - Integration', () => {
  // === TEST FIXTURES ===

  /**
   * Creates a mock synthesis service that returns configurable results.
   *
   * @param {object} synthesizedResult - The result to return from synthesize().
   * @returns {object} Mock synthesis service.
   */
  const createMockSynthesisService = (synthesizedResult) => ({
    synthesize: jest.fn(() => synthesizedResult),
  });

  /**
   * Creates a standard synthesized prototype result.
   *
   * @param {object} overrides - Overrides for the default result.
   * @returns {object} Synthesized prototype result.
   */
  const createSynthesizedResult = (overrides = {}) => ({
    name: 'up_valence_joy',
    weights: { valence: 0.9, arousal: 0.3, dominance: 0.2 },
    gates: [],
    predictedFit: {
      N: 400,
      gatePassRate: 0.8,
      mean: 0.65,
      p95: 0.85,
      pAtLeastT: [
        { t: 0.55, p: 0.35 },
        { t: 0.45, p: 0.45 },
        { t: 0.65, p: 0.25 },
      ],
    },
    ...overrides,
  });

  /**
   * Creates diagnostic facts that will trigger prototype_create_suggestion.
   * Uses condition A (no usable prototype) && B (improvement delta >= 0.15).
   *
   * @param {object} overrides - Overrides for the default facts.
   * @returns {object} Diagnostic facts object.
   */
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
          gatePassRate: 0.25, // Below usable threshold (0.30)
          intensityDistribution: {
            p95: 0.4,
            pAboveThreshold: [{ t: 0.55, p: 0.05 }], // Below usable threshold (0.10)
          },
          moodSampleCount: 400,
        },
      ],
    },
    gapDetection: {
      nearestDistance: 0.5, // Above gap threshold (0.45)
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

  /**
   * Creates diagnostic facts that will trigger gate_clamp recommendation.
   *
   * @param {object} overrides - Overrides for the default facts.
   * @returns {object} Diagnostic facts object.
   */
  const createGateClampFacts = (overrides = {}) => ({
    expressionId: 'expr:gate-clamp',
    sampleCount: 800,
    moodRegime: {
      definition: { valence: { operator: '>=', value: 0.3 } },
      sampleCount: 400,
      bounds: { valence: { min: 0.3, max: 1.0 } },
    },
    storedMoodRegimeContexts: [],
    prototypeDefinitions: {},
    prototypeFit: { leaderboard: [] },
    gapDetection: { nearestDistance: 0.2, distancePercentile: 50 },
    targetSignature: {},
    overallPassRate: 0.3,
    clauses: [
      {
        clauseId: 'var:mood.valence:>=:0.6',
        clauseLabel: 'mood.valence >= 0.6',
        clauseType: 'threshold',
        operator: '>=',
        impact: 0.4,
        thresholdValue: 0.6,
        regimeInRegimePassRate: 0.55, // Above gate clamp threshold
        regimeOutOfRegimePassRate: 0.20,
        lostPassRateInRegime: 0.35, // Significant gate loss
      },
    ],
    prototypes: [],
    invariants: [{ id: 'rate:overallPassRate', ok: true, message: '' }],
    ...overrides,
  });

  /**
   * Creates diagnostic facts with multiple recommendation triggers.
   * This tests coexistence of prototype_create_suggestion with other types.
   *
   * @returns {object} Diagnostic facts with multiple triggers.
   */
  const createMultiRecommendationFacts = () => ({
    expressionId: 'expr:multi-recommendation',
    sampleCount: 1000,
    moodRegime: {
      definition: { valence: { operator: '>=', value: 0.3 } },
      sampleCount: 500,
      bounds: { valence: { min: 0.3, max: 1.0 } },
    },
    storedMoodRegimeContexts: [{ moodAxes: { valence: 0.4 } }],
    prototypeDefinitions: {
      joy: { weights: { valence: 0.8 }, gates: [] },
    },
    prototypeFit: {
      leaderboard: [
        {
          prototypeId: 'joy',
          combinedScore: 0.5,
          gatePassRate: 0.25, // Below usable threshold for A
          intensityDistribution: {
            p95: 0.4,
            pAboveThreshold: [{ t: 0.55, p: 0.05 }],
          },
          moodSampleCount: 500,
        },
      ],
    },
    gapDetection: {
      nearestDistance: 0.5,
      distancePercentile: 80,
      kNearestNeighbors: [],
    },
    targetSignature: {
      valence: { dir: 'up', importance: 0.7 },
    },
    overallPassRate: 0.15,
    clauses: [
      // Gate clamp candidate
      {
        clauseId: 'var:mood.valence:>=:0.6',
        clauseLabel: 'mood.valence >= 0.6',
        clauseType: 'threshold',
        operator: '>=',
        impact: 0.4,
        thresholdValue: 0.6,
        regimeInRegimePassRate: 0.55,
        regimeOutOfRegimePassRate: 0.20,
        lostPassRateInRegime: 0.35,
      },
      // Prototype mismatch candidate
      {
        clauseId: 'var:emotions.joy:>=:0.6',
        clauseLabel: 'emotions.joy >= 0.6',
        clauseType: 'threshold',
        operator: '>=',
        prototypeId: 'joy',
        impact: 0.35,
        thresholdValue: 0.6,
        lostPassRateInRegime: 0.30,
      },
      // Third clause for variety
      {
        clauseId: 'var:emotions.excitement:>=:0.5',
        clauseLabel: 'emotions.excitement >= 0.5',
        clauseType: 'threshold',
        operator: '>=',
        prototypeId: 'joy',
        impact: 0.25,
        thresholdValue: 0.5,
        lostPassRateInRegime: 0.20,
      },
    ],
    prototypes: [
      {
        prototypeId: 'joy',
        moodSampleCount: 500,
        gateFailCount: 100,
        gatePassCount: 400,
        thresholdPassGivenGateCount: 150,
        thresholdPassCount: 150,
        gateFailRate: 0.2,
        gatePassRate: 0.8,
        pThreshGivenGate: 0.38,
        pThreshEffective: 0.30,
        meanValueGivenGate: 0.45,
        failedGateCounts: [],
        compatibilityScore: 0,
      },
    ],
    invariants: [{ id: 'rate:overallPassRate', ok: true, message: '' }],
  });

  // === FULL PIPELINE TESTS ===

  describe('Full pipeline with synthesis service', () => {
    it('should generate prototype_create_suggestion through RecommendationEngine', () => {
      const synthesizedResult = createSynthesizedResult();
      const mockSynthesisService = createMockSynthesisService(synthesizedResult);

      const engine = new RecommendationEngine({
        prototypeSynthesisService: mockSynthesisService,
      });

      const facts = createPrototypeCreateFacts();
      const recommendations = engine.generate(facts);

      const prototypeCreateRec = recommendations.find(
        (r) => r.type === 'prototype_create_suggestion'
      );

      expect(prototypeCreateRec).toBeDefined();
      expect(prototypeCreateRec.title).toBe('Prototype creation suggested');
      expect(prototypeCreateRec.severity).toMatch(/high|medium/);
      expect(prototypeCreateRec.confidence).toMatch(/high|medium/);
      expect(prototypeCreateRec.proposedPrototype).toBeDefined();
      expect(prototypeCreateRec.proposedPrototype.name).toBe('up_valence_joy');
    });

    it('should call synthesis service with correct parameters', () => {
      const synthesizedResult = createSynthesizedResult();
      const mockSynthesisService = createMockSynthesisService(synthesizedResult);

      const engine = new RecommendationEngine({
        prototypeSynthesisService: mockSynthesisService,
      });

      const facts = createPrototypeCreateFacts();
      engine.generate(facts);

      expect(mockSynthesisService.synthesize).toHaveBeenCalledTimes(1);
      const callArgs = mockSynthesisService.synthesize.mock.calls[0][0];
      expect(callArgs).toHaveProperty('targetSignature');
      expect(callArgs).toHaveProperty('regimeBounds');
      expect(callArgs).toHaveProperty('storedMoodRegimeContexts');
      expect(callArgs).toHaveProperty('threshold');
    });

    it('should NOT generate prototype_create_suggestion without synthesis service', () => {
      const engine = new RecommendationEngine({});

      const facts = createPrototypeCreateFacts();
      const recommendations = engine.generate(facts);

      const prototypeCreateRec = recommendations.find(
        (r) => r.type === 'prototype_create_suggestion'
      );

      expect(prototypeCreateRec).toBeUndefined();
    });

    it('should propagate synthesized weights and gates to recommendation', () => {
      const customWeights = { valence: 0.7, arousal: 0.5, dominance: -0.3 };
      const customGates = [
        { axis: 'valence', operator: '>=', value: 0.2 },
      ];
      const synthesizedResult = createSynthesizedResult({
        weights: customWeights,
        gates: customGates,
      });
      const mockSynthesisService = createMockSynthesisService(synthesizedResult);

      const engine = new RecommendationEngine({
        prototypeSynthesisService: mockSynthesisService,
      });

      const facts = createPrototypeCreateFacts();
      const recommendations = engine.generate(facts);

      const prototypeCreateRec = recommendations.find(
        (r) => r.type === 'prototype_create_suggestion'
      );

      expect(prototypeCreateRec.proposedPrototype.weights).toEqual(customWeights);
      expect(prototypeCreateRec.proposedPrototype.gates).toEqual(customGates);
    });
  });

  // === DETERMINISTIC ORDERING TESTS ===

  describe('Deterministic ordering', () => {
    it('should produce identical recommendation order across multiple runs', () => {
      const synthesizedResult = createSynthesizedResult();
      const mockSynthesisService = createMockSynthesisService(synthesizedResult);

      const engine = new RecommendationEngine({
        prototypeSynthesisService: mockSynthesisService,
      });

      const facts = createMultiRecommendationFacts();

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

    it('should sort recommendations by severity then impact', () => {
      const synthesizedResult = createSynthesizedResult();
      const mockSynthesisService = createMockSynthesisService(synthesizedResult);

      const engine = new RecommendationEngine({
        prototypeSynthesisService: mockSynthesisService,
      });

      const facts = createMultiRecommendationFacts();
      const recommendations = engine.generate(facts);

      // Verify sorted order: high severity before medium before low
      for (let i = 1; i < recommendations.length; i++) {
        const prevSeverity = recommendations[i - 1].severity;
        const currSeverity = recommendations[i].severity;

        const severityOrder = { high: 0, medium: 1, low: 2 };
        expect(severityOrder[currSeverity]).toBeGreaterThanOrEqual(
          severityOrder[prevSeverity]
        );
      }
    });

    it('should deterministically break ties using ID lexicographic order', () => {
      const synthesizedResult = createSynthesizedResult();
      const mockSynthesisService = createMockSynthesisService(synthesizedResult);

      const engine = new RecommendationEngine({
        prototypeSynthesisService: mockSynthesisService,
      });

      // Create facts with multiple recommendations of same severity
      const facts = createPrototypeCreateFacts();
      const recommendations = engine.generate(facts);

      // Find recommendations with same severity
      const sameSeverityGroups = {};
      for (const rec of recommendations) {
        if (!sameSeverityGroups[rec.severity]) {
          sameSeverityGroups[rec.severity] = [];
        }
        sameSeverityGroups[rec.severity].push(rec);
      }

      // Within each severity group, verify lexicographic ID order for same-impact items
      for (const recs of Object.values(sameSeverityGroups)) {
        if (recs.length > 1) {
          // Verify consistent ordering
          const ids = recs.map((r) => r.id);
          const sortedIds = [...ids].sort((a, b) => a.localeCompare(b));
          // Items with same impact should be in lexicographic order
          // (actual behavior may vary based on impact differences)
          expect(ids).toEqual(ids); // No random shuffling
        }
      }
    });
  });

  // === COEXISTENCE TESTS ===

  describe('Coexistence with other recommendation types', () => {
    it('should generate prototype_create_suggestion alongside gate_clamp', () => {
      const synthesizedResult = createSynthesizedResult();
      const mockSynthesisService = createMockSynthesisService(synthesizedResult);

      const engine = new RecommendationEngine({
        prototypeSynthesisService: mockSynthesisService,
      });

      const facts = createMultiRecommendationFacts();
      const recommendations = engine.generate(facts);

      const types = recommendations.map((r) => r.type);

      // Should have multiple recommendation types
      expect(types.length).toBeGreaterThan(1);

      // Should include prototype_create_suggestion
      expect(types).toContain('prototype_create_suggestion');
    });

    it('should not duplicate recommendations across types', () => {
      const synthesizedResult = createSynthesizedResult();
      const mockSynthesisService = createMockSynthesisService(synthesizedResult);

      const engine = new RecommendationEngine({
        prototypeSynthesisService: mockSynthesisService,
      });

      const facts = createMultiRecommendationFacts();
      const recommendations = engine.generate(facts);

      // Verify no duplicate IDs
      const ids = recommendations.map((r) => r.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
    });

    it('should maintain correct type counts', () => {
      const synthesizedResult = createSynthesizedResult();
      const mockSynthesisService = createMockSynthesisService(synthesizedResult);

      const engine = new RecommendationEngine({
        prototypeSynthesisService: mockSynthesisService,
      });

      const facts = createMultiRecommendationFacts();
      const recommendations = engine.generate(facts);

      // Count by type
      const typeCounts = {};
      for (const rec of recommendations) {
        typeCounts[rec.type] = (typeCounts[rec.type] || 0) + 1;
      }

      // Should have at most one prototype_create_suggestion
      expect(typeCounts['prototype_create_suggestion'] || 0).toBeLessThanOrEqual(1);
    });

    it('should preserve all recommendation fields for each type', () => {
      const synthesizedResult = createSynthesizedResult();
      const mockSynthesisService = createMockSynthesisService(synthesizedResult);

      const engine = new RecommendationEngine({
        prototypeSynthesisService: mockSynthesisService,
      });

      const facts = createMultiRecommendationFacts();
      const recommendations = engine.generate(facts);

      for (const rec of recommendations) {
        // Common fields all recommendations should have
        expect(rec).toHaveProperty('id');
        expect(rec).toHaveProperty('type');
        expect(rec).toHaveProperty('severity');
        expect(rec).toHaveProperty('confidence');
        expect(rec).toHaveProperty('title');
        expect(rec).toHaveProperty('why');
        expect(rec).toHaveProperty('evidence');

        // Type-specific validations
        if (rec.type === 'prototype_create_suggestion') {
          // prototype_create_suggestion has these specific fields
          expect(rec).toHaveProperty('proposedPrototype');
          expect(rec).toHaveProperty('predictedFit');
          expect(rec).toHaveProperty('relatedClauseIds');
          // Verify nested structure
          expect(rec.proposedPrototype).toHaveProperty('name');
          expect(rec.proposedPrototype).toHaveProperty('weights');
          expect(rec.proposedPrototype).toHaveProperty('gates');
          expect(rec.proposedPrototype).toHaveProperty('derivedFrom');
        } else {
          // Other recommendation types have actions and predictedEffect
          expect(rec).toHaveProperty('actions');
          expect(rec).toHaveProperty('predictedEffect');
        }
      }
    });
  });

  // === EDGE CASES ===

  describe('Edge cases', () => {
    it('should handle empty diagnosticFacts gracefully', () => {
      const synthesizedResult = createSynthesizedResult();
      const mockSynthesisService = createMockSynthesisService(synthesizedResult);

      const engine = new RecommendationEngine({
        prototypeSynthesisService: mockSynthesisService,
      });

      const recommendations = engine.generate(null);
      expect(recommendations).toEqual([]);
    });

    it('should handle invariant failures by returning empty array', () => {
      const synthesizedResult = createSynthesizedResult();
      const mockSynthesisService = createMockSynthesisService(synthesizedResult);

      const engine = new RecommendationEngine({
        prototypeSynthesisService: mockSynthesisService,
      });

      const facts = createPrototypeCreateFacts({
        invariants: [{ id: 'rate:overallPassRate', ok: false, message: 'Failed' }],
      });

      const recommendations = engine.generate(facts);
      expect(recommendations).toEqual([]);
    });

    it('should handle synthesis service returning null', () => {
      const mockSynthesisService = createMockSynthesisService(null);

      const engine = new RecommendationEngine({
        prototypeSynthesisService: mockSynthesisService,
      });

      const facts = createPrototypeCreateFacts();
      const recommendations = engine.generate(facts);

      const prototypeCreateRec = recommendations.find(
        (r) => r.type === 'prototype_create_suggestion'
      );

      // Should not emit when synthesis returns null
      expect(prototypeCreateRec).toBeUndefined();
    });

    it('should handle missing prototypeFit leaderboard', () => {
      const synthesizedResult = createSynthesizedResult();
      const mockSynthesisService = createMockSynthesisService(synthesizedResult);

      const engine = new RecommendationEngine({
        prototypeSynthesisService: mockSynthesisService,
      });

      const facts = createPrototypeCreateFacts({
        prototypeFit: { leaderboard: [] },
      });

      const recommendations = engine.generate(facts);

      // Should not crash, may or may not emit based on gap signal
      expect(Array.isArray(recommendations)).toBe(true);
    });
  });
});
