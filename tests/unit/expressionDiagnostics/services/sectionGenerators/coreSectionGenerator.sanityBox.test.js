/**
 * @file Unit tests for CoreSectionGenerator sanity box section
 *
 * Tests generateSanityBoxSection and related classification methods:
 * - Section generation with naive probability and Poisson statistics
 * - Leaf pass rate extraction from hierarchical blockers
 * - Sanity result classification (expected_rare, unexpected_zero, etc.)
 * - Edge cases (empty blockers, zero hits, OR blocks)
 * @see replicated-riding-lerdorf.md (Expected Trigger Rate Sanity Box plan)
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import CoreSectionGenerator from '../../../../../src/expressionDiagnostics/services/sectionGenerators/CoreSectionGenerator.js';
import ReportFormattingService from '../../../../../src/expressionDiagnostics/services/ReportFormattingService.js';
import StatisticalComputationService from '../../../../../src/expressionDiagnostics/services/StatisticalComputationService.js';

const createGenerator = (overrides = {}) => {
  const formattingService =
    overrides.formattingService ?? new ReportFormattingService();
  const witnessFormatter = overrides.witnessFormatter ?? {
    formatWitness: () => 'WITNESS',
  };
  const statisticalService =
    overrides.statisticalService ?? new StatisticalComputationService();
  const dataExtractor = overrides.dataExtractor ?? {
    getLowestCoverageVariables: (variables) => variables,
  };

  return new CoreSectionGenerator({
    formattingService,
    witnessFormatter,
    statisticalService,
    dataExtractor,
    ...overrides,
  });
};

describe('CoreSectionGenerator - Sanity Box Section', () => {
  let generator;

  beforeEach(() => {
    generator = createGenerator();
  });

  // ===========================================================================
  // generateSanityBoxSection - Basic functionality
  // ===========================================================================

  describe('generateSanityBoxSection', () => {
    it('should return empty string for missing simulation result', () => {
      const section = generator.generateSanityBoxSection(null, []);

      expect(section).toBe('');
    });

    it('should return empty string for undefined simulation result', () => {
      const section = generator.generateSanityBoxSection(undefined, []);

      expect(section).toBe('');
    });

    it('should return empty string for missing blockers', () => {
      const simulationResult = { triggerCount: 0, sampleCount: 100000 };
      const section = generator.generateSanityBoxSection(
        simulationResult,
        null
      );

      expect(section).toBe('');
    });

    it('should include section header', () => {
      const simulationResult = { triggerCount: 0, sampleCount: 100000 };
      const blockers = {
        nodeType: 'and',
        children: [
          { nodeType: 'leaf', clauseId: 'clause1', inRegimePassRate: 0.5 },
        ],
      };

      const section = generator.generateSanityBoxSection(
        simulationResult,
        blockers
      );

      expect(section).toContain('## Independence Baseline Comparison');
    });

    it('should include naive probability in output', () => {
      const simulationResult = { triggerCount: 0, sampleCount: 100000 };
      const blockers = {
        nodeType: 'and',
        children: [
          { nodeType: 'leaf', clauseId: 'clause1', inRegimePassRate: 0.5 },
          { nodeType: 'leaf', clauseId: 'clause2', inRegimePassRate: 0.5 },
        ],
      };

      const section = generator.generateSanityBoxSection(
        simulationResult,
        blockers
      );

      expect(section).toContain('Naive probability');
    });

    it('should include expected hits calculation', () => {
      const simulationResult = { triggerCount: 0, sampleCount: 100000 };
      const blockers = {
        nodeType: 'and',
        children: [
          { nodeType: 'leaf', clauseId: 'clause1', inRegimePassRate: 0.01 },
        ],
      };

      const section = generator.generateSanityBoxSection(
        simulationResult,
        blockers
      );

      expect(section).toContain('Expected hits');
      expect(section).toContain('100,000'); // formatted sample count
    });

    it('should include P(0 hits) calculation', () => {
      const simulationResult = { triggerCount: 0, sampleCount: 100000 };
      const blockers = {
        nodeType: 'and',
        children: [
          { nodeType: 'leaf', clauseId: 'clause1', inRegimePassRate: 0.001 },
        ],
      };

      const section = generator.generateSanityBoxSection(
        simulationResult,
        blockers
      );

      expect(section).toContain('P(0 hits');
    });

    it('should include actual hits count', () => {
      const simulationResult = { triggerCount: 5, sampleCount: 100000 };
      const blockers = {
        nodeType: 'and',
        children: [
          { nodeType: 'leaf', clauseId: 'clause1', inRegimePassRate: 0.5 },
        ],
      };

      const section = generator.generateSanityBoxSection(
        simulationResult,
        blockers
      );

      expect(section).toContain('| Actual hits |');
      expect(section).toContain('| 5 |');
    });

    it('should include interpretation section', () => {
      const simulationResult = { triggerCount: 0, sampleCount: 100000 };
      const blockers = {
        nodeType: 'and',
        children: [
          { nodeType: 'leaf', clauseId: 'clause1', inRegimePassRate: 0.5 },
        ],
      };

      const section = generator.generateSanityBoxSection(
        simulationResult,
        blockers
      );

      expect(section).toContain('### Interpretation');
    });
  });

  // ===========================================================================
  // Classification tests
  // ===========================================================================

  describe('sanity result classification', () => {
    it('should show expected_rare status for very low expected hits', () => {
      const simulationResult = { triggerCount: 0, sampleCount: 100000 };
      // With pass rate of 0.00001, expected hits = 1
      // With pass rate of 0.000001, expected hits = 0.1 < 1
      const blockers = {
        nodeType: 'and',
        children: [
          {
            nodeType: 'leaf',
            clauseId: 'rare_clause',
            inRegimePassRate: 0.000001,
          },
        ],
      };

      const section = generator.generateSanityBoxSection(
        simulationResult,
        blockers
      );

      expect(section).toContain('Expected Rare');
      expect(section).toContain('mathematically expected');
    });

    it('should show unexpected_zero status when 0 hits is surprising', () => {
      const simulationResult = { triggerCount: 0, sampleCount: 100000 };
      // With pass rate of 0.5, expected hits = 50000 >> 5
      // P(0 hits | expected 50000) ≈ 0, very surprising
      const blockers = {
        nodeType: 'and',
        children: [
          { nodeType: 'leaf', clauseId: 'common_clause', inRegimePassRate: 0.5 },
        ],
      };

      const section = generator.generateSanityBoxSection(
        simulationResult,
        blockers
      );

      expect(section).toContain('Unexpected Zero');
    });

    it('should show statistically_plausible for borderline cases', () => {
      const simulationResult = { triggerCount: 0, sampleCount: 100000 };
      // Need expected hits such that P(0 hits) > 5%
      // e^(-λ) > 0.05 means λ < ln(20) ≈ 3
      // Pass rate = 0.00002 gives expected = 2
      const blockers = {
        nodeType: 'and',
        children: [
          {
            nodeType: 'leaf',
            clauseId: 'borderline_clause',
            inRegimePassRate: 0.00002,
          },
        ],
      };

      const section = generator.generateSanityBoxSection(
        simulationResult,
        blockers
      );

      expect(section).toContain('Statistically Plausible');
    });

    it('should show normal status when actual hits match expected', () => {
      const simulationResult = { triggerCount: 50000, sampleCount: 100000 };
      const blockers = {
        nodeType: 'and',
        children: [
          {
            nodeType: 'leaf',
            clauseId: 'normal_clause',
            inRegimePassRate: 0.5,
          },
        ],
      };

      const section = generator.generateSanityBoxSection(
        simulationResult,
        blockers
      );

      expect(section).toContain('Normal');
      expect(section).toContain('align');
    });
  });

  // ===========================================================================
  // Leaf extraction tests
  // ===========================================================================

  describe('leaf pass rate extraction', () => {
    it('should extract leaf nodes from simple AND tree', () => {
      const simulationResult = { triggerCount: 0, sampleCount: 100 };
      const blockers = {
        nodeType: 'and',
        children: [
          { nodeType: 'leaf', clauseId: 'a', inRegimePassRate: 0.8 },
          { nodeType: 'leaf', clauseId: 'b', inRegimePassRate: 0.9 },
        ],
      };

      const section = generator.generateSanityBoxSection(
        simulationResult,
        blockers
      );

      // Should include clause factor breakdown
      expect(section).toContain('Clause Pass Rate Factors');
      expect(section).toContain('| a |');
      expect(section).toContain('| b |');
    });

    it('should handle nested AND blocks', () => {
      const simulationResult = { triggerCount: 0, sampleCount: 100 };
      const blockers = {
        nodeType: 'and',
        children: [
          {
            nodeType: 'and',
            children: [
              { nodeType: 'leaf', clauseId: 'nested1', inRegimePassRate: 0.7 },
            ],
          },
          { nodeType: 'leaf', clauseId: 'top_level', inRegimePassRate: 0.8 },
        ],
      };

      const section = generator.generateSanityBoxSection(
        simulationResult,
        blockers
      );

      expect(section).toContain('nested1');
      expect(section).toContain('top_level');
    });

    it('should handle OR blocks as single factor using union pass rate', () => {
      const simulationResult = { triggerCount: 0, sampleCount: 100 };
      const blockers = {
        nodeType: 'and',
        children: [
          {
            nodeType: 'or',
            id: 'mood_or_block',
            orUnionPassCount: 80,
            inRegimeEvaluationCount: 100,
            children: [
              { nodeType: 'leaf', clauseId: 'or_a', inRegimePassRate: 0.5 },
              { nodeType: 'leaf', clauseId: 'or_b', inRegimePassRate: 0.5 },
            ],
          },
        ],
      };

      const section = generator.generateSanityBoxSection(
        simulationResult,
        blockers
      );

      expect(section).toContain('OR Block');
    });

    it('should handle empty blockers tree', () => {
      const simulationResult = { triggerCount: 0, sampleCount: 100 };
      const blockers = { nodeType: 'and', children: [] };

      const section = generator.generateSanityBoxSection(
        simulationResult,
        blockers
      );

      // Should still generate section but with warning
      expect(section).toContain('## Independence Baseline Comparison');
    });

    it('should handle blockers with missing pass rate data', () => {
      const simulationResult = { triggerCount: 0, sampleCount: 100 };
      const blockers = {
        nodeType: 'and',
        children: [
          {
            nodeType: 'leaf',
            clauseId: 'no_rate',
            // no inRegimePassRate, no passRate, no failureRate
          },
        ],
      };

      const section = generator.generateSanityBoxSection(
        simulationResult,
        blockers
      );

      // Should use fallback rate of 1.0 (1 - 0)
      expect(section).toContain('## Independence Baseline Comparison');
    });

    it('should use description as clauseId when clauseId is missing', () => {
      const simulationResult = { triggerCount: 0, sampleCount: 100 };
      const blockers = {
        nodeType: 'and',
        children: [
          {
            nodeType: 'leaf',
            description: 'Custom description',
            inRegimePassRate: 0.5,
          },
        ],
      };

      const section = generator.generateSanityBoxSection(
        simulationResult,
        blockers
      );

      expect(section).toContain('Custom description');
    });
  });

  // ===========================================================================
  // Edge cases
  // ===========================================================================

  describe('edge cases', () => {
    it('should return empty string for sampleCount of 0', () => {
      const simulationResult = { triggerCount: 0, sampleCount: 0 };
      const blockers = {
        nodeType: 'and',
        children: [
          { nodeType: 'leaf', clauseId: 'clause1', inRegimePassRate: 0.5 },
        ],
      };

      const section = generator.generateSanityBoxSection(
        simulationResult,
        blockers
      );

      // No meaningful calculation can be done without samples
      expect(section).toBe('');
    });

    it('should handle very large sample counts', () => {
      const simulationResult = { triggerCount: 1000, sampleCount: 1000000 };
      const blockers = {
        nodeType: 'and',
        children: [
          { nodeType: 'leaf', clauseId: 'clause1', inRegimePassRate: 0.001 },
        ],
      };

      const section = generator.generateSanityBoxSection(
        simulationResult,
        blockers
      );

      expect(section).toContain('1,000,000');
    });

    it('should hide factor breakdown when too many clauses', () => {
      const simulationResult = { triggerCount: 0, sampleCount: 100 };
      const children = Array.from({ length: 20 }, (_, i) => ({
        nodeType: 'leaf',
        clauseId: `clause${i}`,
        inRegimePassRate: 0.9,
      }));
      const blockers = { nodeType: 'and', children };

      const section = generator.generateSanityBoxSection(
        simulationResult,
        blockers
      );

      // Factor breakdown should be omitted for > 15 clauses
      expect(section).not.toContain('Clause Pass Rate Factors');
    });

    it('should include warnings for zero-rate clauses', () => {
      const simulationResult = { triggerCount: 0, sampleCount: 100 };
      const blockers = {
        nodeType: 'and',
        children: [
          {
            nodeType: 'leaf',
            clauseId: 'blocking_clause',
            inRegimePassRate: 0,
          },
        ],
      };

      const section = generator.generateSanityBoxSection(
        simulationResult,
        blockers
      );

      expect(section).toContain('Warnings');
      expect(section).toContain('0% pass rate');
    });

    it('should handle single leaf node (no children array)', () => {
      const simulationResult = { triggerCount: 0, sampleCount: 100 };
      const blockers = {
        nodeType: 'leaf',
        clauseId: 'single_clause',
        inRegimePassRate: 0.5,
      };

      const section = generator.generateSanityBoxSection(
        simulationResult,
        blockers
      );

      expect(section).toContain('## Independence Baseline Comparison');
    });
  });
});
