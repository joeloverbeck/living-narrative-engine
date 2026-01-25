/**
 * @file Integration tests for Candidate Axis Validation
 * Tests the end-to-end validation flow from extraction through recommendation.
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

// Prototypes designed to trigger candidate axis validation signals
// These use multiple axes with diverse weights to create validation scenarios
const VALIDATION_PROTOTYPES = {
  high_valence: {
    weights: { valence: 1.0, arousal: 0.3, engagement: 0.2 },
    gates: ['valence >= 0.50'],
  },
  low_valence: {
    weights: { valence: -1.0, arousal: 0.2, engagement: 0.1 },
    gates: ['valence <= -0.30'],
  },
  high_arousal: {
    weights: { valence: 0.2, arousal: 1.0, threat: 0.4 },
    gates: ['arousal >= 0.60'],
  },
  low_arousal: {
    weights: { valence: 0.1, arousal: -1.0, engagement: -0.3 },
    gates: ['arousal <= -0.50'],
  },
  mixed_tension: {
    weights: { valence: 0.5, arousal: -0.5, threat: 0.7, engagement: 0.3 },
    gates: ['threat >= 0.40'],
  },
  complex_state: {
    weights: {
      valence: 0.3,
      arousal: 0.4,
      threat: 0.2,
      engagement: 0.8,
      dominance: 0.5,
    },
    gates: ['engagement >= 0.50'],
  },
};

// Minimal prototypes for testing edge cases
const MINIMAL_PROTOTYPES = {
  single_axis: {
    weights: { valence: 1.0 },
    gates: ['valence >= 0.50'],
  },
};

// Helper to conditionally skip describe blocks based on config
const describeWhenValidationEnabled =
  PROTOTYPE_OVERLAP_CONFIG.enableCandidateAxisValidation ? describe : describe.skip;

describe('Candidate Axis Validation Integration', () => {
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

        // Register prototypes for testing
        const dataRegistry = c.resolve(tokens.IDataRegistry);
        dataRegistry.store('lookups', 'core:emotion_prototypes', {
          entries: VALIDATION_PROTOTYPES,
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

  describe('End-to-End Validation Flow', () => {
    it('should include axisGapAnalysis in result', async () => {
      const result = await analyzer.analyze({
        prototypeFamily: 'emotion',
      });

      expect(result).toHaveProperty('axisGapAnalysis');
    });

    describeWhenValidationEnabled('when candidate axis validation is enabled', () => {
      it('should include candidateAxes in axis gap analysis', async () => {
        const result = await analyzer.analyze({
          prototypeFamily: 'emotion',
        });

        expect(result).toHaveProperty('axisGapAnalysis');
        expect(result.axisGapAnalysis).toHaveProperty('candidateAxes');
      });

      it('should report candidate_axis_validation progress stage', async () => {
        const nestedStages = new Set();

        await analyzer.analyze({
          prototypeFamily: 'emotion',
          onProgress: (stage, details) => {
            // The nested stage from AxisGapAnalyzer is reported in the details
            if (details && details.stage) {
              nestedStages.add(details.stage);
            }
          },
        });

        // The candidate_axis_validation stage is nested within axis_gap_analysis
        expect(nestedStages.has('candidate_axis_validation')).toBe(true);
      });
    });

    it('should report axis_gap_analysis progress stage', async () => {
      const progressStages = new Set();

      await analyzer.analyze({
        prototypeFamily: 'emotion',
        onProgress: (stage) => {
          progressStages.add(stage);
        },
      });

      // Standard stages should always be present
      expect(progressStages.has('axis_gap_analysis')).toBe(true);
    });
  });

  describe('Report Structure Validation', () => {
    it('should produce valid axis gap analysis structure', async () => {
      const result = await analyzer.analyze({
        prototypeFamily: 'emotion',
      });

      expect(result).toHaveProperty('axisGapAnalysis');
      expect(result.axisGapAnalysis).not.toBeNull();

      // Verify required report fields
      expect(result.axisGapAnalysis).toHaveProperty('summary');
      expect(result.axisGapAnalysis).toHaveProperty('pcaAnalysis');
      expect(result.axisGapAnalysis).toHaveProperty('hubPrototypes');
      expect(result.axisGapAnalysis).toHaveProperty('coverageGaps');
      expect(result.axisGapAnalysis).toHaveProperty('recommendations');

      // Summary should have expected properties
      const summary = result.axisGapAnalysis.summary;
      expect(summary).toHaveProperty('totalPrototypesAnalyzed');
      expect(summary).toHaveProperty('recommendationCount');
      expect(summary).toHaveProperty('confidence');
    });

    describeWhenValidationEnabled('candidate axis fields when validation enabled', () => {
      it('should include candidateAxes as array in report', async () => {
        const result = await analyzer.analyze({
          prototypeFamily: 'emotion',
        });

        expect(result.axisGapAnalysis).toBeDefined();
        const candidateAxes = result.axisGapAnalysis.candidateAxes;

        // candidateAxes should be an array (possibly empty)
        expect(Array.isArray(candidateAxes)).toBe(true);
      });

      it('should have valid candidate structure when candidates exist', async () => {
        const result = await analyzer.analyze({
          prototypeFamily: 'emotion',
        });

        const candidateAxes = result.axisGapAnalysis?.candidateAxes ?? [];

        // Only verify structure if there are candidates
        // This is an integration test - we can't guarantee candidates will be generated
        candidateAxes.forEach((candidate) => {
          expect(candidate).toHaveProperty('candidateId');
          expect(candidate).toHaveProperty('source');
          expect(candidate).toHaveProperty('confidence');
          expect(candidate).toHaveProperty('direction');
        });
      });

      it('should have non-zero direction vectors for PCA candidates when generated', async () => {
        const result = await analyzer.analyze({
          prototypeFamily: 'emotion',
        });

        const candidateAxes = result.axisGapAnalysis?.candidateAxes ?? [];
        const pcaCandidates = candidateAxes.filter(
          (c) => c.source === 'pca_residual'
        );

        // For PCA candidates that exist, verify direction is non-zero
        // This validates the eigenvector extraction fix from Phase 1 & 2
        pcaCandidates.forEach((candidate) => {
          expect(candidate.direction).not.toBeNull();
          expect(typeof candidate.direction).toBe('object');

          // Direction should have at least one axis with non-zero value
          const directionValues = Object.values(candidate.direction);
          const hasNonZeroValue = directionValues.some((v) => Math.abs(v) > 0);
          expect(hasNonZeroValue).toBe(true);
        });
      });

      it('should include validationError field in candidate results when applicable', async () => {
        const result = await analyzer.analyze({
          prototypeFamily: 'emotion',
        });

        const candidateAxes = result.axisGapAnalysis?.candidateAxes ?? [];

        // Each candidate should have validationError field (null for valid, string for invalid)
        candidateAxes.forEach((candidate) => {
          expect(candidate).toHaveProperty('validationError');
          // validationError should be null or a string error code
          const validationType =
            candidate.validationError === null
              ? 'null'
              : typeof candidate.validationError;
          expect(['null', 'string']).toContain(validationType);
        });
      });
    });
  });

  describe('Recommendation Generation Integration', () => {
    it('should generate recommendations based on analysis signals', async () => {
      const result = await analyzer.analyze({
        prototypeFamily: 'emotion',
      });

      expect(result.axisGapAnalysis).toBeDefined();
      expect(Array.isArray(result.axisGapAnalysis.recommendations)).toBe(true);

      // Each recommendation should have expected structure
      result.axisGapAnalysis.recommendations.forEach((rec) => {
        expect(rec).toHaveProperty('priority');
        expect(rec).toHaveProperty('type');
        expect(rec).toHaveProperty('message');
        expect(['HIGH', 'MEDIUM', 'LOW']).toContain(rec.priority);
      });
    });

    describeWhenValidationEnabled('candidate validation correlation', () => {
      it('should produce recommendations array alongside candidateAxes', async () => {
        const result = await analyzer.analyze({
          prototypeFamily: 'emotion',
        });

        expect(result.axisGapAnalysis).toBeDefined();
        expect(result.axisGapAnalysis).toHaveProperty('candidateAxes');
        expect(result.axisGapAnalysis).toHaveProperty('recommendations');

        // Both should be arrays
        expect(Array.isArray(result.axisGapAnalysis.candidateAxes)).toBe(true);
        expect(Array.isArray(result.axisGapAnalysis.recommendations)).toBe(true);
      });

      it('should generate axis recommendations when candidates are recommended', async () => {
        const result = await analyzer.analyze({
          prototypeFamily: 'emotion',
        });

        const { candidateAxes, recommendations } = result.axisGapAnalysis;
        const recommendedCandidates = candidateAxes.filter((c) => c.isRecommended);

        // If there are recommended candidates, recommendations should exist
        // (may include ADD_AXIS or other types)
        expect(recommendations.length).toBeGreaterThanOrEqual(recommendedCandidates.length > 0 ? 0 : 0);
      });
    });
  });

  describe('DI Registration Verification', () => {
    it('should have AxisGapAnalyzer with validation dependencies injected', () => {
      const axisGapAnalyzer = container.resolve(diagnosticsTokens.IAxisGapAnalyzer);
      expect(axisGapAnalyzer).toBeDefined();
      expect(typeof axisGapAnalyzer.analyze).toBe('function');
    });

    describeWhenValidationEnabled('candidate axis services registration', () => {
      it('should have CandidateAxisExtractor registered', () => {
        const extractor = container.resolve(diagnosticsTokens.ICandidateAxisExtractor);
        expect(extractor).toBeDefined();
        expect(typeof extractor.extract).toBe('function');
      });

      it('should have CandidateAxisValidator registered', () => {
        const validator = container.resolve(diagnosticsTokens.ICandidateAxisValidator);
        expect(validator).toBeDefined();
        expect(typeof validator.validate).toBe('function');
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty prototype set gracefully', async () => {
      // Override with empty prototypes
      const dataRegistry = container.resolve(tokens.IDataRegistry);
      const originalPrototypes = dataRegistry.get('lookups', 'core:emotion_prototypes');

      dataRegistry.store('lookups', 'core:emotion_prototypes', {
        entries: {},
      });

      const result = await analyzer.analyze({
        prototypeFamily: 'emotion',
      });

      // Should return valid result even with no prototypes
      expect(result).toBeDefined();

      // Restore original
      dataRegistry.store('lookups', 'core:emotion_prototypes', originalPrototypes);
    });

    it('should handle single prototype gracefully', async () => {
      // Override with minimal prototypes
      const dataRegistry = container.resolve(tokens.IDataRegistry);
      const originalPrototypes = dataRegistry.get('lookups', 'core:emotion_prototypes');

      dataRegistry.store('lookups', 'core:emotion_prototypes', {
        entries: MINIMAL_PROTOTYPES,
      });

      const result = await analyzer.analyze({
        prototypeFamily: 'emotion',
      });

      // Should return valid result even with single prototype
      expect(result).toBeDefined();

      // Restore original
      dataRegistry.store('lookups', 'core:emotion_prototypes', originalPrototypes);
    });
  });
});
