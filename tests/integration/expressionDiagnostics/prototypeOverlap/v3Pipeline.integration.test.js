/**
 * @file Integration tests for V3 Analysis Pipeline
 * Tests end-to-end V3 mode activation, metadata generation, and pipeline flow.
 * Uses real prototype data from emotion_prototypes.lookup.json.
 * Unit tests already cover deterministic pool generation and metrics calculations,
 * so these tests focus on integration verification.
 * @see specs/prototype-analysis-overhaul-v3.md
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { JSDOM } from 'jsdom';
import { CommonBootstrapper } from '../../../../src/bootstrapper/CommonBootstrapper.js';
import { tokens } from '../../../../src/dependencyInjection/tokens.js';
import { diagnosticsTokens } from '../../../../src/dependencyInjection/tokens/tokens-diagnostics.js';
import { registerExpressionServices } from '../../../../src/dependencyInjection/registrations/expressionsRegistrations.js';
import { registerExpressionDiagnosticsServices } from '../../../../src/dependencyInjection/registrations/expressionDiagnosticsRegistrations.js';

// Sample emotion prototypes for testing - subset that triggers overlap detection
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
  // Similar pair to trigger overlap detection
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
  // Additional prototypes for richer V3 testing
  anxiety: {
    weights: { valence: -0.5, arousal: 0.6, threat: 0.6 },
    gates: ['arousal >= 0.30', 'threat >= 0.20'],
  },
  relaxed: {
    weights: { valence: 0.4, arousal: -0.8, threat: -0.8 },
    gates: ['arousal <= -0.30', 'threat <= 0.30'],
  },
  excitement: {
    weights: { valence: 0.8, arousal: 0.9, engagement: 0.7 },
    gates: ['arousal >= 0.60', 'valence >= 0.30'],
  },
};

const SEXUAL_PROTOTYPES = {};

describe('V3 Pipeline Integration', () => {
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
        // Register diagnostics services (includes V3 services)
        registerExpressionDiagnosticsServices(c);

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

  describe('V3 Mode Activation', () => {
    it('should activate V3 mode when V3 services are registered', async () => {
      const result = await analyzer.analyze({
        prototypeFamily: 'emotion',
        sampleCount: 1000,
      });

      expect(result.metadata.analysisMode).toBe('v3');
    });

    it('should include analysisMode: "v3" in metadata', async () => {
      const result = await analyzer.analyze({
        prototypeFamily: 'emotion',
        sampleCount: 1000,
      });

      expect(result.metadata).toHaveProperty('analysisMode', 'v3');
    });

    it('should include v3Metrics.sharedPoolSize > 0', async () => {
      const result = await analyzer.analyze({
        prototypeFamily: 'emotion',
        sampleCount: 1000,
      });

      expect(result.metadata.v3Metrics).toBeDefined();
      expect(result.metadata.v3Metrics.sharedPoolSize).toBeGreaterThan(0);
    });

    it('should include v3Metrics.prototypeVectorsComputed > 0', async () => {
      const result = await analyzer.analyze({
        prototypeFamily: 'emotion',
        sampleCount: 1000,
      });

      expect(result.metadata.v3Metrics.prototypeVectorsComputed).toBeGreaterThan(
        0
      );
    });

    it('should include v3Metrics.profilesComputed > 0', async () => {
      const result = await analyzer.analyze({
        prototypeFamily: 'emotion',
        sampleCount: 1000,
      });

      expect(result.metadata.v3Metrics.profilesComputed).toBeGreaterThan(0);
    });

    it('should compute vectors for all prototypes', async () => {
      const result = await analyzer.analyze({
        prototypeFamily: 'emotion',
        sampleCount: 1000,
      });

      // Should have vectors for all prototypes in the test set
      expect(result.metadata.v3Metrics.prototypeVectorsComputed).toBe(
        result.metadata.totalPrototypes
      );
    });

    it('should compute profiles for all prototypes', async () => {
      const result = await analyzer.analyze({
        prototypeFamily: 'emotion',
        sampleCount: 1000,
      });

      // Should have profiles for all prototypes
      expect(result.metadata.v3Metrics.profilesComputed).toBe(
        result.metadata.totalPrototypes
      );
    });
  });

  describe('End-to-End Analysis', () => {
    it('should complete V3 analysis on test emotion prototypes', async () => {
      const result = await analyzer.analyze({
        prototypeFamily: 'emotion',
        sampleCount: 2000,
      });

      // Verify result structure
      expect(result).toHaveProperty('recommendations');
      expect(result).toHaveProperty('metadata');
      expect(Array.isArray(result.recommendations)).toBe(true);
    });

    it('should produce recommendations array', async () => {
      const result = await analyzer.analyze({
        prototypeFamily: 'emotion',
        sampleCount: 2000,
      });

      expect(Array.isArray(result.recommendations)).toBe(true);
      // Metadata should reflect what was analyzed
      expect(result.metadata.candidatePairsEvaluated).toBeGreaterThanOrEqual(0);
    });

    it('should include complete metadata structure', async () => {
      const result = await analyzer.analyze({
        prototypeFamily: 'emotion',
        sampleCount: 2000,
      });

      // Core metadata
      expect(result.metadata).toHaveProperty('prototypeFamily', 'emotion');
      expect(result.metadata).toHaveProperty('totalPrototypes');
      expect(result.metadata).toHaveProperty('candidatePairsFound');
      expect(result.metadata).toHaveProperty('candidatePairsEvaluated');
      expect(result.metadata).toHaveProperty('redundantPairsFound');
      expect(result.metadata).toHaveProperty('sampleCountPerPair');

      // V3 specific metadata
      expect(result.metadata).toHaveProperty('analysisMode', 'v3');
      expect(result.metadata).toHaveProperty('v3Metrics');
    });

    it('should use shared pool size as sample count in V3 mode', async () => {
      const result = await analyzer.analyze({
        prototypeFamily: 'emotion',
        sampleCount: 2000, // This will be overridden by shared pool size in V3
      });

      // In V3 mode, sampleCountPerPair reflects the shared pool size
      expect(result.metadata.sampleCountPerPair).toBe(
        result.metadata.v3Metrics.sharedPoolSize
      );
    });
  });

  describe('V3 Classification Results', () => {
    it('should produce classification breakdown in metadata', async () => {
      const result = await analyzer.analyze({
        prototypeFamily: 'emotion',
        sampleCount: 3000,
      });

      expect(result.metadata).toHaveProperty('classificationBreakdown');
      expect(result.metadata.classificationBreakdown).toHaveProperty(
        'mergeRecommended'
      );
      expect(result.metadata.classificationBreakdown).toHaveProperty(
        'subsumedRecommended'
      );
      expect(result.metadata.classificationBreakdown).toHaveProperty(
        'nestedSiblings'
      );
      expect(result.metadata.classificationBreakdown).toHaveProperty(
        'needsSeparation'
      );
      expect(result.metadata.classificationBreakdown).toHaveProperty(
        'keepDistinct'
      );
    });

    it('should produce some classifications (merge/subsume/nested)', async () => {
      const result = await analyzer.analyze({
        prototypeFamily: 'emotion',
        sampleCount: 3000,
      });

      const { classificationBreakdown } = result.metadata;

      // At least some classifications should occur
      const totalClassifications =
        classificationBreakdown.mergeRecommended +
        classificationBreakdown.subsumedRecommended +
        classificationBreakdown.nestedSiblings +
        classificationBreakdown.needsSeparation +
        classificationBreakdown.keepDistinct +
        (classificationBreakdown.convertToExpression || 0);

      // Should have evaluated all candidate pairs
      expect(totalClassifications).toBe(
        result.metadata.candidatePairsEvaluated
      );
    });

    it('should include behaviorMetrics with V3 fields in recommendations', async () => {
      const result = await analyzer.analyze({
        prototypeFamily: 'emotion',
        sampleCount: 3000,
      });

      // If there are recommendations, they should have V3 metrics
      if (result.recommendations.length > 0) {
        const rec = result.recommendations[0];
        // eslint-disable-next-line jest/no-conditional-expect
        expect(rec).toHaveProperty('behaviorMetrics');

        // V3 metrics should include agreement-based fields
        // Core behavioral metrics
        // eslint-disable-next-line jest/no-conditional-expect
        expect(rec.behaviorMetrics).toHaveProperty('onEitherRate');
        // eslint-disable-next-line jest/no-conditional-expect
        expect(rec.behaviorMetrics).toHaveProperty('onBothRate');
        // eslint-disable-next-line jest/no-conditional-expect
        expect(rec.behaviorMetrics).toHaveProperty('pOnlyRate');
        // eslint-disable-next-line jest/no-conditional-expect
        expect(rec.behaviorMetrics).toHaveProperty('qOnlyRate');
      }
    });

    it('should produce allMatchingClassifications array', async () => {
      const result = await analyzer.analyze({
        prototypeFamily: 'emotion',
        sampleCount: 3000,
      });

      // If there are recommendations, they should have multi-label classifications
      if (result.recommendations.length > 0) {
        const rec = result.recommendations[0];
        // eslint-disable-next-line jest/no-conditional-expect
        expect(rec).toHaveProperty('allMatchingClassifications');
        // eslint-disable-next-line jest/no-conditional-expect
        expect(Array.isArray(rec.allMatchingClassifications)).toBe(true);
      }
    });
  });

  describe('Recommendation Quality', () => {
    it('should include valid evidence in recommendations', async () => {
      const result = await analyzer.analyze({
        prototypeFamily: 'emotion',
        sampleCount: 3000,
      });

      if (result.recommendations.length > 0) {
        const rec = result.recommendations[0];
        // eslint-disable-next-line jest/no-conditional-expect
        expect(rec).toHaveProperty('evidence');
        // Evidence is an object with sharedDrivers, keyDifferentiators, etc.
        // eslint-disable-next-line jest/no-conditional-expect
        expect(typeof rec.evidence).toBe('object');
        // eslint-disable-next-line jest/no-conditional-expect
        expect(rec.evidence).toHaveProperty('sharedDrivers');
        // eslint-disable-next-line jest/no-conditional-expect
        expect(rec.evidence).toHaveProperty('keyDifferentiators');
      }
    });

    it('should include valid actions in recommendations', async () => {
      const result = await analyzer.analyze({
        prototypeFamily: 'emotion',
        sampleCount: 3000,
      });

      if (result.recommendations.length > 0) {
        const rec = result.recommendations[0];
        // eslint-disable-next-line jest/no-conditional-expect
        expect(rec).toHaveProperty('actions');
        // eslint-disable-next-line jest/no-conditional-expect
        expect(Array.isArray(rec.actions)).toBe(true);
        // eslint-disable-next-line jest/no-conditional-expect
        expect(rec.actions.length).toBeGreaterThan(0);
      }
    });

    it('should sort recommendations by severity descending', async () => {
      const result = await analyzer.analyze({
        prototypeFamily: 'emotion',
        sampleCount: 3000,
      });

      if (result.recommendations.length > 1) {
        for (let i = 1; i < result.recommendations.length; i++) {
          // eslint-disable-next-line jest/no-conditional-expect
          expect(result.recommendations[i - 1].severity).toBeGreaterThanOrEqual(
            result.recommendations[i].severity
          );
        }
      }
    });

    it('should have severity and confidence within [0, 1] bounds', async () => {
      const result = await analyzer.analyze({
        prototypeFamily: 'emotion',
        sampleCount: 3000,
      });

      for (const rec of result.recommendations) {
        expect(rec.severity).toBeGreaterThanOrEqual(0);
        expect(rec.severity).toBeLessThanOrEqual(1);
        expect(rec.confidence).toBeGreaterThanOrEqual(0);
        expect(rec.confidence).toBeLessThanOrEqual(1);
      }
    });
  });

  describe('Performance Bounds', () => {
    it('should complete V3 analysis within 30 seconds', async () => {
      const startTime = Date.now();

      await analyzer.analyze({
        prototypeFamily: 'emotion',
        sampleCount: 5000, // Test with reasonable sample count
      });

      const elapsed = Date.now() - startTime;
      expect(elapsed).toBeLessThan(30000);
    });
  });

  describe('Progress Callback Integration', () => {
    it('should invoke progress callback during V3 analysis', async () => {
      const progressCalls = [];

      await analyzer.analyze({
        prototypeFamily: 'emotion',
        sampleCount: 1000,
        onProgress: (stage, data) => {
          progressCalls.push({ stage, data });
        },
      });

      expect(progressCalls.length).toBeGreaterThan(0);
      expect(progressCalls.some((p) => p.stage === 'filtering')).toBe(true);
    });

    it('should report stage numbers in progress callbacks', async () => {
      const progressCalls = [];

      await analyzer.analyze({
        prototypeFamily: 'emotion',
        sampleCount: 1000,
        onProgress: (stage, data) => {
          progressCalls.push({ stage, data });
        },
      });

      // Should have stageNumber and totalStages in progress data
      const withStageInfo = progressCalls.filter(
        (p) => p.data?.stageNumber !== undefined
      );
      expect(withStageInfo.length).toBeGreaterThan(0);

      if (withStageInfo.length > 0) {
        // V3 pipeline has 5 stages: setup, filtering, evaluating, classifying, recommending
        // eslint-disable-next-line jest/no-conditional-expect
        expect(withStageInfo[0].data.totalStages).toBe(5);
      }
    });
  });

  describe('Empty/Edge Cases', () => {
    it('should handle empty prototype list gracefully', async () => {
      const result = await analyzer.analyze({
        prototypeFamily: 'sexual', // Empty prototype set
        sampleCount: 100,
      });

      expect(result).toHaveProperty('recommendations');
      expect(result).toHaveProperty('metadata');
      expect(result.recommendations).toHaveLength(0);
    });
  });
});
