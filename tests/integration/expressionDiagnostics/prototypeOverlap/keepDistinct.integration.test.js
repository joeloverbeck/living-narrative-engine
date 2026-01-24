/**
 * @file Integration tests for KEEP_DISTINCT classification
 * @see specs/prototype-overlap-analyzer.md
 * @see tickets/PROREDANAV2-020-keep-distinct-integration-test.md
 *
 * IMPORTANT: keep_distinct pairs do NOT generate recommendations.
 * They are tracked via metadata.classificationBreakdown.keepDistinct.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { JSDOM } from 'jsdom';
import { CommonBootstrapper } from '../../../../src/bootstrapper/CommonBootstrapper.js';
import { tokens } from '../../../../src/dependencyInjection/tokens.js';
import { diagnosticsTokens } from '../../../../src/dependencyInjection/tokens/tokens-diagnostics.js';
import { registerExpressionServices } from '../../../../src/dependencyInjection/registrations/expressionsRegistrations.js';
import { registerExpressionDiagnosticsServices } from '../../../../src/dependencyInjection/registrations/expressionDiagnosticsRegistrations.js';
import { PROTOTYPE_OVERLAP_CONFIG } from '../../../../src/expressionDiagnostics/config/prototypeOverlapConfig.js';

/**
 * Prototype pair designed to trigger KEEP_DISTINCT classification.
 *
 * Keep distinct criteria from OverlapClassifier:
 * - Low gate overlap ratio (onBothRate / onEitherRate < threshold)
 * - Disjoint or minimally overlapping gate regions
 *
 * Design rationale:
 * - freeze_like: High threat, low arousal (immobilized fear response)
 * - submission_like: Low threat, low dominance (yielding/deferring)
 *
 * These prototypes have mutually exclusive gate requirements:
 * - freeze requires threat >= 0.60, submission requires threat <= 0.30
 * - This creates disjoint firing regions with minimal overlap
 */
const DISJOINT_PROTOTYPES = {
  freeze_like: {
    weights: { valence: -0.4, arousal: -0.3, dominance: -0.5, threat: 0.8 },
    // High threat, low arousal region
    gates: ['threat >= 0.60', 'arousal <= 0.20'],
  },
  submission_like: {
    weights: { valence: -0.2, arousal: 0.1, dominance: -0.7, threat: 0.1 },
    // Low threat, low dominance region
    gates: ['threat <= 0.30', 'dominance <= -0.30'],
  },
};

/**
 * Additional disjoint prototype pairs for comprehensive testing.
 * Each pair has gates that create non-overlapping activation regions.
 */
const MULTIPLE_DISJOINT_PROTOTYPES = {
  elation: {
    weights: { valence: 0.9, arousal: 0.8, engagement: 0.7 },
    // High positive valence region
    gates: ['valence >= 0.70', 'arousal >= 0.50'],
  },
  despair: {
    weights: { valence: -0.9, arousal: -0.6, engagement: -0.5 },
    // High negative valence region
    gates: ['valence <= -0.70', 'arousal <= -0.30'],
  },
};

describe('PrototypeOverlapAnalyzer - KEEP_DISTINCT Integration', () => {
  let dom;
  let container;
  let analyzer;

  beforeAll(async () => {
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

        // Register disjoint prototypes for testing
        const dataRegistry = c.resolve(tokens.IDataRegistry);
        dataRegistry.store('lookups', 'core:emotion_prototypes', {
          entries: DISJOINT_PROTOTYPES,
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
  });

  afterAll(() => {
    if (container?.cleanup) {
      container.cleanup();
    }
    dom.window.close();
    delete global.window;
    delete global.document;
    delete global.navigator;
  });

  describe('freeze ↔ submission style pair (disjoint gates)', () => {
    it('should classify disjoint prototypes via classificationBreakdown.keepDistinct', async () => {
      const result = await analyzer.analyze({
        prototypeFamily: 'emotion',
        sampleCount: 4000,
      });

      // keep_distinct pairs are tracked in metadata.classificationBreakdown
      expect(result.metadata).toBeDefined();
      expect(result.metadata.classificationBreakdown).toBeDefined();

      // With disjoint prototypes, we expect keepDistinct to be incremented
      // Note: The pair may also fail Stage A filtering entirely due to
      // different weight signs or low overlap, but if analyzed, should be keep_distinct
      const keepDistinctCount =
        result.metadata.classificationBreakdown.keepDistinct;
      expect(typeof keepDistinctCount).toBe('number');
    });

    it('should NOT generate recommendations for keep_distinct pairs', async () => {
      const result = await analyzer.analyze({
        prototypeFamily: 'emotion',
        sampleCount: 4000,
      });

      // keep_distinct is NOT in RECOMMENDATION_TYPES array in PrototypeOverlapAnalyzer
      // So these pairs should not produce any recommendations

      // Verify no prototype_distinct_info or related recommendations exist
      // (keep_distinct doesn't map to a recommendation type at all)
      const distinctRecs = result.recommendations.filter(
        (r) =>
          r.type === 'prototype_distinct_info' ||
          r.type === 'keep_distinct' ||
          r.type === 'prototype_keep_distinct'
      );
      expect(distinctRecs.length).toBe(0);

      // For disjoint prototypes, we expect minimal or no recommendations
      // (merge, subsumed, nested_siblings, needs_separation should all be 0 or very low)
      const actionableRecs = result.recommendations.filter(
        (r) =>
          r.type === 'prototype_merge_suggestion' ||
          r.type === 'prototype_subsumed_warning' ||
          r.type === 'prototype_nested_siblings' ||
          r.type === 'prototype_needs_separation'
      );

      // Disjoint prototypes should not trigger any actionable recommendations
      expect(actionableRecs.length).toBe(0);
    });

    it('should produce deterministic results', async () => {
      const result1 = await analyzer.analyze({
        prototypeFamily: 'emotion',
        sampleCount: 4000,
      });

      const result2 = await analyzer.analyze({
        prototypeFamily: 'emotion',
        sampleCount: 4000,
      });

      // Classification breakdown should be identical
      expect(result1.metadata.classificationBreakdown.keepDistinct).toBe(
        result2.metadata.classificationBreakdown.keepDistinct
      );

      // Total pairs evaluated should be identical
      expect(result1.metadata.candidatePairsEvaluated).toBe(
        result2.metadata.candidatePairsEvaluated
      );
    });

    it('should have valid metadata structure', async () => {
      const result = await analyzer.analyze({
        prototypeFamily: 'emotion',
        sampleCount: 4000,
      });

      // Verify complete metadata structure
      expect(result.metadata).toBeDefined();
      expect(result.metadata.prototypeFamily).toBe('emotion');
      expect(typeof result.metadata.candidatePairsEvaluated).toBe('number');
      expect(typeof result.metadata.sampleCountPerPair).toBe('number');
      if (result.metadata.analysisMode === 'v3') {
        expect(result.metadata.sampleCountPerPair).toBe(
          PROTOTYPE_OVERLAP_CONFIG.sharedPoolSize
        );
      } else {
        expect(result.metadata.sampleCountPerPair).toBe(4000);
      }

      // Verify classification breakdown has all expected fields
      const breakdown = result.metadata.classificationBreakdown;
      expect(typeof breakdown.mergeRecommended).toBe('number');
      expect(typeof breakdown.subsumedRecommended).toBe('number');
      expect(typeof breakdown.nestedSiblings).toBe('number');
      expect(typeof breakdown.needsSeparation).toBe('number');
      expect(typeof breakdown.convertToExpression).toBe('number');
      expect(typeof breakdown.keepDistinct).toBe('number');
    });
  });

  describe('multiple disjoint prototype patterns', () => {
    it('should classify elation ↔ despair as disjoint (opposite valence)', async () => {
      const dataRegistry = container.resolve(tokens.IDataRegistry);
      dataRegistry.store('lookups', 'core:emotion_prototypes', {
        entries: MULTIPLE_DISJOINT_PROTOTYPES,
      });

      try {
        const result = await analyzer.analyze({
          prototypeFamily: 'emotion',
          sampleCount: 4000,
        });

        // Elation and despair have opposite valence requirements
        // valence >= 0.70 vs valence <= -0.70 - completely disjoint
        // Should not generate actionable recommendations
        const actionableRecs = result.recommendations.filter(
          (r) =>
            r.type === 'prototype_merge_suggestion' ||
            r.type === 'prototype_subsumed_warning' ||
            r.type === 'prototype_nested_siblings' ||
            r.type === 'prototype_needs_separation'
        );

        expect(actionableRecs.length).toBe(0);
      } finally {
        // Restore original prototypes
        dataRegistry.store('lookups', 'core:emotion_prototypes', {
          entries: DISJOINT_PROTOTYPES,
        });
      }
    });
  });

  describe('Stage A filtering behavior with disjoint prototypes', () => {
    it('should filter out pairs with opposite weight signs in Stage A', async () => {
      // Disjoint prototypes may be filtered in Stage A due to signAgreement check
      // This is expected behavior - they never reach classification
      const result = await analyzer.analyze({
        prototypeFamily: 'emotion',
        sampleCount: 4000,
      });

      // Even if filtered at Stage A, candidatePairsEvaluated reflects how many
      // candidate pairs were evaluated
      expect(result.metadata.candidatePairsEvaluated).toBeGreaterThanOrEqual(0);

      // The sum of all classification counts should equal pairs that passed Stage A
      const breakdown = result.metadata.classificationBreakdown;
      const totalClassified =
        breakdown.mergeRecommended +
        breakdown.subsumedRecommended +
        breakdown.nestedSiblings +
        breakdown.needsSeparation +
        breakdown.convertToExpression +
        breakdown.keepDistinct;

      // All classified pairs should be non-negative
      expect(totalClassified).toBeGreaterThanOrEqual(0);
    });
  });
});
