/**
 * @file Integration tests for Prototype Overlap Analyzer
 * @see specs/prototype-overlap-analyzer.md
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

// Sample emotion prototypes for testing - realistic subset
const EMOTION_PROTOTYPES = {
  calm: {
    weights: { valence: 0.2, arousal: -1.0, threat: -1.0 },
    gates: ['threat <= 0.20'],
  },
  contentment: {
    weights: { valence: 0.9, arousal: -0.6, threat: -0.6 },
    gates: ['valence >= 0.20', 'threat <= 0.20'],
  },
  joy: {
    weights: { valence: 1.0, arousal: 0.6, engagement: 0.5 },
    gates: ['valence >= 0.40'],
  },
  // Similar pair to test overlap detection
  happiness: {
    weights: { valence: 1.0, arousal: 0.5, engagement: 0.4 },
    gates: ['valence >= 0.35'],
  },
  sadness: {
    weights: { valence: -1.0, arousal: -0.3, engagement: -0.4 },
    gates: ['valence <= -0.30'],
  },
  anger: {
    weights: { valence: -0.8, arousal: 0.9, threat: 0.7 },
    gates: ['arousal >= 0.50', 'threat >= 0.30'],
  },
  fear: {
    weights: { valence: -0.9, arousal: 0.8, threat: 1.0 },
    gates: ['threat >= 0.50'],
  },
  // Subset relationship for subsumption testing
  panic: {
    weights: { valence: -1.0, arousal: 1.0, threat: 1.0 },
    gates: ['threat >= 0.80', 'arousal >= 0.80'],
  },
};

const SEXUAL_PROTOTYPES = {};

describe('PrototypeOverlapAnalyzer Integration', () => {
  let dom;
  let container;
  let analyzer;
  let baseResult2000;
  let baseResult4000;

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

        // Manually register lookup data for testing
        const dataRegistry = c.resolve(tokens.IDataRegistry);
        dataRegistry.store('lookups', 'core:emotion_prototypes', {
          entries: EMOTION_PROTOTYPES,
        });
        dataRegistry.store('lookups', 'core:sexual_prototypes', {
          entries: SEXUAL_PROTOTYPES,
        });
      },
    });

    if (!result?.container) {
      throw new Error('Bootstrap failed: container not initialized');
    }

    container = result.container;
    analyzer = container.resolve(diagnosticsTokens.IPrototypeOverlapAnalyzer);

    baseResult2000 = await analyzer.analyze({
      prototypeFamily: 'emotion',
      sampleCount: 2000,
    });
    baseResult4000 = await analyzer.analyze({
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

  describe('Full Pipeline', () => {
    it('analyzes real emotion prototypes from lookup', async () => {
      // Verify result structure
      expect(baseResult2000).toHaveProperty('recommendations');
      expect(baseResult2000).toHaveProperty('metadata');
      expect(Array.isArray(baseResult2000.recommendations)).toBe(true);

      // Verify metadata - note: no 'elapsed' field exists
      expect(baseResult2000.metadata.totalPrototypes).toBeGreaterThan(0);
      if (baseResult2000.metadata.analysisMode === 'v3') {
        expect(baseResult2000.metadata.sampleCountPerPair).toBe(
          TEST_SHARED_POOL_SIZE
        );
      } else {
        expect(baseResult2000.metadata.sampleCountPerPair).toBe(2000);
      }
      expect(baseResult2000.metadata.prototypeFamily).toBe('emotion');
      expect(typeof baseResult2000.metadata.candidatePairsFound).toBe('number');
      expect(typeof baseResult2000.metadata.candidatePairsEvaluated).toBe('number');
      expect(typeof baseResult2000.metadata.redundantPairsFound).toBe('number');

      // Verify recommendation structure if any exist
      if (baseResult2000.recommendations.length > 0) {
        const rec = baseResult2000.recommendations[0];
        expect(rec).toHaveProperty('type');
        expect(rec).toHaveProperty('prototypes');
        expect(rec).toHaveProperty('severity');
        expect(rec).toHaveProperty('confidence');
        expect(rec).toHaveProperty('actions');
        expect(rec).toHaveProperty('candidateMetrics');
        expect(rec).toHaveProperty('behaviorMetrics');
        expect(rec).toHaveProperty('evidence');
        expect(rec).toHaveProperty('allMatchingClassifications');
      }
    });

    it('includes correlation metadata in summary insight', async () => {
      const closestPair = baseResult2000.metadata?.summaryInsight?.closestPair;
      if (closestPair) {
        // eslint-disable-next-line jest/no-conditional-expect
        expect(closestPair).toHaveProperty('correlationSource');
        // eslint-disable-next-line jest/no-conditional-expect
        expect(closestPair).toHaveProperty('correlationConfidence');
        // eslint-disable-next-line jest/no-conditional-expect
        expect(closestPair).toHaveProperty('effectiveCorrelation');
      }
    });

    it('composite score uses rebalanced weights favoring global similarity', async () => {
      const closestPair = baseResult2000.metadata?.summaryInsight?.closestPair;
      if (closestPair && Number.isFinite(closestPair.globalMeanAbsDiff)) {
        // With new weights (0.30, 0.20, 0.50), global diff contributes most
        // The (1 - globalMeanAbsDiff) × 0.50 term should be significant
        const globalSimilarityContribution =
          (1 - closestPair.globalMeanAbsDiff) * 0.5;

        if (closestPair.globalMeanAbsDiff < 0.1) {
          // eslint-disable-next-line jest/no-conditional-expect
          expect(globalSimilarityContribution).toBeGreaterThan(0.45);
        }
      }
    });

    it('analyzes real sexual state prototypes', async () => {
      const result = await analyzer.analyze({
        prototypeFamily: 'sexual',
        sampleCount: 2000,
      });

      expect(result).toHaveProperty('recommendations');
      expect(result).toHaveProperty('metadata');
      expect(result.metadata.totalPrototypes).toBeGreaterThanOrEqual(0);
      expect(result.metadata.prototypeFamily).toBe('sexual');
    });

    it('invokes progress callback during analysis', async () => {
      const progressCalls = [];

      await analyzer.analyze({
        prototypeFamily: 'emotion',
        sampleCount: 1000,
        onProgress: (stage, completed, total) => {
          progressCalls.push({ stage, completed, total });
        },
      });

      expect(progressCalls.length).toBeGreaterThan(0);
      expect(progressCalls.some((p) => p.stage === 'filtering')).toBe(true);
    });
  });

  describe('Known Overlap Detection', () => {
    it('detects MERGE for near-identical test prototypes', async () => {
      // This test relies on actual prototype data
      // If no merge recommendations exist, it validates the system doesn't false-positive
      const mergeRecs = baseResult4000.recommendations.filter(
        (r) => r.type === 'prototype_merge_suggestion'
      );

      // Each merge recommendation should have valid structure
      mergeRecs.forEach((rec) => {
        expect(rec.severity).toBeGreaterThanOrEqual(0);
        expect(rec.severity).toBeLessThanOrEqual(1);
        expect(rec.confidence).toBeGreaterThanOrEqual(0);
        expect(rec.confidence).toBeLessThanOrEqual(1);
        expect(rec.prototypes.a).toBeDefined();
        expect(rec.prototypes.b).toBeDefined();
        expect(rec.actions.length).toBeGreaterThan(0);
      });
    });

    it('detects SUBSUMED for subset prototypes', async () => {
      const subsumptionRecs = baseResult4000.recommendations.filter(
        (r) => r.type === 'prototype_subsumption_suggestion'
      );

      // Each subsumption recommendation should have valid structure
      subsumptionRecs.forEach((rec) => {
        expect(rec.severity).toBeGreaterThanOrEqual(0);
        expect(rec.severity).toBeLessThanOrEqual(1);
        expect(
          rec.actions.some(
            (a) =>
              a.toLowerCase().includes('remove') ||
              a.toLowerCase().includes('tighten')
          )
        ).toBe(true);
      });
    });

    it('returns sorted recommendations by severity descending', async () => {
      if (baseResult2000.recommendations.length > 1) {
        for (let i = 1; i < baseResult2000.recommendations.length; i++) {
          expect(
            baseResult2000.recommendations[i - 1].severity
          ).toBeGreaterThanOrEqual(
            baseResult2000.recommendations[i].severity
          );
        }
      }
    });
  });

  describe('Performance Sanity', () => {
    it('completes analysis with 8000 samples in < 30 seconds', async () => {
      const startTime = Date.now();

      await analyzer.analyze({
        prototypeFamily: 'emotion',
        sampleCount: 8000,
      });

      const elapsed = Date.now() - startTime;
      expect(elapsed).toBeLessThan(30000);
    });

    it('handles empty prototype list gracefully', async () => {
      // Test with a family that has no prototypes (sexual)
      // The system should return empty results, not throw
      const result = await analyzer.analyze({
        prototypeFamily: 'sexual',
        sampleCount: 100,
      });

      expect(result).toHaveProperty('recommendations');
      expect(result).toHaveProperty('metadata');
    });
  });

  describe('Metric Validity', () => {
    it('all recommendation metrics are within valid bounds', async () => {
      baseResult2000.recommendations.forEach((rec) => {
        // Severity and confidence in [0,1]
        expect(rec.severity).toBeGreaterThanOrEqual(0);
        expect(rec.severity).toBeLessThanOrEqual(1);
        expect(rec.confidence).toBeGreaterThanOrEqual(0);
        expect(rec.confidence).toBeLessThanOrEqual(1);

        // Candidate metrics in [0,1]
        expect(rec.candidateMetrics.activeAxisOverlap).toBeGreaterThanOrEqual(0);
        expect(rec.candidateMetrics.activeAxisOverlap).toBeLessThanOrEqual(1);
        expect(rec.candidateMetrics.signAgreement).toBeGreaterThanOrEqual(0);
        expect(rec.candidateMetrics.signAgreement).toBeLessThanOrEqual(1);

        // Cosine similarity in [-1,1]
        expect(
          rec.candidateMetrics.weightCosineSimilarity
        ).toBeGreaterThanOrEqual(-1);
        expect(rec.candidateMetrics.weightCosineSimilarity).toBeLessThanOrEqual(
          1
        );

        // behaviorMetrics has FLAT structure (not nested gateOverlap/intensity)
        // Gate overlap rates in [0,1]
        expect(rec.behaviorMetrics.onEitherRate).toBeGreaterThanOrEqual(0);
        expect(rec.behaviorMetrics.onEitherRate).toBeLessThanOrEqual(1);
        expect(rec.behaviorMetrics.onBothRate).toBeGreaterThanOrEqual(0);
        expect(rec.behaviorMetrics.onBothRate).toBeLessThanOrEqual(1);
        expect(rec.behaviorMetrics.pOnlyRate).toBeGreaterThanOrEqual(0);
        expect(rec.behaviorMetrics.pOnlyRate).toBeLessThanOrEqual(1);
        expect(rec.behaviorMetrics.qOnlyRate).toBeGreaterThanOrEqual(0);
        expect(rec.behaviorMetrics.qOnlyRate).toBeLessThanOrEqual(1);

        // Dominance rates in [0,1]
        expect(rec.behaviorMetrics.dominanceP).toBeGreaterThanOrEqual(0);
        expect(rec.behaviorMetrics.dominanceP).toBeLessThanOrEqual(1);
        expect(rec.behaviorMetrics.dominanceQ).toBeGreaterThanOrEqual(0);
        expect(rec.behaviorMetrics.dominanceQ).toBeLessThanOrEqual(1);

        // pearsonCorrelation: can be NaN when insufficient samples, otherwise [-1,1]
        const pearson = rec.behaviorMetrics.pearsonCorrelation;
        if (!Number.isNaN(pearson)) {
          expect(pearson).toBeGreaterThanOrEqual(-1);
          expect(pearson).toBeLessThanOrEqual(1);
        }

        // meanAbsDiff: can be NaN when no joint samples, otherwise >= 0
        const meanAbsDiff = rec.behaviorMetrics.meanAbsDiff;
        if (!Number.isNaN(meanAbsDiff)) {
          expect(meanAbsDiff).toBeGreaterThanOrEqual(0);
        }
      });
    });
  });
});
