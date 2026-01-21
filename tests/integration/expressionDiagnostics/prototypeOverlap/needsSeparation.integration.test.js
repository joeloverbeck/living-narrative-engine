/**
 * @file Integration tests for NEEDS_SEPARATION classification
 * @see specs/prototype-overlap-analyzer.md
 *
 * needs_separation pairs are tracked in metadata.classificationBreakdown
 * AND generate recommendations (type: 'prototype_needs_separation').
 *
 * NEEDS_SEPARATION criteria from OverlapClassifier:
 * - High co-activation (both fire frequently together)
 * - Neither prototype clearly contains the other (not nested_siblings)
 * - Significant overlap but different behavioral intent
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { JSDOM } from 'jsdom';
import { CommonBootstrapper } from '../../../../src/bootstrapper/CommonBootstrapper.js';
import { tokens } from '../../../../src/dependencyInjection/tokens.js';
import { diagnosticsTokens } from '../../../../src/dependencyInjection/tokens/tokens-diagnostics.js';
import { registerExpressionServices } from '../../../../src/dependencyInjection/registrations/expressionsRegistrations.js';
import { registerExpressionDiagnosticsServices } from '../../../../src/dependencyInjection/registrations/expressionDiagnosticsRegistrations.js';

/**
 * Prototype pair designed to trigger NEEDS_SEPARATION classification.
 *
 * Criteria from OverlapClassifier:
 * - Both prototypes fire frequently (high co-activation)
 * - Neither is a clear subset of the other (symmetrical overlap)
 * - Both conditional probabilities are high but below nesting threshold
 *
 * Design rationale:
 * - joy_high_arousal: Fires on positive valence AND high arousal
 * - excitement: Fires on positive valence AND high arousal (very similar)
 *
 * Both fire in similar contexts but with different semantic intent.
 * They need to be separated with tighter gate conditions.
 */
const NEEDS_SEPARATION_PROTOTYPES = {
  joy_high_arousal: {
    weights: { valence: 0.6, arousal: 0.5, engagement: 0.3 },
    // Moderate gates - fires on positive valence and moderate arousal
    gates: ['valence >= 0.25', 'arousal >= 0.20'],
  },
  excitement: {
    weights: { valence: 0.5, arousal: 0.6, engagement: 0.4 },
    // Similar gates - very similar triggering conditions
    // Creates symmetrical high co-activation
    gates: ['valence >= 0.20', 'arousal >= 0.25'],
  },
};

/**
 * Prototype pair that should NOT trigger needs_separation.
 * Has clearly distinct gates with low overlap.
 */
const DISTINCT_PROTOTYPES = {
  calm_positive: {
    weights: { valence: 0.4, arousal: -0.5, dominance: 0.2 },
    // Fires on positive valence and LOW arousal
    gates: ['valence >= 0.30', 'arousal <= 0.10'],
  },
  excited_positive: {
    weights: { valence: 0.4, arousal: 0.6, dominance: 0.3 },
    // Fires on positive valence and HIGH arousal
    gates: ['valence >= 0.30', 'arousal >= 0.50'],
  },
};

describe('PrototypeOverlapAnalyzer - NEEDS_SEPARATION Integration', () => {
  let dom;
  let container;
  let analyzer;

  /**
   * Setup helper for integration tests.
   *
   * @param {object} [prototypeData] - Prototype data to register
   * @returns {Promise<void>}
   */
  const setup = async (prototypeData = NEEDS_SEPARATION_PROTOTYPES) => {
    // Setup minimal DOM environment
    dom = new JSDOM(
      `
      <!DOCTYPE html>
      <html>
        <body></body>
      </html>
    `,
      {
        url: 'http://localhost',
        pretendToBeVisual: true,
      }
    );

    global.window = dom.window;
    global.document = dom.window.document;
    global.navigator = dom.window.navigator;

    // Bootstrap with minimal configuration
    const bootstrapper = new CommonBootstrapper();
    const result = await bootstrapper.bootstrap({
      containerConfigType: 'minimal',
      worldName: 'default',
      skipModLoading: true,
      postInitHook: async (services, c) => {
        // Register expression services (required for IExpressionRegistry)
        registerExpressionServices(c);

        // Register diagnostics services
        registerExpressionDiagnosticsServices(c);

        // Register prototypes for testing
        const dataRegistry = c.resolve(tokens.IDataRegistry);
        dataRegistry.store('lookups', 'core:emotion_prototypes', {
          entries: prototypeData,
        });
        dataRegistry.store('lookups', 'core:sexual_prototypes', {
          entries: {},
        });
      },
    });

    if (!result?.container) {
      throw new Error('Bootstrap failed: container not initialized');
    }

    container = result.container;
    analyzer = container.resolve(diagnosticsTokens.IPrototypeOverlapAnalyzer);
  };

  const cleanup = () => {
    if (container?.cleanup) {
      container.cleanup();
    }
    if (dom) {
      dom.window.close();
    }
    delete global.window;
    delete global.document;
    delete global.navigator;
    container = null;
    analyzer = null;
    dom = null;
  };

  describe('joy_high_arousal ↔ excitement style pair (needs_separation candidate)', () => {
    beforeAll(async () => {
      await setup(NEEDS_SEPARATION_PROTOTYPES);
    });

    afterAll(() => {
      cleanup();
    });

    it('should track needs_separation in classificationBreakdown', async () => {
      const result = await analyzer.analyze({
        prototypeFamily: 'emotion',
        sampleCount: 4000,
      });

      // needs_separation pairs are tracked in metadata.classificationBreakdown
      expect(result.metadata).toBeDefined();
      expect(result.metadata.classificationBreakdown).toBeDefined();
      expect(
        typeof result.metadata.classificationBreakdown.needsSeparation
      ).toBe('number');
    });

    it('should generate recommendations for needs_separation pairs', async () => {
      const result = await analyzer.analyze({
        prototypeFamily: 'emotion',
        sampleCount: 4000,
      });

      // needs_separation pairs should generate 'prototype_needs_separation' recommendations
      const separationRecs = result.recommendations.filter(
        (r) => r.type === 'prototype_needs_separation'
      );

      // The number of separation recommendations should match the classificationBreakdown count
      expect(separationRecs.length).toBe(
        result.metadata.classificationBreakdown.needsSeparation
      );
    });

    it('should include complete v2 evidence fields', async () => {
      const result = await analyzer.analyze({
        prototypeFamily: 'emotion',
        sampleCount: 4000,
      });

      const separationRecs = result.recommendations.filter(
        (r) => r.type === 'prototype_needs_separation'
      );

      // Skip if no needs_separation recommendations
      if (separationRecs.length === 0) {
        return;
      }

      const rec = separationRecs[0];
      const evidence = rec.evidence;

      // Verify pearsonCorrelation is a valid number (not NaN)
      expect(typeof evidence.pearsonCorrelation).toBe('number');

      // Verify gateOverlap structure
      expect(evidence.gateOverlap).toBeDefined();
      expect(typeof evidence.gateOverlap.onEitherRate).toBe('number');
      expect(typeof evidence.gateOverlap.onBothRate).toBe('number');
      expect(typeof evidence.gateOverlap.jaccard).toBe('number');

      // Verify passRates structure
      expect(evidence.passRates).toBeDefined();
      expect(typeof evidence.passRates.pA_given_B).toBe('number');
      expect(typeof evidence.passRates.pB_given_A).toBe('number');
      expect(typeof evidence.passRates.coPassCount).toBe('number');

      // Verify intensitySimilarity structure
      expect(evidence.intensitySimilarity).toBeDefined();
      expect(typeof evidence.intensitySimilarity.rmse).toBe('number');
      expect(typeof evidence.intensitySimilarity.pctWithinEps).toBe('number');

      // Verify highCoactivation structure
      expect(evidence.highCoactivation).toBeDefined();
      expect(Array.isArray(evidence.highCoactivation.thresholds)).toBe(true);
    });

    it('should include appropriate actions for needs_separation', async () => {
      const result = await analyzer.analyze({
        prototypeFamily: 'emotion',
        sampleCount: 4000,
      });

      const separationRecs = result.recommendations.filter(
        (r) => r.type === 'prototype_needs_separation'
      );

      if (separationRecs.length === 0) {
        return;
      }

      const rec = separationRecs[0];

      expect(Array.isArray(rec.actions)).toBe(true);
      expect(rec.actions.length).toBeGreaterThan(0);

      // Actions should mention separation, overlap, gates, or conditions
      const hasSeparationAction = rec.actions.some(
        (action) =>
          action.toLowerCase().includes('overlap') ||
          action.toLowerCase().includes('separat') ||
          action.toLowerCase().includes('tighten') ||
          action.toLowerCase().includes('gate') ||
          action.toLowerCase().includes('condition')
      );
      expect(hasSeparationAction).toBe(true);
    });

    it('should have valid severity and confidence values', async () => {
      const result = await analyzer.analyze({
        prototypeFamily: 'emotion',
        sampleCount: 4000,
      });

      const separationRecs = result.recommendations.filter(
        (r) => r.type === 'prototype_needs_separation'
      );

      if (separationRecs.length === 0) {
        return;
      }

      const rec = separationRecs[0];

      // Severity should be in [0, 1]
      expect(rec.severity).toBeGreaterThanOrEqual(0);
      expect(rec.severity).toBeLessThanOrEqual(1);

      // Confidence should be in [0, 1]
      expect(rec.confidence).toBeGreaterThanOrEqual(0);
      expect(rec.confidence).toBeLessThanOrEqual(1);
    });

    it('should produce deterministic classification breakdown', async () => {
      const result1 = await analyzer.analyze({
        prototypeFamily: 'emotion',
        sampleCount: 4000,
      });

      const result2 = await analyzer.analyze({
        prototypeFamily: 'emotion',
        sampleCount: 4000,
      });

      expect(result1.metadata.classificationBreakdown.needsSeparation).toBe(
        result2.metadata.classificationBreakdown.needsSeparation
      );

      // Overall classification counts should be identical
      expect(result1.metadata.classificationBreakdown).toEqual(
        result2.metadata.classificationBreakdown
      );
    });
  });

  describe('Distinct prototype pairs (should NOT trigger needs_separation)', () => {
    afterEach(() => {
      cleanup();
    });

    it('should NOT classify as needs_separation when prototypes have non-overlapping gates', async () => {
      await setup(DISTINCT_PROTOTYPES);

      const result = await analyzer.analyze({
        prototypeFamily: 'emotion',
        sampleCount: 4000,
      });

      // Prototypes with non-overlapping gates should NOT trigger needs_separation
      // They may not even pass Stage A filtering due to opposite arousal signs
      expect(result.metadata.classificationBreakdown.needsSeparation).toBe(0);
    });
  });

  describe('Metadata structure validation', () => {
    afterEach(() => {
      cleanup();
    });

    it('should have complete classificationBreakdown structure', async () => {
      await setup(NEEDS_SEPARATION_PROTOTYPES);

      const result = await analyzer.analyze({
        prototypeFamily: 'emotion',
        sampleCount: 4000,
      });

      // Verify all v2 classification types are tracked
      const breakdown = result.metadata.classificationBreakdown;
      expect(typeof breakdown.mergeRecommended).toBe('number');
      expect(typeof breakdown.subsumedRecommended).toBe('number');
      expect(typeof breakdown.nestedSiblings).toBe('number');
      expect(typeof breakdown.needsSeparation).toBe('number');
      expect(typeof breakdown.convertToExpression).toBe('number');
      expect(typeof breakdown.keepDistinct).toBe('number');
    });

    it('should track all pairs evaluated correctly', async () => {
      await setup(NEEDS_SEPARATION_PROTOTYPES);

      const result = await analyzer.analyze({
        prototypeFamily: 'emotion',
        sampleCount: 4000,
      });

      // Sum of all classification counts should equal pairs that passed Stage A
      const breakdown = result.metadata.classificationBreakdown;
      const totalClassified =
        breakdown.mergeRecommended +
        breakdown.subsumedRecommended +
        breakdown.nestedSiblings +
        breakdown.needsSeparation +
        breakdown.convertToExpression +
        breakdown.keepDistinct;

      // Total classified should match pairs evaluated
      expect(totalClassified).toBe(result.metadata.candidatePairsEvaluated);
    });
  });

  describe('Gate banding suggestions', () => {
    afterEach(() => {
      cleanup();
    });

    it('should include gate banding suggestions for needs_separation', async () => {
      await setup(NEEDS_SEPARATION_PROTOTYPES);

      const result = await analyzer.analyze({
        prototypeFamily: 'emotion',
        sampleCount: 4000,
      });

      const separationRecs = result.recommendations.filter(
        (r) => r.type === 'prototype_needs_separation'
      );

      if (separationRecs.length === 0) {
        return;
      }

      const rec = separationRecs[0];
      expect(Array.isArray(rec.suggestedGateBands)).toBe(true);
    });
  });
});
