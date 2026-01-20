/**
 * @file Unit tests for CoreSectionGenerator bug fixes
 *
 * Tests for specific bug fixes in sanity check section:
 * - Claim A: Large deviation detection (actual << expected or actual >> expected)
 * - Claim B: OR block domain mismatch (using global vs in-regime counts)
 * - Claim E: Section naming (Independence Baseline vs Sanity Check)
 * @see brainstorming/monte-carlo-bugs.md (ChatGPT analysis document)
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

describe('CoreSectionGenerator - Bug Fixes', () => {
  let generator;

  beforeEach(() => {
    generator = createGenerator();
  });

  // ===========================================================================
  // Claim A: Large deviation detection
  // Bug: "normal" status returned when actual = 66 but expected = 19771.77
  // The code had no ratio-based check for non-zero actual hits
  // ===========================================================================

  describe('Claim A: large deviation detection', () => {
    it('should detect large_deviation when actual << expected (ratio < 0.01)', () => {
      // expected = 50000, actual = 100 → ratio = 0.002 → large_deviation
      const simulationResult = { triggerCount: 100, sampleCount: 100000 };
      const blockers = {
        nodeType: 'and',
        children: [
          {
            nodeType: 'leaf',
            clauseId: 'high_pass_clause',
            inRegimePassRate: 0.5,
          },
        ],
      };

      const section = generator.generateSanityBoxSection(
        simulationResult,
        blockers
      );

      // Should NOT show "Normal" - ratio = 100/50000 = 0.002
      expect(section).not.toContain('✅ **Normal**');
      expect(section).toContain('Large Deviation');
    });

    it('should detect large_deviation when actual >> expected (ratio > 100)', () => {
      // expected = 100, actual = 50000 → ratio = 500 → large_deviation
      const simulationResult = { triggerCount: 50000, sampleCount: 100000 };
      const blockers = {
        nodeType: 'and',
        children: [
          {
            nodeType: 'leaf',
            clauseId: 'low_pass_clause',
            inRegimePassRate: 0.001,
          },
        ],
      };

      const section = generator.generateSanityBoxSection(
        simulationResult,
        blockers
      );

      // Should NOT show "Normal" - ratio = 50000/100 = 500
      expect(section).not.toContain('✅ **Normal**');
      expect(section).toContain('Large Deviation');
    });

    it('should preserve normal status when ratio is within reasonable bounds', () => {
      // expected ≈ 50000, actual = 50000 → ratio ≈ 1.0 → normal
      const simulationResult = { triggerCount: 50000, sampleCount: 100000 };
      const blockers = {
        nodeType: 'and',
        children: [
          {
            nodeType: 'leaf',
            clauseId: 'matching_clause',
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

    it('should reproduce the actual bug case: expected=19771, actual=66', () => {
      // The bug report showed: expected = 19771.77, actual = 66
      // With 100k samples and pass rate 0.1977177, expected ≈ 19772
      const simulationResult = { triggerCount: 66, sampleCount: 100000 };
      const blockers = {
        nodeType: 'and',
        children: [
          {
            nodeType: 'leaf',
            clauseId: 'mood_clause',
            inRegimePassRate: 0.1977177,
          },
        ],
      };

      const section = generator.generateSanityBoxSection(
        simulationResult,
        blockers
      );

      // ratio = 66/19771.77 = 0.0033 → should NOT be "Normal"
      expect(section).not.toContain('✅ **Normal**');
      expect(section).toContain('Large Deviation');
    });

    it('should accept 10x deviation as within normal bounds', () => {
      // expected = 10000, actual = 5000 → ratio = 0.5 (within 0.01-100)
      const simulationResult = { triggerCount: 5000, sampleCount: 100000 };
      const blockers = {
        nodeType: 'and',
        children: [
          {
            nodeType: 'leaf',
            clauseId: 'clause_with_variance',
            inRegimePassRate: 0.1,
          },
        ],
      };

      const section = generator.generateSanityBoxSection(
        simulationResult,
        blockers
      );

      // ratio = 0.5, which is within normal bounds
      expect(section).toContain('Normal');
    });
  });

  // ===========================================================================
  // Claim B: OR block domain mismatch
  // Bug: OR block pass rates > 100% due to using global orUnionPassCount
  // with in-regime denominator (inRegimeEvaluationCount)
  // ===========================================================================

  describe('Claim B: OR block domain mismatch', () => {
    it('should use orUnionPassInRegimeCount when available', () => {
      const simulationResult = { triggerCount: 80, sampleCount: 100 };
      const blockers = {
        nodeType: 'and',
        children: [
          {
            nodeType: 'or',
            id: 'mood_or_block',
            // In-regime counts (preferred)
            orUnionPassInRegimeCount: 80,
            inRegimeEvaluationCount: 100,
            // Global counts (should be ignored when in-regime available)
            orUnionPassCount: 90000,
            evaluationCount: 100000,
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

      // Pass rate should be 80/100 = 0.8 = 80%, NOT 90000/100 = 900%
      expect(section).toContain('OR Block');
      expect(section).toContain('80.00%');
      expect(section).not.toContain('900');
      expect(section).not.toContain('9000');
    });

    it('should clamp legacy calculation to valid probability range', () => {
      const simulationResult = { triggerCount: 50, sampleCount: 100 };
      const blockers = {
        nodeType: 'and',
        children: [
          {
            nodeType: 'or',
            id: 'legacy_or_block',
            // Only legacy counts available (domain mismatch scenario)
            orUnionPassCount: 500, // Global pass count
            inRegimeEvaluationCount: 100, // In-regime evaluation count
            // No orUnionPassInRegimeCount
            children: [
              { nodeType: 'leaf', clauseId: 'or_a', inRegimePassRate: 0.5 },
            ],
          },
        ],
      };

      const section = generator.generateSanityBoxSection(
        simulationResult,
        blockers
      );

      // Without fix: 500/100 = 5.0 = 500%
      // With fix: should clamp to 100% maximum
      expect(section).toContain('OR Block');
      // Should NOT show >100% values
      expect(section).not.toMatch(/[2-9]\d{2,}\.\d{2}%/); // No 200+%
      expect(section).not.toMatch(/1[0-9]{3,}\.\d{2}%/); // No 1000+%
    });

    it('should calculate correct OR block pass rate from in-regime counts', () => {
      const simulationResult = { triggerCount: 25, sampleCount: 100 };
      const blockers = {
        nodeType: 'and',
        children: [
          {
            nodeType: 'or',
            id: '0.8',
            // In-regime counts only
            orUnionPassInRegimeCount: 80,
            inRegimeEvaluationCount: 100,
            children: [
              { nodeType: 'leaf', clauseId: 'or_a', inRegimePassRate: 0.6 },
              { nodeType: 'leaf', clauseId: 'or_b', inRegimePassRate: 0.6 },
            ],
          },
        ],
      };

      const section = generator.generateSanityBoxSection(
        simulationResult,
        blockers
      );

      // Pass rate = 80/100 = 0.8 = 80%
      expect(section).toContain('80.00%');
    });
  });

  // ===========================================================================
  // Claim E: Section naming
  // Issue: "Sanity Check" implies correctness validation
  // Should be "Independence Baseline Comparison" to clarify purpose
  // ===========================================================================

  describe('Claim E: section naming', () => {
    it('should use "Independence Baseline" instead of "Sanity Check"', () => {
      const simulationResult = { triggerCount: 50, sampleCount: 100 };
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

      expect(section).toContain('Independence Baseline');
      expect(section).not.toContain('Sanity Check');
    });
  });

  // ===========================================================================
  // Claim C: Column header conditioning clarification
  // Issue: "Pass Rate" column should indicate it's conditioned on mood regime
  // ===========================================================================

  describe('Claim C: column header conditioning', () => {
    it('should include conditioning indicator in pass rate column header', () => {
      const simulationResult = { triggerCount: 50, sampleCount: 100 };
      const blockers = {
        nodeType: 'and',
        children: [
          { nodeType: 'leaf', clauseId: 'clause1', inRegimePassRate: 0.5 },
          { nodeType: 'leaf', clauseId: 'clause2', inRegimePassRate: 0.6 },
        ],
      };

      const section = generator.generateSanityBoxSection(
        simulationResult,
        blockers
      );

      // Should indicate conditioning (e.g., "in-regime" or similar)
      expect(section).toMatch(/Pass Rate.*\(.*regime.*\)/i);
    });
  });
});

describe('ReportFormattingService - Bug Fix Status Formatters', () => {
  let service;

  beforeEach(() => {
    service = new ReportFormattingService();
  });

  describe('formatSanityStatus', () => {
    it('should format large_deviation status', () => {
      const result = service.formatSanityStatus('large_deviation');

      expect(result).toContain('Large Deviation');
      // Warning indicator (⚠️)
      expect(result).toContain('⚠️');
    });

    it('should format data_inconsistency status', () => {
      const result = service.formatSanityStatus('data_inconsistency');

      expect(result).toContain('Data Inconsistency');
      // Error indicator (❌)
      expect(result).toContain('❌');
    });

    it('should preserve existing status formatting', () => {
      expect(service.formatSanityStatus('expected_rare')).toContain(
        'Expected Rare'
      );
      expect(service.formatSanityStatus('statistically_plausible')).toContain(
        'Statistically Plausible'
      );
      expect(service.formatSanityStatus('unexpected_zero')).toContain(
        'Unexpected Zero'
      );
      expect(service.formatSanityStatus('normal')).toContain('Normal');
    });
  });
});
