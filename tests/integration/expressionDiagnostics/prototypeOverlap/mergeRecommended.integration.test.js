/**
 * @file Integration tests for MERGE_RECOMMENDED classification
 * @see specs/prototype-overlap-analyzer.md
 * @see tickets/PROREDANAV2-018-merge-integration-test.md
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { JSDOM } from 'jsdom';
import { CommonBootstrapper } from '../../../../src/bootstrapper/CommonBootstrapper.js';
import { tokens } from '../../../../src/dependencyInjection/tokens.js';
import { diagnosticsTokens } from '../../../../src/dependencyInjection/tokens/tokens-diagnostics.js';
import { registerExpressionServices } from '../../../../src/dependencyInjection/registrations/expressionsRegistrations.js';
import { registerExpressionDiagnosticsServices } from '../../../../src/dependencyInjection/registrations/expressionDiagnosticsRegistrations.js';
import SharedContextPoolGenerator from '../../../../src/expressionDiagnostics/services/prototypeOverlap/SharedContextPoolGenerator.js';
import { PROTOTYPE_OVERLAP_CONFIG } from '../../../../src/expressionDiagnostics/config/prototypeOverlapConfig.js';

const TEST_SHARED_POOL_SIZE = 5000;
const TEST_POOL_SEED = 1337;

/**
 * Near-identical prototypes designed to trigger MERGE_RECOMMENDED classification.
 *
 * Merge criteria from OverlapClassifier:
 * - onEitherRate >= minOnEitherRateForMerge (0.05) - not dead prototypes
 * - gateOverlapRatio >= minGateOverlapRatio (0.9) - high gate overlap
 * - pearsonCorrelation >= minCorrelationForMerge (0.98) - very correlated
 * - meanAbsDiff <= maxMeanAbsDiffForMerge (0.03) - similar intensities
 * - dominanceP < minDominanceForSubsumption (0.95) AND dominanceQ < 0.95 - neither dominates
 */
const MERGE_PROTOTYPES = {
  numbness_like: {
    weights: { valence: -0.3, arousal: -0.8, engagement: -0.7 },
    // Gates with minimal overlap to ensure both fire together frequently
    gates: ['arousal <= 0.20', 'engagement <= 0.30'],
  },
  apathy_like: {
    weights: { valence: -0.32, arousal: -0.78, engagement: -0.69 },
    // Near-identical gates to numbness_like
    gates: ['arousal <= 0.22', 'engagement <= 0.32'],
  },
};

/**
 * Distinctly different prototypes that should NOT trigger MERGE_RECOMMENDED.
 * These have opposite valence signs which will fail signAgreement in Stage A filtering.
 */
const NON_MERGE_PROTOTYPES = {
  positive_emotion: {
    weights: { valence: 0.8, arousal: 0.3, engagement: 0.5 },
    gates: ['valence >= 0.40'],
  },
  negative_emotion: {
    weights: { valence: -0.8, arousal: 0.3, engagement: 0.5 },
    gates: ['valence <= -0.40'],
  },
};

describe('PrototypeOverlapAnalyzer - MERGE_RECOMMENDED Integration', () => {
  let dom;
  let container;
  let analyzer;
  let baseResult;
  let baseResultRepeat;

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

        const sharedPoolGenerator = new SharedContextPoolGenerator({
          randomStateGenerator: c.resolve(diagnosticsTokens.IRandomStateGenerator),
          contextBuilder: c.resolve(diagnosticsTokens.IMonteCarloContextBuilder),
          logger: c.resolve(tokens.ILogger),
          poolSize: TEST_SHARED_POOL_SIZE,
          stratified: PROTOTYPE_OVERLAP_CONFIG.enableStratifiedSampling,
          stratumCount: PROTOTYPE_OVERLAP_CONFIG.stratumCount,
          stratificationStrategy: PROTOTYPE_OVERLAP_CONFIG.stratificationStrategy,
          randomSeed: TEST_POOL_SEED,
        });
        c.setOverride(
          diagnosticsTokens.ISharedContextPoolGenerator,
          sharedPoolGenerator
        );

        // Register merge-worthy prototypes for testing
        const dataRegistry = c.resolve(tokens.IDataRegistry);
        dataRegistry.store('lookups', 'core:emotion_prototypes', {
          entries: MERGE_PROTOTYPES,
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
    if (container?.cleanup) {
      container.cleanup();
    }
    dom.window.close();
    delete global.window;
    delete global.document;
    delete global.navigator;
  });

  describe('numbness ↔ apathy style pair (merge-worthy)', () => {
    it('should classify near-identical prototypes as merge_recommended', async () => {
      // Find merge recommendations
      const mergeRecs = baseResult.recommendations.filter(
        (r) => r.type === 'prototype_merge_suggestion'
      );

      // With near-identical prototypes, we expect at least one merge recommendation
      expect(mergeRecs.length).toBeGreaterThanOrEqual(1);

      // Verify the recommendation involves our test prototypes
      const rec = mergeRecs[0];
      expect(rec.prototypes.a).toBeDefined();
      expect(rec.prototypes.b).toBeDefined();

      // Both prototype IDs should be from our test set
      const testProtoIds = Object.keys(MERGE_PROTOTYPES);
      expect(testProtoIds).toContain(rec.prototypes.a);
      expect(testProtoIds).toContain(rec.prototypes.b);
    });

    it('should include complete v2 evidence fields', async () => {
      const mergeRecs = baseResult.recommendations.filter(
        (r) => r.type === 'prototype_merge_suggestion'
      );

      // Skip if no merge recommendations (prototypes may not meet all criteria)
      if (mergeRecs.length === 0) {
        return;
      }

      const rec = mergeRecs[0];
      const evidence = rec.evidence;

      // Verify pearsonCorrelation is a valid number (not NaN)
      expect(typeof evidence.pearsonCorrelation).toBe('number');
      expect(Number.isNaN(evidence.pearsonCorrelation)).toBe(false);

      // Verify gateOverlap structure
      expect(evidence.gateOverlap).toBeDefined();
      expect(typeof evidence.gateOverlap.onEitherRate).toBe('number');
      expect(evidence.gateOverlap.onEitherRate).toBeGreaterThanOrEqual(0.05);
      expect(typeof evidence.gateOverlap.onBothRate).toBe('number');
      expect(typeof evidence.gateOverlap.jaccard).toBe('number');

      // Verify passRates structure
      expect(evidence.passRates).toBeDefined();
      expect(typeof evidence.passRates.pA_given_B).toBe('number');
      expect(typeof evidence.passRates.pB_given_A).toBe('number');
      expect(typeof evidence.passRates.coPassCount).toBe('number');
      expect(evidence.passRates.coPassCount).toBeGreaterThanOrEqual(200);

      // Verify intensitySimilarity structure
      expect(evidence.intensitySimilarity).toBeDefined();
      expect(typeof evidence.intensitySimilarity.rmse).toBe('number');
      expect(typeof evidence.intensitySimilarity.pctWithinEps).toBe('number');
      if (baseResult.metadata.analysisMode === 'v3') {
        expect(Number.isNaN(evidence.intensitySimilarity.pctWithinEps)).toBe(
          true
        );
      } else {
        expect(evidence.intensitySimilarity.pctWithinEps).toBeGreaterThanOrEqual(
          0.85
        );
      }

      // Verify highCoactivation structure
      expect(evidence.highCoactivation).toBeDefined();
      expect(Array.isArray(evidence.highCoactivation.thresholds)).toBe(true);
      if (evidence.highCoactivation.thresholds.length > 0) {
        const firstThreshold = evidence.highCoactivation.thresholds[0];
        // eslint-disable-next-line jest/no-conditional-expect
        expect(typeof firstThreshold.threshold).toBe('number');
        // eslint-disable-next-line jest/no-conditional-expect
        expect(typeof firstThreshold.coactivationRate).toBe('number');
      }
    });

    it('should have empty suggestedGateBands for merge', async () => {
      const mergeRecs = baseResult.recommendations.filter(
        (r) => r.type === 'prototype_merge_suggestion'
      );

      if (mergeRecs.length === 0) {
        return;
      }

      const rec = mergeRecs[0];
      expect(Array.isArray(rec.suggestedGateBands)).toBe(true);
      expect(rec.suggestedGateBands.length).toBe(0);
    });

    it('should produce deterministic results', async () => {
      const mergeRecs1 = baseResult.recommendations.filter(
        (r) => r.type === 'prototype_merge_suggestion'
      );
      const mergeRecs2 = baseResultRepeat.recommendations.filter(
        (r) => r.type === 'prototype_merge_suggestion'
      );

      expect(mergeRecs1.length).toBe(mergeRecs2.length);

      if (mergeRecs1.length > 0 && mergeRecs2.length > 0) {
        // eslint-disable-next-line jest/no-conditional-expect
        expect(mergeRecs1[0].prototypes.a).toBe(mergeRecs2[0].prototypes.a);
        // eslint-disable-next-line jest/no-conditional-expect
        expect(mergeRecs1[0].prototypes.b).toBe(mergeRecs2[0].prototypes.b);
      }
    });

    it('should have valid severity and confidence values', async () => {
      const mergeRecs = baseResult.recommendations.filter(
        (r) => r.type === 'prototype_merge_suggestion'
      );

      if (mergeRecs.length === 0) {
        return;
      }

      const rec = mergeRecs[0];

      // Severity should be in [0, 1] and should be high for merge candidates
      // After the fix for merge_recommended severity formula, this should be > 0.5
      expect(rec.severity).toBeGreaterThanOrEqual(0);
      expect(rec.severity).toBeLessThanOrEqual(1);
      expect(rec.severity).toBeGreaterThan(0.5);

      // Confidence should be in [0, 1]
      expect(rec.confidence).toBeGreaterThanOrEqual(0);
      expect(rec.confidence).toBeLessThanOrEqual(1);
    });

    it('should include appropriate actions for merge', async () => {
      const mergeRecs = baseResult.recommendations.filter(
        (r) => r.type === 'prototype_merge_suggestion'
      );

      if (mergeRecs.length === 0) {
        return;
      }

      const rec = mergeRecs[0];

      expect(Array.isArray(rec.actions)).toBe(true);
      expect(rec.actions.length).toBeGreaterThan(0);

      // Actions should mention merging or aliasing (both are valid merge actions)
      const hasMergeAction = rec.actions.some(
        (action) =>
          action.toLowerCase().includes('merg') ||
          action.toLowerCase().includes('alias') ||
          action.toLowerCase().includes('combine') ||
          action.toLowerCase().includes('consolidate')
      );
      expect(hasMergeAction).toBe(true);
    });
  });

  describe('Threshold boundary behavior', () => {
    it('should NOT classify as merge when prototypes have opposite signs', async () => {
      const dataRegistry = container.resolve(tokens.IDataRegistry);
      dataRegistry.store('lookups', 'core:emotion_prototypes', {
        entries: NON_MERGE_PROTOTYPES,
      });

      try {
        const result = await analyzer.analyze({
          prototypeFamily: 'emotion',
          sampleCount: 4000,
        });

        const mergeRecs = result.recommendations.filter(
          (r) => r.type === 'prototype_merge_suggestion'
        );

        // Prototypes with opposite valence signs should NOT trigger merge
        expect(mergeRecs.length).toBe(0);
      } finally {
        // Restore merge-worthy prototypes
        dataRegistry.store('lookups', 'core:emotion_prototypes', {
          entries: MERGE_PROTOTYPES,
        });
      }
    });
  });
});
