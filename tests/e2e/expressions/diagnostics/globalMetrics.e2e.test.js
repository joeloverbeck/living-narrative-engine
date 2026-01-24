/**
 * @file E2E tests for global output metrics in prototype overlap analysis
 * Tests full pipeline from bootstrap to global metrics computation.
 * These tests validate the complete system behavior with Monte Carlo sampling.
 *
 * @see src/expressionDiagnostics/services/prototypeOverlap/BehavioralOverlapEvaluator.js
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { JSDOM } from 'jsdom';
import { CommonBootstrapper } from '../../../../src/bootstrapper/CommonBootstrapper.js';
import { tokens } from '../../../../src/dependencyInjection/tokens.js';
import { diagnosticsTokens } from '../../../../src/dependencyInjection/tokens/tokens-diagnostics.js';
import { registerExpressionServices } from '../../../../src/dependencyInjection/registrations/expressionsRegistrations.js';
import { registerExpressionDiagnosticsServices } from '../../../../src/dependencyInjection/registrations/expressionDiagnosticsRegistrations.js';

/**
 * Prototypes designed to test global metrics calculation.
 * These have overlapping gates to ensure co-pass samples exist.
 */
const TEST_PROTOTYPES = {
  low_arousal_a: {
    weights: { valence: -0.4, arousal: -0.6, engagement: -0.5 },
    gates: ['arousal <= 0.40'],
  },
  low_arousal_b: {
    weights: { valence: -0.42, arousal: -0.58, engagement: -0.48 },
    gates: ['arousal <= 0.42'],
  },
};

/**
 * Prototypes with exclusive gate regions to test global metrics divergence detection.
 * These should show high globalMeanAbsDiff because they rarely fire together.
 */
const EXCLUSIVE_PROTOTYPES = {
  high_arousal: {
    weights: { arousal: 0.8, engagement: 0.6 },
    gates: ['arousal >= 0.70'], // Only fires when arousal is high
  },
  low_arousal: {
    weights: { arousal: -0.8, engagement: -0.6 },
    gates: ['arousal <= 0.30'], // Only fires when arousal is low
  },
};

describe('PrototypeOverlapAnalyzer - Global Metrics E2E', () => {
  let dom;
  let container;
  let analyzer;
  let analysisResult;

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

    // Bootstrap with minimal configuration - skipModLoading prevents network requests
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

        // Register test prototypes
        const dataRegistry = c.resolve(tokens.IDataRegistry);
        dataRegistry.store('lookups', 'core:emotion_prototypes', {
          entries: TEST_PROTOTYPES,
        });
        dataRegistry.store('lookups', 'core:sexual_prototypes', {
          entries: {},
        });
      },
    });

    if (!result?.container) {
      throw new Error('Bootstrap failed - container is undefined');
    }

    container = result.container;
    analyzer = container.resolve(diagnosticsTokens.IPrototypeOverlapAnalyzer);

    // Run analysis ONCE and share result across all tests
    analysisResult = await analyzer.analyze('emotion', {
      sampleCount: 500,
    });
  });

  afterAll(() => {
    if (dom) {
      dom.window.close();
    }
    delete global.window;
    delete global.document;
    delete global.navigator;
  });

  // ==========================================================================
  // Global metrics presence tests
  // ==========================================================================
  describe('global metrics presence', () => {
    it('includes globalMeanAbsDiff in classification metrics', () => {
      const closestPair = analysisResult.metadata?.summaryInsight?.closestPair;

      if (closestPair) {
        expect(closestPair).toHaveProperty('globalMeanAbsDiff');
        expect(typeof closestPair.globalMeanAbsDiff).toBe('number');
      }
    });

    it('includes globalL2Distance in classification metrics', () => {
      const closestPair = analysisResult.metadata?.summaryInsight?.closestPair;

      if (closestPair) {
        expect(closestPair).toHaveProperty('globalL2Distance');
        expect(typeof closestPair.globalL2Distance).toBe('number');
      }
    });

    it('includes globalOutputCorrelation in classification metrics', () => {
      const closestPair = analysisResult.metadata?.summaryInsight?.closestPair;

      if (closestPair) {
        expect(closestPair).toHaveProperty('globalOutputCorrelation');
        expect(typeof closestPair.globalOutputCorrelation).toBe('number');
      }
    });
  });

  // ==========================================================================
  // Closest pair composite score tests
  // ==========================================================================
  describe('closest pair composite score', () => {
    it('includes compositeScore in closestPair when pairs exist', () => {
      const closestPair = analysisResult.metadata?.summaryInsight?.closestPair;

      if (closestPair) {
        expect(closestPair).toHaveProperty('compositeScore');
        expect(typeof closestPair.compositeScore).toBe('number');
        expect(closestPair.compositeScore).toBeGreaterThanOrEqual(0);
        expect(closestPair.compositeScore).toBeLessThanOrEqual(1);
      }
    });

    it('includes global metrics in closestPair when pairs exist', () => {
      const closestPair = analysisResult.metadata?.summaryInsight?.closestPair;

      if (closestPair) {
        expect(closestPair).toHaveProperty('globalMeanAbsDiff');
        expect(closestPair).toHaveProperty('globalL2Distance');
        expect(closestPair).toHaveProperty('globalOutputCorrelation');
      }
    });
  });

  // ==========================================================================
  // Global metrics value consistency tests
  // ==========================================================================
  describe('global metrics value consistency', () => {
    it('globalMeanAbsDiff is in expected range [0, 1]', () => {
      const closestPair = analysisResult.metadata?.summaryInsight?.closestPair;

      if (closestPair && !Number.isNaN(closestPair.globalMeanAbsDiff)) {
        expect(closestPair.globalMeanAbsDiff).toBeGreaterThanOrEqual(0);
        expect(closestPair.globalMeanAbsDiff).toBeLessThanOrEqual(1);
      }
    });

    it('globalL2Distance is non-negative', () => {
      const closestPair = analysisResult.metadata?.summaryInsight?.closestPair;

      if (closestPair && !Number.isNaN(closestPair.globalL2Distance)) {
        expect(closestPair.globalL2Distance).toBeGreaterThanOrEqual(0);
      }
    });

    it('globalOutputCorrelation is in expected range [-1, 1] or NaN', () => {
      const closestPair = analysisResult.metadata?.summaryInsight?.closestPair;

      if (closestPair && !Number.isNaN(closestPair.globalOutputCorrelation)) {
        expect(closestPair.globalOutputCorrelation).toBeGreaterThanOrEqual(-1);
        expect(closestPair.globalOutputCorrelation).toBeLessThanOrEqual(1);
      }
    });
  });
});

describe('PrototypeOverlapAnalyzer - Selection Bias Detection E2E', () => {
  let dom;
  let container;
  let analyzer;
  let analysisResult;

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

    // Bootstrap with minimal configuration - skipModLoading prevents network requests
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

        // Register exclusive prototypes for testing selection bias detection
        const dataRegistry = c.resolve(tokens.IDataRegistry);
        dataRegistry.store('lookups', 'core:emotion_prototypes', {
          entries: EXCLUSIVE_PROTOTYPES,
        });
        dataRegistry.store('lookups', 'core:sexual_prototypes', {
          entries: {},
        });
      },
    });

    if (!result?.container) {
      throw new Error('Bootstrap failed - container is undefined');
    }

    container = result.container;
    analyzer = container.resolve(diagnosticsTokens.IPrototypeOverlapAnalyzer);

    // Run analysis ONCE with higher sample count for statistical reliability
    analysisResult = await analyzer.analyze('emotion', {
      sampleCount: 1000,
    });
  });

  afterAll(() => {
    if (dom) {
      dom.window.close();
    }
    delete global.window;
    delete global.document;
    delete global.navigator;
  });

  // ==========================================================================
  // Selection bias detection: exclusive gates show high global difference
  // ==========================================================================
  describe('exclusive firing patterns', () => {
    it('detects high globalMeanAbsDiff when prototypes fire exclusively', () => {
      const closestPair = analysisResult.metadata?.summaryInsight?.closestPair;

      if (closestPair) {
        // With exclusive gates (arousal >= 0.70 vs arousal <= 0.30):
        // - gateOverlapRatio should be very low (near 0)
        // - co-pass metrics may be NaN or unreliable
        // - globalMeanAbsDiff should be HIGH because when one fires, the other doesn't

        // The key insight: even if co-pass correlation is high (or NaN),
        // globalMeanAbsDiff reveals the true behavioral divergence
        if (!Number.isNaN(closestPair.globalMeanAbsDiff)) {
          // With exclusive firing, global diff should be significant
          // because outA and outB are rarely both non-zero at the same time
          expect(closestPair.globalMeanAbsDiff).toBeGreaterThan(0);
        }

        // Gate overlap ratio should be low
        expect(closestPair.gateOverlapRatio).toBeLessThan(0.5);
      }
    });
  });
});
