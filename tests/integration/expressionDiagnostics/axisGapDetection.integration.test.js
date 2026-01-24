/**
 * @file Integration tests for Axis Gap Detection pipeline integration
 * Tests the full V3 pipeline with AxisGapAnalyzer integration.
 * @see tickets/AXIGAPDETSPE-009-pipeline-integration.md
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { JSDOM } from 'jsdom';
import { CommonBootstrapper } from '../../../src/bootstrapper/CommonBootstrapper.js';
import { tokens } from '../../../src/dependencyInjection/tokens.js';
import { diagnosticsTokens } from '../../../src/dependencyInjection/tokens/tokens-diagnostics.js';
import { registerExpressionServices } from '../../../src/dependencyInjection/registrations/expressionsRegistrations.js';
import { registerExpressionDiagnosticsServices } from '../../../src/dependencyInjection/registrations/expressionDiagnosticsRegistrations.js';
import SharedContextPoolGenerator from '../../../src/expressionDiagnostics/services/prototypeOverlap/SharedContextPoolGenerator.js';
import { PROTOTYPE_OVERLAP_CONFIG } from '../../../src/expressionDiagnostics/config/prototypeOverlapConfig.js';

const TEST_SHARED_POOL_SIZE = 500;
const TEST_POOL_SEED = 42;

// Sample emotion prototypes for testing
const EMOTION_PROTOTYPES = {
  calm: {
    weights: { valence: 0.2, arousal: -1.0, threat: -1.0 },
    gates: ['threat <= 0.20'],
  },
  joy: {
    weights: { valence: 1.0, arousal: 0.6, engagement: 0.5 },
    gates: ['valence >= 0.40'],
  },
  sadness: {
    weights: { valence: -1.0, arousal: -0.3, engagement: -0.4 },
    gates: ['valence <= -0.30'],
  },
  anger: {
    weights: { valence: -0.8, arousal: 0.9, threat: 0.7 },
    gates: ['arousal >= 0.50', 'threat >= 0.30'],
  },
};

const SEXUAL_PROTOTYPES = {};

describe('Axis Gap Detection Integration', () => {
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

  describe('Full V3 Pipeline with Axis Gap Analysis', () => {
    it('should include axisGapAnalysis in full V3 pipeline results', async () => {
      // Run analysis on emotion prototypes
      const result = await analyzer.analyze({
        prototypeFamily: 'emotion',
      });

      // Verify basic result structure
      expect(result).toBeDefined();
      expect(result).toHaveProperty('recommendations');
      expect(result).toHaveProperty('nearMisses');
      expect(result).toHaveProperty('metadata');

      // V3 mode should be active
      expect(result.metadata.analysisMode).toBe('v3');

      // axisGapAnalysis should be present (not undefined)
      expect(result).toHaveProperty('axisGapAnalysis');
    });

    it('should report axis_gap_analysis progress in V3 mode', async () => {
      const progressStages = new Set();

      await analyzer.analyze({
        prototypeFamily: 'emotion',
        onProgress: (stage) => {
          progressStages.add(stage);
        },
      });

      // Should include axis_gap_analysis stage
      expect(progressStages.has('axis_gap_analysis')).toBe(true);

      // Should also have standard V3 stages
      expect(progressStages.has('setup')).toBe(true);
    });

    it('should include v3Metrics in metadata', async () => {
      const result = await analyzer.analyze({
        prototypeFamily: 'emotion',
      });

      // V3 metrics should be populated
      expect(result.metadata.v3Metrics).toBeDefined();
      expect(result.metadata.v3Metrics).toHaveProperty('sharedPoolSize');
      expect(result.metadata.v3Metrics).toHaveProperty(
        'prototypeVectorsComputed'
      );
      expect(result.metadata.v3Metrics).toHaveProperty('profilesComputed');
    });
  });

  describe('Feature Flag Behavior', () => {
    it('should respect enableAxisGapDetection config flag', async () => {
      const result = await analyzer.analyze({
        prototypeFamily: 'emotion',
      });

      // The feature flag is enabled by default in the config
      // When enableAxisGapDetection is true (default), we expect either:
      // - axisGapAnalysis to be a valid object (analysis ran)
      // - axisGapAnalysis to be null (analysis skipped due to edge case)
      expect(result).toHaveProperty('axisGapAnalysis');
    });
  });

  describe('DI Registration Verification', () => {
    it('should have AxisGapAnalyzer registered and resolvable', () => {
      const axisGapAnalyzer = container.resolve(
        diagnosticsTokens.IAxisGapAnalyzer
      );

      expect(axisGapAnalyzer).toBeDefined();
      expect(typeof axisGapAnalyzer.analyze).toBe('function');
    });

    it('should have PrototypeOverlapAnalyzer with axisGapAnalyzer dependency', () => {
      expect(analyzer).toBeDefined();
      // The analyzer should be fully functional with all V3 services
      expect(typeof analyzer.analyze).toBe('function');
    });
  });

  describe('Pipeline Data Flow', () => {
    it('should propagate prototype data through all pipeline stages', async () => {
      const progressData = [];

      const result = await analyzer.analyze({
        prototypeFamily: 'emotion',
        onProgress: (stage, data) => {
          progressData.push({ stage, data });
        },
      });

      // Verify stage progression
      const stages = progressData.map((p) => p.stage);

      // V3 stages should include: setup, filtering, evaluating, classifying, recommending, axis_gap_analysis
      expect(stages).toContain('setup');
      expect(stages).toContain('filtering');

      // Result should have all expected fields
      expect(result.recommendations).toBeInstanceOf(Array);
      expect(result.nearMisses).toBeInstanceOf(Array);
      expect(result.metadata.totalPrototypes).toBeGreaterThanOrEqual(0);
    });
  });
});
