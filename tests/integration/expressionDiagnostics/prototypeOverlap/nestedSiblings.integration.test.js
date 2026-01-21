/**
 * @file Integration tests for NESTED_SIBLINGS classification
 * @see specs/prototype-overlap-analyzer.md
 * @see tickets/PROREDANAV2-019-nested-siblings-integration-test.md
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { JSDOM } from 'jsdom';
import { CommonBootstrapper } from '../../../../src/bootstrapper/CommonBootstrapper.js';
import { tokens } from '../../../../src/dependencyInjection/tokens.js';
import { diagnosticsTokens } from '../../../../src/dependencyInjection/tokens/tokens-diagnostics.js';
import { registerExpressionServices } from '../../../../src/dependencyInjection/registrations/expressionsRegistrations.js';
import { registerExpressionDiagnosticsServices } from '../../../../src/dependencyInjection/registrations/expressionDiagnosticsRegistrations.js';

/**
 * Prototype pair designed to trigger NESTED_SIBLINGS classification.
 *
 * Nested siblings criteria from OverlapClassifier:
 * - One conditional probability >= nestedConditionalThreshold (0.97)
 * - The other conditional probability < nestedConditionalThreshold
 *
 * Design rationale:
 * - interest_like (broader): permissive gates that fire often
 * - curiosity_like (narrower): stricter gates that are a subset of interest's gates
 *
 * When curiosity_like passes its gates, interest_like almost always passes too
 * (pB_given_A >= 0.97 where A = curiosity, B = interest).
 * But when interest_like passes, curiosity_like doesn't always pass
 * (pA_given_B < 0.97).
 */
const NESTED_SIBLINGS_PROTOTYPES = {
  interest_like: {
    weights: { valence: 0.2, arousal: 0.3, engagement: 0.4 },
    // Permissive gates - fire on low arousal and engagement
    gates: ['arousal >= 0.10', 'engagement >= 0.15'],
  },
  curiosity_like: {
    weights: { valence: 0.25, arousal: 0.35, engagement: 0.45 },
    // Stricter gates - subset of interest_like's gates
    // When arousal >= 0.35, interest's arousal >= 0.10 is also true
    // When engagement >= 0.40, interest's engagement >= 0.15 is also true
    gates: ['arousal >= 0.35', 'engagement >= 0.40'],
  },
};

/**
 * Prototype pair that should NOT be nested siblings (both have similar conditional rates).
 * These prototypes have non-overlapping gates - each fires independently.
 */
const NON_NESTED_PROTOTYPES = {
  high_valence: {
    weights: { valence: 0.8, arousal: 0.2, engagement: 0.3 },
    gates: ['valence >= 0.50'],
  },
  low_valence: {
    weights: { valence: -0.8, arousal: 0.2, engagement: 0.3 },
    gates: ['valence <= -0.50'],
  },
};

describe('PrototypeOverlapAnalyzer - NESTED_SIBLINGS Integration', () => {
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

        // Register nested sibling prototypes for testing
        const dataRegistry = c.resolve(tokens.IDataRegistry);
        dataRegistry.store('lookups', 'core:emotion_prototypes', {
          entries: NESTED_SIBLINGS_PROTOTYPES,
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

  describe('interest ↔ curiosity style pair (nested siblings)', () => {
    it('should classify prototypes with nesting behavior as prototype_nested_siblings', async () => {
      const result = await analyzer.analyze({
        prototypeFamily: 'emotion',
        sampleCount: 4000,
      });

      // Find nested sibling recommendations
      const nestedRecs = result.recommendations.filter(
        (r) => r.type === 'prototype_nested_siblings'
      );

      // With properly designed nested prototypes, we expect at least one nested sibling recommendation
      expect(nestedRecs.length).toBeGreaterThanOrEqual(1);

      // Verify the recommendation involves our test prototypes
      const rec = nestedRecs[0];
      expect(rec.prototypes.a).toBeDefined();
      expect(rec.prototypes.b).toBeDefined();

      // Both prototype IDs should be from our test set
      const testProtoIds = Object.keys(NESTED_SIBLINGS_PROTOTYPES);
      expect(testProtoIds).toContain(rec.prototypes.a);
      expect(testProtoIds).toContain(rec.prototypes.b);
    });

    it('should include complete v2 evidence fields', async () => {
      const result = await analyzer.analyze({
        prototypeFamily: 'emotion',
        sampleCount: 4000,
      });

      const nestedRecs = result.recommendations.filter(
        (r) => r.type === 'prototype_nested_siblings'
      );

      // Skip if no nested sibling recommendations (prototypes may not meet all criteria)
      if (nestedRecs.length === 0) {
        return;
      }

      const rec = nestedRecs[0];
      const evidence = rec.evidence;

      // Verify pearsonCorrelation is a valid number (not NaN)
      expect(typeof evidence.pearsonCorrelation).toBe('number');

      // Verify gateOverlap structure
      expect(evidence.gateOverlap).toBeDefined();
      expect(typeof evidence.gateOverlap.onEitherRate).toBe('number');
      expect(typeof evidence.gateOverlap.onBothRate).toBe('number');
      expect(typeof evidence.gateOverlap.jaccard).toBe('number');

      // Verify passRates structure - critical for nested siblings
      expect(evidence.passRates).toBeDefined();
      expect(typeof evidence.passRates.pA_given_B).toBe('number');
      expect(typeof evidence.passRates.pB_given_A).toBe('number');
      expect(typeof evidence.passRates.coPassCount).toBe('number');

      // For nested siblings, one conditional should be high (>= 0.97)
      const pA_given_B = evidence.passRates.pA_given_B;
      const pB_given_A = evidence.passRates.pB_given_A;
      const hasHighConditional = pA_given_B >= 0.97 || pB_given_A >= 0.97;
      expect(hasHighConditional).toBe(true);

      // Verify intensitySimilarity structure
      expect(evidence.intensitySimilarity).toBeDefined();
      expect(typeof evidence.intensitySimilarity.rmse).toBe('number');
      expect(typeof evidence.intensitySimilarity.pctWithinEps).toBe('number');

      // Verify highCoactivation structure
      expect(evidence.highCoactivation).toBeDefined();
      expect(Array.isArray(evidence.highCoactivation.thresholds)).toBe(true);
    });

    it('should include expression_suppression suggestion for nested siblings', async () => {
      const result = await analyzer.analyze({
        prototypeFamily: 'emotion',
        sampleCount: 4000,
      });

      const nestedRecs = result.recommendations.filter(
        (r) => r.type === 'prototype_nested_siblings'
      );

      if (nestedRecs.length === 0) {
        return;
      }

      const rec = nestedRecs[0];
      expect(Array.isArray(rec.suggestedGateBands)).toBe(true);

      // Nested siblings should have at least one expression_suppression suggestion
      const suppressionSuggestions = rec.suggestedGateBands.filter(
        (s) => s.type === 'expression_suppression'
      );
      expect(suppressionSuggestions.length).toBeGreaterThan(0);

      // Verify suppression suggestion structure
      const suppression = suppressionSuggestions[0];
      expect(suppression.message).toBeDefined();
      expect(suppression.suggestedAction).toBeDefined();
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

      const nestedRecs1 = result1.recommendations.filter(
        (r) => r.type === 'prototype_nested_siblings'
      );
      const nestedRecs2 = result2.recommendations.filter(
        (r) => r.type === 'prototype_nested_siblings'
      );

      expect(nestedRecs1.length).toBe(nestedRecs2.length);

      if (nestedRecs1.length > 0 && nestedRecs2.length > 0) {
        // eslint-disable-next-line jest/no-conditional-expect
        expect(nestedRecs1[0].prototypes.a).toBe(nestedRecs2[0].prototypes.a);
        // eslint-disable-next-line jest/no-conditional-expect
        expect(nestedRecs1[0].prototypes.b).toBe(nestedRecs2[0].prototypes.b);
      }
    });

    it('should have valid severity and confidence values', async () => {
      const result = await analyzer.analyze({
        prototypeFamily: 'emotion',
        sampleCount: 4000,
      });

      const nestedRecs = result.recommendations.filter(
        (r) => r.type === 'prototype_nested_siblings'
      );

      if (nestedRecs.length === 0) {
        return;
      }

      const rec = nestedRecs[0];

      // Severity should be in [0, 1]
      expect(rec.severity).toBeGreaterThanOrEqual(0);
      expect(rec.severity).toBeLessThanOrEqual(1);

      // Confidence should be in [0, 1]
      expect(rec.confidence).toBeGreaterThanOrEqual(0);
      expect(rec.confidence).toBeLessThanOrEqual(1);
    });

    it('should include appropriate actions for nested siblings', async () => {
      const result = await analyzer.analyze({
        prototypeFamily: 'emotion',
        sampleCount: 4000,
      });

      const nestedRecs = result.recommendations.filter(
        (r) => r.type === 'prototype_nested_siblings'
      );

      if (nestedRecs.length === 0) {
        return;
      }

      const rec = nestedRecs[0];

      expect(Array.isArray(rec.actions)).toBe(true);
      expect(rec.actions.length).toBeGreaterThan(0);

      // Actions should mention hierarchy, nesting, specialization, or inheritance
      const hasNestingAction = rec.actions.some(
        (action) =>
          action.toLowerCase().includes('special') ||
          action.toLowerCase().includes('inherit') ||
          action.toLowerCase().includes('nest') ||
          action.toLowerCase().includes('hier') ||
          action.toLowerCase().includes('reference')
      );
      expect(hasNestingAction).toBe(true);
    });
  });

  describe('Threshold boundary behavior', () => {
    it('should NOT classify as nested_siblings when prototypes have non-overlapping gates', async () => {
      const dataRegistry = container.resolve(tokens.IDataRegistry);
      dataRegistry.store('lookups', 'core:emotion_prototypes', {
        entries: NON_NESTED_PROTOTYPES,
      });

      try {
        const result = await analyzer.analyze({
          prototypeFamily: 'emotion',
          sampleCount: 4000,
        });

        const nestedRecs = result.recommendations.filter(
          (r) => r.type === 'prototype_nested_siblings'
        );

        // Prototypes with non-overlapping gates should NOT trigger nested siblings
        // They may not even pass Stage A filtering due to opposite signs
        expect(nestedRecs.length).toBe(0);
      } finally {
        // Restore nested sibling prototypes
        dataRegistry.store('lookups', 'core:emotion_prototypes', {
          entries: NESTED_SIBLINGS_PROTOTYPES,
        });
      }
    });
  });

  describe('Gate implication evidence', () => {
    it('should include gate implication evidence when available', async () => {
      const result = await analyzer.analyze({
        prototypeFamily: 'emotion',
        sampleCount: 4000,
      });

      const nestedRecs = result.recommendations.filter(
        (r) => r.type === 'prototype_nested_siblings'
      );

      if (nestedRecs.length === 0) {
        return;
      }

      const rec = nestedRecs[0];
      const gateImplication = rec.evidence.gateImplication;

      // Gate implication may or may not be present depending on gate structure
      // If present, verify its structure
      if (gateImplication) {
        // Verify gate implication structure per OverlapRecommendationBuilder
        if (gateImplication.direction !== null) {
          // eslint-disable-next-line jest/no-conditional-expect
          expect(typeof gateImplication.direction).toBe('string');
        }
        if (gateImplication.confidence !== null) {
          // eslint-disable-next-line jest/no-conditional-expect
          expect(typeof gateImplication.confidence).toBe('number');
        }
      }
    });
  });
});
