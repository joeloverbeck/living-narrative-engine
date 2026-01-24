/**
 * @file Integration tests for CONVERT_TO_EXPRESSION classification
 * @see specs/prototype-overlap-analyzer.md
 * @see tickets/PROREDANAV2-021-convert-snapshot-test.md
 *
 * convert_to_expression pairs are tracked in metadata.classificationBreakdown
 * AND generate recommendations (type: 'prototype_expression_conversion').
 * When enableConvertToExpression is false, pairs fall through to nested_siblings.
 *
 * NOTE: Feature flag gating is tested at the unit level (overlapClassifier.convertToExpression.test.js)
 * because the config is imported directly by services, not resolved via DI.
 * Integration tests verify default behavior (enableConvertToExpression: true).
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { JSDOM } from 'jsdom';
import { CommonBootstrapper } from '../../../../src/bootstrapper/CommonBootstrapper.js';
import { tokens } from '../../../../src/dependencyInjection/tokens.js';
import { diagnosticsTokens } from '../../../../src/dependencyInjection/tokens/tokens-diagnostics.js';
import { registerExpressionServices } from '../../../../src/dependencyInjection/registrations/expressionsRegistrations.js';
import { registerExpressionDiagnosticsServices } from '../../../../src/dependencyInjection/registrations/expressionDiagnosticsRegistrations.js';

/**
 * Prototype pair designed to trigger CONVERT_TO_EXPRESSION classification.
 *
 * Criteria from OverlapClassifier:
 * - Nesting: One prototype's gates imply the other (A → B asymmetric relationship)
 * - Structural heuristic: Low-threat steady state (threat upper bound <= 0.20)
 *
 * Design rationale (contentment ↔ relief style):
 * - contentment_like: Permissive gates, no threat constraint
 * - relief_like: Same as contentment + stricter threat <= 0.15 constraint
 *
 * When relief_like passes, contentment_like almost always passes too.
 * The threat constraint in relief_like triggers the structural heuristic.
 */
const CONVERT_TO_EXPRESSION_PROTOTYPES = {
  contentment_like: {
    weights: { valence: 0.5, arousal: -0.2, dominance: 0.3, threat: -0.4 },
    // Permissive gates - fires on moderate positive valence
    gates: ['valence >= 0.20'],
  },
  relief_like: {
    weights: { valence: 0.4, arousal: -0.1, dominance: 0.2, threat: -0.5 },
    // Stricter gates - same valence requirement PLUS low threat
    // This creates A → B implication (relief → contentment)
    gates: ['valence >= 0.20', 'threat <= 0.15'],
  },
};

/**
 * Prototype pair that should NOT trigger convert_to_expression.
 * Has nesting behavior but no threat axis (doesn't match structural heuristic).
 */
const NESTED_SIBLINGS_ONLY_PROTOTYPES = {
  interest_broad: {
    weights: { valence: 0.2, arousal: 0.3, engagement: 0.4 },
    gates: ['arousal >= 0.10', 'engagement >= 0.15'],
  },
  curiosity_narrow: {
    weights: { valence: 0.25, arousal: 0.35, engagement: 0.45 },
    // Stricter gates - subset of interest's gates
    // No threat axis, so structural heuristic won't match
    gates: ['arousal >= 0.35', 'engagement >= 0.40'],
  },
};

describe('PrototypeOverlapAnalyzer - CONVERT_TO_EXPRESSION Integration', () => {
  let dom;
  let container;
  let analyzer;
  let baseResult;
  let baseResultRepeat;

  /**
   * Setup helper for integration tests.
   *
   * @param {object} [prototypeData] - Prototype data to register
   * @returns {Promise<void>}
   */
  const setup = async (prototypeData = CONVERT_TO_EXPRESSION_PROTOTYPES) => {
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
        c.setOverride(diagnosticsTokens.ISharedContextPoolGenerator, null);

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

  describe('contentment ↔ relief style pair (convert_to_expression candidate)', () => {
    beforeAll(async () => {
      await setup(CONVERT_TO_EXPRESSION_PROTOTYPES);
      baseResult = await analyzer.analyze({
        prototypeFamily: 'emotion',
        sampleCount: 4000,
      });
      baseResultRepeat = await analyzer.analyze({
        prototypeFamily: 'emotion',
        sampleCount: 4000,
      });
    });

    afterAll(() => {
      cleanup();
    });

    it('should track convert_to_expression in classificationBreakdown', async () => {
      // convert_to_expression pairs are tracked in metadata.classificationBreakdown
      expect(baseResult.metadata).toBeDefined();
      expect(baseResult.metadata.classificationBreakdown).toBeDefined();
      expect(
        typeof baseResult.metadata.classificationBreakdown.convertToExpression
      ).toBe('number');

      // With properly designed prototypes (nesting + threat <= 0.20),
      // we expect the convert_to_expression count to be >= 1
      expect(
        baseResult.metadata.classificationBreakdown.convertToExpression
      ).toBeGreaterThanOrEqual(1);
    });

    it('should generate recommendations for convert_to_expression pairs', async () => {
      // convert_to_expression pairs should generate 'prototype_expression_conversion' recommendations
      const expressionRecs = baseResult.recommendations.filter(
        (r) => r.type === 'prototype_expression_conversion'
      );

      // The number of expression recommendations should match the classificationBreakdown count
      expect(expressionRecs.length).toBe(
        baseResult.metadata.classificationBreakdown.convertToExpression
      );
    });

    it('should include multi-label evidence on convert_to_expression recommendations', async () => {
      const expressionRecs = baseResult.recommendations.filter(
        (r) => r.type === 'prototype_expression_conversion'
      );

      if (expressionRecs.length === 0) {
        return;
      }

      const rec = expressionRecs[0];
      expect(Array.isArray(rec.allMatchingClassifications)).toBe(true);
      expect(
        rec.allMatchingClassifications.some(
          (entry) => entry.type === 'convert_to_expression'
        )
      ).toBe(true);
    });

    it('should produce deterministic classification breakdown', async () => {
      expect(
        baseResult.metadata.classificationBreakdown.convertToExpression
      ).toBe(
        baseResultRepeat.metadata.classificationBreakdown.convertToExpression
      );

      // Overall classification counts should be identical
      expect(baseResult.metadata.classificationBreakdown).toEqual(
        baseResultRepeat.metadata.classificationBreakdown
      );
    });
  });

  describe('Structural heuristic validation', () => {
    afterEach(() => {
      cleanup();
    });

    it('should NOT classify as convert_to_expression without threat axis', async () => {
      await setup(NESTED_SIBLINGS_ONLY_PROTOTYPES);

      const result = await analyzer.analyze({
        prototypeFamily: 'emotion',
        sampleCount: 4000,
      });

      // These prototypes have nesting but no threat axis
      // So they should NOT trigger convert_to_expression
      expect(result.metadata.classificationBreakdown.convertToExpression).toBe(
        0
      );

      // They should instead be classified as nested_siblings
      // (if they pass Stage A filtering)
      if (result.metadata.candidatePairsEvaluated > 0) {
        // Either nested_siblings or keep_distinct, but NOT convert_to_expression
        // eslint-disable-next-line jest/no-conditional-expect
        expect(
          result.metadata.classificationBreakdown.convertToExpression
        ).toBe(0);
      }
    });
  });

  describe('Metadata structure validation', () => {
    afterEach(() => {
      cleanup();
    });

    it('should have complete classificationBreakdown structure', async () => {
      await setup(CONVERT_TO_EXPRESSION_PROTOTYPES);

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

    it('should have valid summaryInsight structure', async () => {
      await setup(CONVERT_TO_EXPRESSION_PROTOTYPES);

      const result = await analyzer.analyze({
        prototypeFamily: 'emotion',
        sampleCount: 4000,
      });

      // Verify summaryInsight is present and valid
      expect(result.metadata.summaryInsight).toBeDefined();
      expect(typeof result.metadata.summaryInsight.status).toBe('string');
      expect(typeof result.metadata.summaryInsight.message).toBe('string');
    });

    it('should track all pairs evaluated correctly', async () => {
      await setup(CONVERT_TO_EXPRESSION_PROTOTYPES);

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
});
