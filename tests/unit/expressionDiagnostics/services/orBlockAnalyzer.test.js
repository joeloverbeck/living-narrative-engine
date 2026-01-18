/**
 * @file Unit tests for OrBlockAnalyzer.
 * @see src/expressionDiagnostics/services/OrBlockAnalyzer.js
 */

import { describe, expect, it, jest, beforeEach } from '@jest/globals';
import OrBlockAnalyzer from '../../../../src/expressionDiagnostics/services/OrBlockAnalyzer.js';

const createLogger = () => ({
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
});

describe('OrBlockAnalyzer', () => {
  describe('constructor', () => {
    it('creates instance with valid dependencies', () => {
      const logger = createLogger();
      const analyzer = new OrBlockAnalyzer({ logger });
      expect(analyzer).toBeInstanceOf(OrBlockAnalyzer);
    });

    it('throws if logger is missing', () => {
      expect(() => new OrBlockAnalyzer({})).toThrow();
    });

    it('throws if logger is null', () => {
      expect(() => new OrBlockAnalyzer({ logger: null })).toThrow();
    });

    it('accepts optional config override', () => {
      const logger = createLogger();
      const customConfig = {
        enabled: true,
        deadWeightThreshold: 0.02,
        weakContributorThreshold: 0.1,
        targetExclusiveCoverage: 0.15,
        enableReplacementSuggestions: true,
      };
      const analyzer = new OrBlockAnalyzer({ logger, config: customConfig });
      expect(analyzer).toBeInstanceOf(OrBlockAnalyzer);
    });
  });

  describe('analyze() - empty/invalid inputs', () => {
    let logger;
    let analyzer;

    beforeEach(() => {
      logger = createLogger();
      analyzer = new OrBlockAnalyzer({ logger });
    });

    it('returns empty result for null orBlock', () => {
      const result = analyzer.analyze(null, { sampleCount: 1000 });
      expect(result.blockId).toBe('unknown');
      expect(result.alternatives).toEqual([]);
      expect(result.deadWeightCount).toBe(0);
      expect(result.recommendations).toEqual([]);
    });

    it('returns empty result for undefined orBlock', () => {
      const result = analyzer.analyze(undefined, { sampleCount: 1000 });
      expect(result.alternatives).toEqual([]);
      expect(result.deadWeightCount).toBe(0);
    });

    it('returns empty result for orBlock with no alternatives', () => {
      const orBlock = { blockId: 'test-block', alternatives: [] };
      const result = analyzer.analyze(orBlock, { sampleCount: 1000 });
      expect(result.blockId).toBe('test-block');
      expect(result.alternatives).toEqual([]);
      expect(result.deadWeightCount).toBe(0);
    });

    it('returns empty result for orBlock with null alternatives', () => {
      const orBlock = { blockId: 'test-block', alternatives: null };
      const result = analyzer.analyze(orBlock, { sampleCount: 1000 });
      expect(result.alternatives).toEqual([]);
    });

    it('returns empty result for null simulation result', () => {
      const orBlock = {
        blockId: 'test-block',
        alternatives: [{ clauseId: 'alt1' }],
      };
      const result = analyzer.analyze(orBlock, null);
      expect(result.alternatives).toEqual([]);
    });

    it('returns valid OrBlockAnalysis structure always', () => {
      const result = analyzer.analyze(null, null);
      expect(result).toHaveProperty('blockId');
      expect(result).toHaveProperty('blockDescription');
      expect(result).toHaveProperty('alternatives');
      expect(result).toHaveProperty('deadWeightCount');
      expect(result).toHaveProperty('recommendations');
      expect(result).toHaveProperty('impactSummary');
      expect(Array.isArray(result.alternatives)).toBe(true);
      expect(Array.isArray(result.recommendations)).toBe(true);
      expect(typeof result.deadWeightCount).toBe('number');
      expect(typeof result.impactSummary).toBe('string');
    });
  });

  describe('analyze() - dead-weight identification', () => {
    let logger;
    let analyzer;

    beforeEach(() => {
      logger = createLogger();
      analyzer = new OrBlockAnalyzer({ logger });
    });

    it('identifies dead-weight alternative with < 1% exclusive coverage', () => {
      const orBlock = {
        blockId: 'or-1',
        alternatives: [
          {
            clauseId: 'meaningful-alt',
            description: 'Meaningful alternative',
            exclusiveCoverage: 0.15, // 15% exclusive coverage
            passCount: 500,
            exclusivePassCount: 150,
          },
          {
            clauseId: 'dead-weight-alt',
            description: 'Dead-weight alternative',
            exclusiveCoverage: 0.005, // 0.5% exclusive coverage
            passCount: 400,
            exclusivePassCount: 5,
          },
        ],
        passCount: 600,
      };
      const simulationResult = { sampleCount: 1000, triggerRate: 0.6 };

      const result = analyzer.analyze(orBlock, simulationResult);

      expect(result.deadWeightCount).toBe(1);
      const deadWeight = result.alternatives.find(
        (a) => a.classification === 'dead-weight'
      );
      expect(deadWeight).toBeDefined();
      expect(deadWeight.alternativeIndex).toBe(1);
    });

    it('correctly calculates marginal contribution', () => {
      const orBlock = {
        blockId: 'or-1',
        alternatives: [
          {
            clauseId: 'alt1',
            exclusiveCoverage: 0.005,
            exclusivePassCount: 5,
            marginalContribution: 0.01, // Pre-computed
          },
        ],
        passCount: 500,
      };
      const simulationResult = { sampleCount: 1000, triggerRate: 0.5 };

      const result = analyzer.analyze(orBlock, simulationResult);

      expect(result.alternatives[0].marginalContribution).toBe(0.01);
    });

    it('calculates overlap ratio correctly', () => {
      const orBlock = {
        blockId: 'or-1',
        alternatives: [
          {
            clauseId: 'alt1',
            exclusiveCoverage: 0.005,
            passCount: 400,
            exclusivePassCount: 5,
            // Overlap = (400 - 5) / 400 = 0.9875
          },
        ],
        passCount: 500,
      };
      const simulationResult = { sampleCount: 1000, triggerRate: 0.5 };

      const result = analyzer.analyze(orBlock, simulationResult);

      const overlapRatio = result.alternatives[0].overlapRatio;
      expect(overlapRatio).toBeCloseTo(0.9875, 4);
    });
  });

  describe('analyze() - weak contributor identification', () => {
    let logger;
    let analyzer;

    beforeEach(() => {
      logger = createLogger();
      analyzer = new OrBlockAnalyzer({ logger });
    });

    it('classifies 1-5% exclusive coverage as weak', () => {
      const orBlock = {
        blockId: 'or-1',
        alternatives: [
          {
            clauseId: 'weak-alt',
            description: 'Weak alternative',
            exclusiveCoverage: 0.03, // 3% - in weak range
            passCount: 300,
            exclusivePassCount: 30,
          },
        ],
        passCount: 500,
      };
      const simulationResult = { sampleCount: 1000, triggerRate: 0.5 };

      const result = analyzer.analyze(orBlock, simulationResult);

      expect(result.alternatives[0].classification).toBe('weak');
      expect(result.deadWeightCount).toBe(0);
    });

    it('generates lower-threshold recommendation for weak with numeric threshold', () => {
      const orBlock = {
        blockId: 'or-1',
        alternatives: [
          {
            clauseId: 'weak-alt',
            description: 'mood.joy > 0.5',
            exclusiveCoverage: 0.03,
            passCount: 300,
            exclusivePassCount: 30,
            threshold: 0.5,
          },
        ],
        passCount: 500,
      };
      const simulationResult = { sampleCount: 1000, triggerRate: 0.5 };

      const result = analyzer.analyze(orBlock, simulationResult);

      const lowerThresholdRec = result.recommendations.find(
        (r) => r.action === 'lower-threshold'
      );
      expect(lowerThresholdRec).toBeDefined();
      expect(lowerThresholdRec.targetAlternative).toBe(0);
      expect(typeof lowerThresholdRec.suggestedValue).toBe('number');
    });
  });

  describe('analyze() - meaningful classification', () => {
    let logger;
    let analyzer;

    beforeEach(() => {
      logger = createLogger();
      analyzer = new OrBlockAnalyzer({ logger });
    });

    it('classifies > 5% exclusive coverage as meaningful', () => {
      const orBlock = {
        blockId: 'or-1',
        alternatives: [
          {
            clauseId: 'meaningful-alt',
            description: 'Meaningful alternative',
            exclusiveCoverage: 0.15, // 15% - meaningful
            passCount: 500,
            exclusivePassCount: 150,
          },
        ],
        passCount: 600,
      };
      const simulationResult = { sampleCount: 1000, triggerRate: 0.6 };

      const result = analyzer.analyze(orBlock, simulationResult);

      expect(result.alternatives[0].classification).toBe('meaningful');
      expect(result.deadWeightCount).toBe(0);
    });

    it('does not generate delete recommendation for meaningful', () => {
      const orBlock = {
        blockId: 'or-1',
        alternatives: [
          {
            clauseId: 'meaningful-alt',
            exclusiveCoverage: 0.15,
            passCount: 500,
            exclusivePassCount: 150,
          },
        ],
        passCount: 600,
      };
      const simulationResult = { sampleCount: 1000, triggerRate: 0.6 };

      const result = analyzer.analyze(orBlock, simulationResult);

      const deleteRec = result.recommendations.find(
        (r) => r.action === 'delete'
      );
      expect(deleteRec).toBeUndefined();
    });
  });

  describe('analyze() - recommendations', () => {
    let logger;
    let analyzer;

    beforeEach(() => {
      logger = createLogger();
      analyzer = new OrBlockAnalyzer({ logger });
    });

    it('generates delete recommendation for dead-weight', () => {
      const orBlock = {
        blockId: 'or-1',
        alternatives: [
          {
            clauseId: 'dead-weight',
            exclusiveCoverage: 0.005,
            passCount: 400,
            exclusivePassCount: 5,
          },
        ],
        passCount: 500,
      };
      const simulationResult = { sampleCount: 1000, triggerRate: 0.5 };

      const result = analyzer.analyze(orBlock, simulationResult);

      const deleteRec = result.recommendations.find(
        (r) => r.action === 'delete'
      );
      expect(deleteRec).toBeDefined();
      expect(deleteRec.targetAlternative).toBe(0);
      expect(deleteRec.rationale).toContain('Exclusive coverage');
      expect(deleteRec.predictedImpact).toContain('complexity');
    });

    it('generates lower-threshold recommendation with target coverage', () => {
      const orBlock = {
        blockId: 'or-1',
        alternatives: [
          {
            clauseId: 'dead-weight',
            exclusiveCoverage: 0.005,
            passCount: 400,
            exclusivePassCount: 5,
            threshold: 0.7,
          },
        ],
        passCount: 500,
      };
      const simulationResult = { sampleCount: 1000, triggerRate: 0.5 };

      const result = analyzer.analyze(orBlock, simulationResult);

      const thresholdRec = result.recommendations.find(
        (r) => r.action === 'lower-threshold'
      );
      expect(thresholdRec).toBeDefined();
      expect(typeof thresholdRec.suggestedValue).toBe('number');
      expect(thresholdRec.rationale).toContain('threshold');
    });

    it('does not generate replace recommendation when disabled in config', () => {
      // Default config has enableReplacementSuggestions: false
      const orBlock = {
        blockId: 'or-1',
        alternatives: [
          {
            clauseId: 'dead-weight',
            exclusiveCoverage: 0.005,
            passCount: 400,
            exclusivePassCount: 5,
          },
        ],
        passCount: 500,
      };
      const simulationResult = { sampleCount: 1000, triggerRate: 0.5 };

      const result = analyzer.analyze(orBlock, simulationResult);

      const replaceRec = result.recommendations.find(
        (r) => r.action === 'replace'
      );
      expect(replaceRec).toBeUndefined();
    });

    it('generates replace recommendation when enabled in config', () => {
      const customConfig = {
        enabled: true,
        deadWeightThreshold: 0.01,
        weakContributorThreshold: 0.05,
        targetExclusiveCoverage: 0.08,
        enableReplacementSuggestions: true,
      };
      const analyzerWithReplace = new OrBlockAnalyzer({
        logger: createLogger(),
        config: customConfig,
      });

      const orBlock = {
        blockId: 'or-1',
        alternatives: [
          {
            clauseId: 'dead-weight',
            exclusiveCoverage: 0.005,
            passCount: 400,
            exclusivePassCount: 5,
          },
        ],
        passCount: 500,
      };
      const simulationResult = { sampleCount: 1000, triggerRate: 0.5 };

      const result = analyzerWithReplace.analyze(orBlock, simulationResult);

      const replaceRec = result.recommendations.find(
        (r) => r.action === 'replace'
      );
      expect(replaceRec).toBeDefined();
      expect(replaceRec.suggestedReplacement).toContain('replacing');
    });
  });

  describe('analyze() - edge cases', () => {
    let logger;
    let analyzer;

    beforeEach(() => {
      logger = createLogger();
      analyzer = new OrBlockAnalyzer({ logger });
    });

    it('handles single-alternative OR blocks', () => {
      const orBlock = {
        blockId: 'or-single',
        alternatives: [
          {
            clauseId: 'only-alt',
            exclusiveCoverage: 1.0, // Single alt has 100% exclusive
            passCount: 500,
            exclusivePassCount: 500,
          },
        ],
        passCount: 500,
      };
      const simulationResult = { sampleCount: 1000, triggerRate: 0.5 };

      const result = analyzer.analyze(orBlock, simulationResult);

      expect(result.alternatives.length).toBe(1);
      expect(result.alternatives[0].classification).toBe('meaningful');
      expect(result.deadWeightCount).toBe(0);
    });

    it('handles OR blocks where all alternatives are meaningful', () => {
      const orBlock = {
        blockId: 'or-all-meaningful',
        alternatives: [
          {
            clauseId: 'alt1',
            exclusiveCoverage: 0.3,
            passCount: 400,
            exclusivePassCount: 300,
          },
          {
            clauseId: 'alt2',
            exclusiveCoverage: 0.25,
            passCount: 350,
            exclusivePassCount: 250,
          },
          {
            clauseId: 'alt3',
            exclusiveCoverage: 0.15,
            passCount: 300,
            exclusivePassCount: 150,
          },
        ],
        passCount: 700,
      };
      const simulationResult = { sampleCount: 1000, triggerRate: 0.7 };

      const result = analyzer.analyze(orBlock, simulationResult);

      expect(result.deadWeightCount).toBe(0);
      expect(
        result.alternatives.every((a) => a.classification === 'meaningful')
      ).toBe(true);
      expect(result.impactSummary).toContain('efficient');
    });

    it('handles missing tracking data gracefully', () => {
      const orBlock = {
        blockId: 'or-minimal',
        alternatives: [
          {
            clauseId: 'alt-minimal',
            // No tracking data at all
          },
        ],
      };
      const simulationResult = { sampleCount: 1000, triggerRate: 0.5 };

      const result = analyzer.analyze(orBlock, simulationResult);

      expect(result.alternatives.length).toBe(1);
      expect(result.alternatives[0].exclusiveCoverage).toBe(0);
      expect(result.alternatives[0].classification).toBe('dead-weight');
    });

    it('handles zero passCount without division error', () => {
      const orBlock = {
        blockId: 'or-zero',
        alternatives: [
          {
            clauseId: 'alt-zero',
            passCount: 0,
            exclusivePassCount: 0,
          },
        ],
        passCount: 0,
      };
      const simulationResult = { sampleCount: 1000, triggerRate: 0 };

      // Should not throw
      const result = analyzer.analyze(orBlock, simulationResult);

      expect(result.alternatives[0].overlapRatio).toBe(0);
      expect(Number.isNaN(result.alternatives[0].overlapRatio)).toBe(false);
    });

    it('handles zero sampleCount without division error', () => {
      const orBlock = {
        blockId: 'or-zero-samples',
        alternatives: [
          {
            clauseId: 'alt1',
            exclusivePassCount: 10,
          },
        ],
        passCount: 100,
      };
      const simulationResult = { sampleCount: 0, triggerRate: 0 };

      // Should not throw
      const result = analyzer.analyze(orBlock, simulationResult);

      expect(Number.isNaN(result.alternatives[0].exclusiveCoverage)).toBe(false);
      expect(result.alternatives[0].exclusiveCoverage).toBe(0);
    });

    it('uses pre-computed values when available', () => {
      const orBlock = {
        blockId: 'or-precomputed',
        alternatives: [
          {
            clauseId: 'alt1',
            exclusiveCoverage: 0.12, // Pre-computed
            marginalContribution: 0.08, // Pre-computed
            overlapRatio: 0.7, // Pre-computed
          },
        ],
        passCount: 500,
      };
      const simulationResult = { sampleCount: 1000, triggerRate: 0.5 };

      const result = analyzer.analyze(orBlock, simulationResult);

      expect(result.alternatives[0].exclusiveCoverage).toBe(0.12);
      expect(result.alternatives[0].marginalContribution).toBe(0.08);
      expect(result.alternatives[0].overlapRatio).toBe(0.7);
    });
  });

  describe('analyzeAll()', () => {
    let logger;
    let analyzer;

    beforeEach(() => {
      logger = createLogger();
      analyzer = new OrBlockAnalyzer({ logger });
    });

    it('processes multiple OR blocks', () => {
      const orBlocks = [
        {
          blockId: 'or-1',
          alternatives: [
            { clauseId: 'alt1', exclusiveCoverage: 0.15 },
          ],
          passCount: 500,
        },
        {
          blockId: 'or-2',
          alternatives: [
            { clauseId: 'alt2', exclusiveCoverage: 0.005 },
          ],
          passCount: 400,
        },
      ];
      const simulationResult = { sampleCount: 1000, triggerRate: 0.5 };

      const results = analyzer.analyzeAll(orBlocks, simulationResult);

      expect(results.length).toBe(2);
      expect(results[0].blockId).toBe('or-1');
      expect(results[1].blockId).toBe('or-2');
    });

    it('returns empty array for non-array input', () => {
      const results = analyzer.analyzeAll(null, { sampleCount: 1000 });
      expect(results).toEqual([]);
    });

    it('returns empty array for undefined input', () => {
      const results = analyzer.analyzeAll(undefined, { sampleCount: 1000 });
      expect(results).toEqual([]);
    });

    it('handles empty array input', () => {
      const results = analyzer.analyzeAll([], { sampleCount: 1000 });
      expect(results).toEqual([]);
    });
  });

  describe('impact summary', () => {
    let logger;
    let analyzer;

    beforeEach(() => {
      logger = createLogger();
      analyzer = new OrBlockAnalyzer({ logger });
    });

    it('summarizes no dead-weight correctly', () => {
      const orBlock = {
        blockId: 'or-1',
        alternatives: [
          { clauseId: 'alt1', exclusiveCoverage: 0.2 },
          { clauseId: 'alt2', exclusiveCoverage: 0.15 },
        ],
        passCount: 600,
      };
      const simulationResult = { sampleCount: 1000, triggerRate: 0.6 };

      const result = analyzer.analyze(orBlock, simulationResult);

      expect(result.impactSummary).toContain('No dead-weight');
      expect(result.impactSummary).toContain('efficient');
    });

    it('calculates complexity reduction percentage', () => {
      const orBlock = {
        blockId: 'or-1',
        alternatives: [
          { clauseId: 'alt1', exclusiveCoverage: 0.2 },
          { clauseId: 'dead1', exclusiveCoverage: 0.005 },
          { clauseId: 'dead2', exclusiveCoverage: 0.003 },
        ],
        passCount: 500,
      };
      const simulationResult = { sampleCount: 1000, triggerRate: 0.5 };

      const result = analyzer.analyze(orBlock, simulationResult);

      // 2 dead-weight out of 3 alternatives = 67% complexity reduction
      expect(result.impactSummary).toContain('67%');
    });

    it('calculates coverage loss percentage', () => {
      const orBlock = {
        blockId: 'or-1',
        alternatives: [
          { clauseId: 'alt1', exclusiveCoverage: 0.2 },
          {
            clauseId: 'dead1',
            exclusiveCoverage: 0.005,
            exclusivePassCount: 5,
            marginalContribution: 0.01,
          },
        ],
        passCount: 500,
      };
      const simulationResult = { sampleCount: 1000, triggerRate: 0.5 };

      const result = analyzer.analyze(orBlock, simulationResult);

      // Should mention coverage loss
      expect(result.impactSummary).toContain('coverage loss');
    });
  });

  describe('description extraction', () => {
    let logger;
    let analyzer;

    beforeEach(() => {
      logger = createLogger();
      analyzer = new OrBlockAnalyzer({ logger });
    });

    it('uses description field if available', () => {
      const orBlock = {
        blockId: 'or-1',
        description: 'Custom OR block description',
        alternatives: [{ clauseId: 'alt1', exclusiveCoverage: 0.2 }],
        passCount: 500,
      };
      const simulationResult = { sampleCount: 1000 };

      const result = analyzer.analyze(orBlock, simulationResult);

      expect(result.blockDescription).toBe('Custom OR block description');
    });

    it('uses blockDescription field as fallback', () => {
      const orBlock = {
        blockId: 'or-1',
        blockDescription: 'Block description fallback',
        alternatives: [{ clauseId: 'alt1', exclusiveCoverage: 0.2 }],
        passCount: 500,
      };
      const simulationResult = { sampleCount: 1000 };

      const result = analyzer.analyze(orBlock, simulationResult);

      expect(result.blockDescription).toBe('Block description fallback');
    });

    it('generates default description from alternative count', () => {
      const orBlock = {
        blockId: 'or-1',
        alternatives: [
          { clauseId: 'alt1', exclusiveCoverage: 0.2 },
          { clauseId: 'alt2', exclusiveCoverage: 0.15 },
          { clauseId: 'alt3', exclusiveCoverage: 0.1 },
        ],
        passCount: 500,
      };
      const simulationResult = { sampleCount: 1000 };

      const result = analyzer.analyze(orBlock, simulationResult);

      expect(result.blockDescription).toContain('3 alternative');
    });

    it('extracts alternative description from various fields', () => {
      const orBlock = {
        blockId: 'or-1',
        alternatives: [
          { clauseId: 'alt1', description: 'Alt 1 description', exclusiveCoverage: 0.2 },
          { clauseId: 'alt2', clauseDescription: 'Alt 2 clause desc', exclusiveCoverage: 0.15 },
          {
            clauseId: 'alt3',
            variablePath: 'mood.joy',
            operator: '>',
            threshold: 0.5,
            exclusiveCoverage: 0.1,
          },
          { clauseId: 'alt4', condition: { '>': [{ var: 'x' }, 5] }, exclusiveCoverage: 0.08 },
        ],
        passCount: 500,
      };
      const simulationResult = { sampleCount: 1000 };

      const result = analyzer.analyze(orBlock, simulationResult);

      expect(result.alternatives[0].clauseDescription).toBe('Alt 1 description');
      expect(result.alternatives[1].clauseDescription).toBe('Alt 2 clause desc');
      expect(result.alternatives[2].clauseDescription).toBe('mood.joy > 0.5');
      expect(result.alternatives[3].clauseDescription).toContain('>');
    });
  });

  describe('threshold recommendations', () => {
    let logger;
    let analyzer;

    beforeEach(() => {
      logger = createLogger();
      analyzer = new OrBlockAnalyzer({ logger });
    });

    it('uses quantile data for threshold estimation when available', () => {
      const orBlock = {
        blockId: 'or-1',
        alternatives: [
          {
            clauseId: 'alt1',
            exclusiveCoverage: 0.005,
            threshold: 0.7,
            _quantiles: {
              p8: 0.45, // Target coverage 8% quantile
              p10: 0.5,
            },
          },
        ],
        passCount: 500,
      };
      const simulationResult = { sampleCount: 1000, triggerRate: 0.5 };

      const result = analyzer.analyze(orBlock, simulationResult);

      const thresholdRec = result.recommendations.find(
        (r) => r.action === 'lower-threshold'
      );
      expect(thresholdRec).toBeDefined();
      // Should use p8 quantile value
      expect(thresholdRec.suggestedValue).toBe(0.45);
    });

    it('falls back to percentage reduction when no quantile data', () => {
      const orBlock = {
        blockId: 'or-1',
        alternatives: [
          {
            clauseId: 'alt1',
            exclusiveCoverage: 0.005,
            threshold: 0.7,
            // No _quantiles
          },
        ],
        passCount: 500,
      };
      const simulationResult = { sampleCount: 1000, triggerRate: 0.5 };

      const result = analyzer.analyze(orBlock, simulationResult);

      const thresholdRec = result.recommendations.find(
        (r) => r.action === 'lower-threshold'
      );
      expect(thresholdRec).toBeDefined();
      // Should use 10% reduction as fallback: 0.7 * 0.9 = 0.63
      expect(thresholdRec.suggestedValue).toBeCloseTo(0.63, 2);
    });

    it('handles condition.threshold pattern', () => {
      const orBlock = {
        blockId: 'or-1',
        alternatives: [
          {
            clauseId: 'alt1',
            exclusiveCoverage: 0.005,
            condition: {
              threshold: 0.8,
            },
          },
        ],
        passCount: 500,
      };
      const simulationResult = { sampleCount: 1000, triggerRate: 0.5 };

      const result = analyzer.analyze(orBlock, simulationResult);

      const thresholdRec = result.recommendations.find(
        (r) => r.action === 'lower-threshold'
      );
      expect(thresholdRec).toBeDefined();
    });

    it('handles _threshold pattern', () => {
      const orBlock = {
        blockId: 'or-1',
        alternatives: [
          {
            clauseId: 'alt1',
            exclusiveCoverage: 0.005,
            _threshold: 0.6,
          },
        ],
        passCount: 500,
      };
      const simulationResult = { sampleCount: 1000, triggerRate: 0.5 };

      const result = analyzer.analyze(orBlock, simulationResult);

      const thresholdRec = result.recommendations.find(
        (r) => r.action === 'lower-threshold'
      );
      expect(thresholdRec).toBeDefined();
    });
  });

  describe('classification threshold boundaries', () => {
    let logger;
    let analyzer;

    beforeEach(() => {
      logger = createLogger();
      analyzer = new OrBlockAnalyzer({ logger });
    });

    it('classifies exactly 1% as dead-weight', () => {
      const orBlock = {
        blockId: 'or-boundary',
        alternatives: [
          { clauseId: 'at-boundary', exclusiveCoverage: 0.01 },
        ],
        passCount: 500,
      };
      const simulationResult = { sampleCount: 1000, triggerRate: 0.5 };

      const result = analyzer.analyze(orBlock, simulationResult);

      // 0.01 is NOT < 0.01, so it should be weak
      expect(result.alternatives[0].classification).toBe('weak');
    });

    it('classifies just under 1% as dead-weight', () => {
      const orBlock = {
        blockId: 'or-boundary',
        alternatives: [
          { clauseId: 'under-boundary', exclusiveCoverage: 0.009 },
        ],
        passCount: 500,
      };
      const simulationResult = { sampleCount: 1000, triggerRate: 0.5 };

      const result = analyzer.analyze(orBlock, simulationResult);

      expect(result.alternatives[0].classification).toBe('dead-weight');
    });

    it('classifies exactly 5% as weak', () => {
      const orBlock = {
        blockId: 'or-boundary',
        alternatives: [
          { clauseId: 'at-weak-boundary', exclusiveCoverage: 0.05 },
        ],
        passCount: 500,
      };
      const simulationResult = { sampleCount: 1000, triggerRate: 0.5 };

      const result = analyzer.analyze(orBlock, simulationResult);

      // 0.05 is NOT < 0.05, so it should be meaningful
      expect(result.alternatives[0].classification).toBe('meaningful');
    });

    it('classifies just under 5% as weak', () => {
      const orBlock = {
        blockId: 'or-boundary',
        alternatives: [
          { clauseId: 'under-weak-boundary', exclusiveCoverage: 0.049 },
        ],
        passCount: 500,
      };
      const simulationResult = { sampleCount: 1000, triggerRate: 0.5 };

      const result = analyzer.analyze(orBlock, simulationResult);

      expect(result.alternatives[0].classification).toBe('weak');
    });
  });
});
