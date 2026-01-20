/**
 * @file Unit tests for NonAxisFeasibilitySectionGenerator
 */

import { describe, it, expect, jest } from '@jest/globals';
import NonAxisFeasibilitySectionGenerator from '../../../../../src/expressionDiagnostics/services/sectionGenerators/NonAxisFeasibilitySectionGenerator.js';
import { createNonAxisClauseFeasibility } from '../../../../../src/expressionDiagnostics/models/NonAxisClauseFeasibility.js';

describe('NonAxisFeasibilitySectionGenerator', () => {
  // ─────────────────────────────────────────────────────────────────────────
  // Construction tests
  // ─────────────────────────────────────────────────────────────────────────

  describe('construction', () => {
    it('constructs without options', () => {
      expect(() => new NonAxisFeasibilitySectionGenerator()).not.toThrow();
    });

    it('constructs with empty options object', () => {
      expect(() => new NonAxisFeasibilitySectionGenerator({})).not.toThrow();
    });

    it('constructs with logger', () => {
      const logger = { debug: jest.fn() };
      expect(
        () => new NonAxisFeasibilitySectionGenerator({ logger })
      ).not.toThrow();
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Empty input tests
  // ─────────────────────────────────────────────────────────────────────────

  describe('empty input handling', () => {
    it('returns appropriate message for null input', () => {
      const generator = new NonAxisFeasibilitySectionGenerator();
      const result = generator.generate(null);

      expect(result).toContain('## Non-Axis Clause Feasibility');
      expect(result).toContain('No non-axis clauses found in prerequisites.');
    });

    it('returns appropriate message for undefined input', () => {
      const generator = new NonAxisFeasibilitySectionGenerator();
      const result = generator.generate(undefined);

      expect(result).toContain('No non-axis clauses found in prerequisites.');
    });

    it('returns appropriate message for empty array', () => {
      const generator = new NonAxisFeasibilitySectionGenerator();
      const result = generator.generate([]);

      expect(result).toContain('No non-axis clauses found in prerequisites.');
    });

    it('includes scope metadata header even for empty input', () => {
      const generator = new NonAxisFeasibilitySectionGenerator();
      const result = generator.generate(null);

      expect(result).toContain('[NON-AXIS ONLY]');
      expect(result).toContain('[IN-REGIME]');
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Scope metadata tests
  // ─────────────────────────────────────────────────────────────────────────

  describe('scope metadata badges', () => {
    it('includes NON-AXIS ONLY badge in header', () => {
      const generator = new NonAxisFeasibilitySectionGenerator();
      const result = createValidResult();
      const output = generator.generate([result]);

      expect(output).toContain('[NON-AXIS ONLY]');
    });

    it('includes IN-REGIME badge in header', () => {
      const generator = new NonAxisFeasibilitySectionGenerator();
      const result = createValidResult();
      const output = generator.generate([result]);

      expect(output).toContain('[IN-REGIME]');
    });

    it('includes description in scope metadata', () => {
      const generator = new NonAxisFeasibilitySectionGenerator();
      const result = createValidResult();
      const output = generator.generate([result]);

      expect(output).toContain(
        'Evaluates emotion/sexual/delta clauses within mood-regime using final values.'
      );
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Population display tests
  // ─────────────────────────────────────────────────────────────────────────

  describe('population display', () => {
    it('displays sample count with locale formatting', () => {
      const generator = new NonAxisFeasibilitySectionGenerator();
      const result = createValidResult();
      const output = generator.generate([result], 1500);

      expect(output).toContain('**Population**: 1,500 in-regime samples analyzed');
    });

    it('handles zero sample count', () => {
      const generator = new NonAxisFeasibilitySectionGenerator();
      const result = createValidResult();
      const output = generator.generate([result], 0);

      expect(output).toContain('**Population**: 0 in-regime samples analyzed');
    });

    it('formats large numbers with locale separators', () => {
      const generator = new NonAxisFeasibilitySectionGenerator();
      const result = createValidResult();
      const output = generator.generate([result], 1234567);

      expect(output).toContain('1,234,567');
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Table structure tests
  // ─────────────────────────────────────────────────────────────────────────

  describe('table structure', () => {
    it('includes correct table headers', () => {
      const generator = new NonAxisFeasibilitySectionGenerator();
      const result = createValidResult();
      const output = generator.generate([result]);

      expect(output).toContain(
        '| Variable | Clause | Pass Rate | Max Value | Classification |'
      );
    });

    it('includes table separator row', () => {
      const generator = new NonAxisFeasibilitySectionGenerator();
      const result = createValidResult();
      const output = generator.generate([result]);

      expect(output).toContain(
        '|----------|--------|-----------|-----------|----------------|'
      );
    });

    it('wraps variable path in code spans', () => {
      const generator = new NonAxisFeasibilitySectionGenerator();
      const result = createNonAxisClauseFeasibility({
        clauseId: 'test_clause',
        varPath: 'emotions.confusion',
        threshold: 0.5,
        classification: 'OK',
      });
      const output = generator.generate([result]);

      expect(output).toContain('| `emotions.confusion`');
    });

    it('renders multiple rows for multiple results', () => {
      const generator = new NonAxisFeasibilitySectionGenerator();
      const results = [
        createNonAxisClauseFeasibility({
          clauseId: 'clause_1',
          varPath: 'emotions.joy',
          threshold: 0.3,
          classification: 'OK',
        }),
        createNonAxisClauseFeasibility({
          clauseId: 'clause_2',
          varPath: 'emotions.anger',
          threshold: 0.7,
          classification: 'IMPOSSIBLE',
        }),
      ];
      const output = generator.generate(results);

      expect(output).toContain('`emotions.joy`');
      expect(output).toContain('`emotions.anger`');
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Classification emoji tests
  // ─────────────────────────────────────────────────────────────────────────

  describe('classification emojis', () => {
    it('uses ⛔ emoji for IMPOSSIBLE classification', () => {
      const generator = new NonAxisFeasibilitySectionGenerator();
      const result = createNonAxisClauseFeasibility({
        clauseId: 'test_clause',
        varPath: 'emotions.anger',
        threshold: 0.9,
        classification: 'IMPOSSIBLE',
        passRate: 0,
        maxValue: 0.4,
      });
      const output = generator.generate([result]);

      expect(output).toContain('⛔ IMPOSSIBLE');
    });

    it('uses ⚠️ emoji for RARE classification', () => {
      const generator = new NonAxisFeasibilitySectionGenerator();
      const result = createNonAxisClauseFeasibility({
        clauseId: 'test_clause',
        varPath: 'emotions.fear',
        threshold: 0.8,
        classification: 'RARE',
        passRate: 0.0005,
        maxValue: 0.85,
      });
      const output = generator.generate([result]);

      expect(output).toContain('⚠️ RARE');
    });

    it('uses ✅ emoji for OK classification', () => {
      const generator = new NonAxisFeasibilitySectionGenerator();
      const result = createNonAxisClauseFeasibility({
        clauseId: 'test_clause',
        varPath: 'emotions.joy',
        threshold: 0.3,
        classification: 'OK',
        passRate: 0.25,
        maxValue: 0.9,
      });
      const output = generator.generate([result]);

      expect(output).toContain('✅ OK');
    });

    it('uses ❓ emoji for UNKNOWN classification', () => {
      const generator = new NonAxisFeasibilitySectionGenerator();
      const result = createNonAxisClauseFeasibility({
        clauseId: 'test_clause',
        varPath: 'emotions.sadness',
        threshold: 0.5,
        classification: 'UNKNOWN',
      });
      const output = generator.generate([result]);

      expect(output).toContain('❓ UNKNOWN');
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Number formatting tests
  // ─────────────────────────────────────────────────────────────────────────

  describe('number formatting', () => {
    it('formats pass rate as percentage with 1 decimal', () => {
      const generator = new NonAxisFeasibilitySectionGenerator();
      const result = createNonAxisClauseFeasibility({
        clauseId: 'test_clause',
        varPath: 'emotions.joy',
        threshold: 0.5,
        classification: 'OK',
        passRate: 0.2567,
      });
      const output = generator.generate([result]);

      expect(output).toContain('25.7%');
    });

    it('formats values with 3 decimal places', () => {
      const generator = new NonAxisFeasibilitySectionGenerator();
      const result = createNonAxisClauseFeasibility({
        clauseId: 'test_clause',
        varPath: 'emotions.joy',
        threshold: 0.567891,
        classification: 'OK',
        maxValue: 0.892345,
      });
      const output = generator.generate([result]);

      expect(output).toContain('0.568'); // threshold in clause column
      expect(output).toContain('0.892'); // maxValue column
    });

    it('displays N/A for null passRate', () => {
      const generator = new NonAxisFeasibilitySectionGenerator();
      const result = createNonAxisClauseFeasibility({
        clauseId: 'test_clause',
        varPath: 'emotions.joy',
        threshold: 0.5,
        classification: 'UNKNOWN',
        passRate: null,
      });
      const output = generator.generate([result]);

      // passRate column should show N/A
      expect(output).toMatch(/\| N\/A \|/);
    });

    it('displays N/A for null maxValue', () => {
      const generator = new NonAxisFeasibilitySectionGenerator();
      const result = createNonAxisClauseFeasibility({
        clauseId: 'test_clause',
        varPath: 'emotions.joy',
        threshold: 0.5,
        classification: 'UNKNOWN',
        maxValue: null,
      });
      const output = generator.generate([result]);

      // maxValue column should show N/A
      const lines = output.split('\n');
      const dataRow = lines.find((line) => line.includes('`emotions.joy`'));
      expect(dataRow).toContain('| N/A |');
    });

    it('formats 0% pass rate correctly', () => {
      const generator = new NonAxisFeasibilitySectionGenerator();
      const result = createNonAxisClauseFeasibility({
        clauseId: 'test_clause',
        varPath: 'emotions.anger',
        threshold: 0.9,
        classification: 'IMPOSSIBLE',
        passRate: 0,
      });
      const output = generator.generate([result]);

      expect(output).toContain('0.0%');
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Breakdown section tests
  // ─────────────────────────────────────────────────────────────────────────

  describe('breakdown sections', () => {
    it('generates IMPOSSIBLE breakdown section', () => {
      const generator = new NonAxisFeasibilitySectionGenerator();
      const result = createNonAxisClauseFeasibility({
        clauseId: 'clause_impossible_001',
        varPath: 'emotions.anger',
        threshold: 0.9,
        operator: '>=',
        classification: 'IMPOSSIBLE',
        passRate: 0,
        maxValue: 0.4,
        p95Value: 0.35,
        marginMax: -0.5,
        signal: 'final',
        evidence: {
          bestSampleRef: 'sample_42',
          note: 'Max value never reaches threshold',
        },
      });
      const output = generator.generate([result]);

      expect(output).toContain('### ⛔ IMPOSSIBLE Clauses');
      expect(output).toContain('#### `emotions.anger` >= 0.900');
      expect(output).toContain('- **Clause ID**: `clause_impossible_001`');
      expect(output).toContain('- **Pass Rate**: 0.0%');
      expect(output).toContain('- **Max Value**: 0.400');
      expect(output).toContain('- **P95 Value**: 0.350');
      expect(output).toContain('- **Margin (max - threshold)**: -0.500');
      expect(output).toContain('- **Signal**: final');
      expect(output).toContain('- **Note**: Max value never reaches threshold');
      expect(output).toContain('- **Best Sample**: `sample_42`');
    });

    it('generates RARE breakdown section', () => {
      const generator = new NonAxisFeasibilitySectionGenerator();
      const result = createNonAxisClauseFeasibility({
        clauseId: 'clause_rare_001',
        varPath: 'emotions.fear',
        threshold: 0.8,
        operator: '>=',
        classification: 'RARE',
        passRate: 0.0005,
        maxValue: 0.85,
        evidence: {
          note: 'Very few samples pass',
        },
      });
      const output = generator.generate([result]);

      expect(output).toContain('### ⚠️ RARE Clauses');
      expect(output).toContain('#### `emotions.fear` >= 0.800');
      expect(output).toContain('- **Clause ID**: `clause_rare_001`');
      expect(output).toContain('- **Note**: Very few samples pass');
    });

    it('includes clauseId in breakdown detail', () => {
      const generator = new NonAxisFeasibilitySectionGenerator();
      const result = createNonAxisClauseFeasibility({
        clauseId: 'unique_clause_hash_abc123',
        varPath: 'sexual.arousal',
        threshold: 0.7,
        classification: 'IMPOSSIBLE',
        passRate: 0,
        maxValue: 0.2,
      });
      const output = generator.generate([result]);

      expect(output).toContain('`unique_clause_hash_abc123`');
    });

    it('includes evidence note in breakdown when present', () => {
      const generator = new NonAxisFeasibilitySectionGenerator();
      const result = createNonAxisClauseFeasibility({
        clauseId: 'test_clause',
        varPath: 'emotions.anger',
        threshold: 0.9,
        classification: 'RARE',
        passRate: 0.0001,
        evidence: {
          note: 'Detailed explanation of why this is rare',
        },
      });
      const output = generator.generate([result]);

      expect(output).toContain('Detailed explanation of why this is rare');
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Edge case tests
  // ─────────────────────────────────────────────────────────────────────────

  describe('edge cases', () => {
    it('does not include breakdown when all results are OK', () => {
      const generator = new NonAxisFeasibilitySectionGenerator();
      const results = [
        createNonAxisClauseFeasibility({
          clauseId: 'clause_1',
          varPath: 'emotions.joy',
          threshold: 0.3,
          classification: 'OK',
          passRate: 0.5,
          maxValue: 0.9,
        }),
        createNonAxisClauseFeasibility({
          clauseId: 'clause_2',
          varPath: 'emotions.calm',
          threshold: 0.2,
          classification: 'OK',
          passRate: 0.7,
          maxValue: 0.95,
        }),
      ];
      const output = generator.generate(results);

      expect(output).not.toContain('### ⛔ IMPOSSIBLE Clauses');
      expect(output).not.toContain('### ⚠️ RARE Clauses');
    });

    it('handles mixed classifications with multiple breakdowns', () => {
      const generator = new NonAxisFeasibilitySectionGenerator();
      const results = [
        createNonAxisClauseFeasibility({
          clauseId: 'clause_ok',
          varPath: 'emotions.joy',
          threshold: 0.3,
          classification: 'OK',
          passRate: 0.5,
          maxValue: 0.9,
        }),
        createNonAxisClauseFeasibility({
          clauseId: 'clause_impossible',
          varPath: 'emotions.anger',
          threshold: 0.95,
          classification: 'IMPOSSIBLE',
          passRate: 0,
          maxValue: 0.4,
        }),
        createNonAxisClauseFeasibility({
          clauseId: 'clause_rare',
          varPath: 'emotions.fear',
          threshold: 0.8,
          classification: 'RARE',
          passRate: 0.0005,
          maxValue: 0.82,
        }),
      ];
      const output = generator.generate(results);

      expect(output).toContain('### ⛔ IMPOSSIBLE Clauses');
      expect(output).toContain('### ⚠️ RARE Clauses');
      expect(output).toContain('`clause_impossible`');
      expect(output).toContain('`clause_rare`');
    });

    it('handles single result correctly', () => {
      const generator = new NonAxisFeasibilitySectionGenerator();
      const result = createNonAxisClauseFeasibility({
        clauseId: 'single_clause',
        varPath: 'emotions.confusion',
        threshold: 0.6,
        classification: 'OK',
        passRate: 0.35,
        maxValue: 0.88,
      });
      const output = generator.generate([result]);

      expect(output).toContain('## Non-Axis Clause Feasibility');
      expect(output).toContain('`emotions.confusion`');
      expect(output).toContain('✅ OK');
    });

    it('handles different operators correctly', () => {
      const generator = new NonAxisFeasibilitySectionGenerator();
      const results = [
        createNonAxisClauseFeasibility({
          clauseId: 'clause_gte',
          varPath: 'emotions.joy',
          threshold: 0.3,
          operator: '>=',
          classification: 'OK',
        }),
        createNonAxisClauseFeasibility({
          clauseId: 'clause_lt',
          varPath: 'emotions.anger',
          threshold: 0.5,
          operator: '<',
          classification: 'OK',
        }),
        createNonAxisClauseFeasibility({
          clauseId: 'clause_eq',
          varPath: 'emotions.fear',
          threshold: 0.0,
          operator: '==',
          classification: 'OK',
        }),
      ];
      const output = generator.generate(results);

      expect(output).toContain('>= 0.300');
      expect(output).toContain('< 0.500');
      expect(output).toContain('== 0.000');
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Delta clause rendering tests (Bug A fix)
  // ─────────────────────────────────────────────────────────────────────────

  describe('delta clause rendering', () => {
    it('renders delta clauses with full delta expression format in table', () => {
      const generator = new NonAxisFeasibilitySectionGenerator();
      const result = createNonAxisClauseFeasibility({
        clauseId: 'delta_clause_001',
        varPath: 'emotions.remorse',
        threshold: 0.12,
        operator: '>=',
        classification: 'IMPOSSIBLE',
        passRate: 0,
        maxValue: 0.05,
        signal: 'delta',
      });
      const output = generator.generate([result]);

      // Should render as (current - previous) format, not just the varPath
      expect(output).toContain(
        '(emotions.remorse - previousEmotions.remorse) >= 0.120'
      );
      // Should NOT render as the misleading short format
      expect(output).not.toMatch(/\| >= 0\.120 \|/);
    });

    it('renders final clauses with simple format in table', () => {
      const generator = new NonAxisFeasibilitySectionGenerator();
      const result = createNonAxisClauseFeasibility({
        clauseId: 'final_clause_001',
        varPath: 'emotions.joy',
        threshold: 0.5,
        operator: '>=',
        classification: 'OK',
        passRate: 0.25,
        maxValue: 0.9,
        signal: 'final',
      });
      const output = generator.generate([result]);

      // Should render with simple operator and threshold
      expect(output).toContain('>= 0.500');
      // Should NOT include previousEmotions
      expect(output).not.toContain('previousEmotions');
    });

    it('renders delta clauses with full expression in breakdown section', () => {
      const generator = new NonAxisFeasibilitySectionGenerator();
      const result = createNonAxisClauseFeasibility({
        clauseId: 'delta_rare_001',
        varPath: 'sexual.arousal',
        threshold: 0.08,
        operator: '>=',
        classification: 'RARE',
        passRate: 0.0005,
        maxValue: 0.09,
        signal: 'delta',
      });
      const output = generator.generate([result]);

      // Breakdown section header should use delta format
      expect(output).toContain(
        '#### `(sexual.arousal - previousSexual.arousal)` >= 0.080'
      );
    });

    it('handles raw signal same as final signal', () => {
      const generator = new NonAxisFeasibilitySectionGenerator();
      const result = createNonAxisClauseFeasibility({
        clauseId: 'raw_clause_001',
        varPath: 'emotions.anger',
        threshold: 0.3,
        operator: '>=',
        classification: 'OK',
        passRate: 0.4,
        maxValue: 0.8,
        signal: 'raw',
      });
      const output = generator.generate([result]);

      // Raw signal should render without previousEmotions
      expect(output).not.toContain('previousEmotions');
      expect(output).toContain('>= 0.300');
    });

    it('correctly capitalizes nested path for previousEmotions', () => {
      const generator = new NonAxisFeasibilitySectionGenerator();
      const result = createNonAxisClauseFeasibility({
        clauseId: 'delta_nested_001',
        varPath: 'emotions.joy.intensity',
        threshold: 0.2,
        operator: '>=',
        classification: 'IMPOSSIBLE',
        passRate: 0,
        maxValue: 0.1,
        signal: 'delta',
      });
      const output = generator.generate([result]);

      // Should capitalize first segment correctly
      expect(output).toContain(
        '(emotions.joy.intensity - previousEmotions.joy.intensity) >= 0.200'
      );
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Logger integration tests
  // ─────────────────────────────────────────────────────────────────────────

  describe('logger integration', () => {
    it('calls logger.debug when generating with results', () => {
      const logger = { debug: jest.fn() };
      const generator = new NonAxisFeasibilitySectionGenerator({ logger });
      const result = createValidResult();

      generator.generate([result]);

      expect(logger.debug).toHaveBeenCalledWith(
        'NonAxisFeasibilitySectionGenerator: Generating section for 1 result(s)'
      );
    });

    it('reports correct count for multiple results', () => {
      const logger = { debug: jest.fn() };
      const generator = new NonAxisFeasibilitySectionGenerator({ logger });
      const results = [createValidResult(), createValidResult()];

      generator.generate(results);

      expect(logger.debug).toHaveBeenCalledWith(
        'NonAxisFeasibilitySectionGenerator: Generating section for 2 result(s)'
      );
    });

    it('does not throw when logger.debug is undefined', () => {
      const logger = { info: jest.fn() }; // No debug method
      const generator = new NonAxisFeasibilitySectionGenerator({ logger });
      const result = createValidResult();

      expect(() => generator.generate([result])).not.toThrow();
    });

    it('does not call logger for empty input', () => {
      const logger = { debug: jest.fn() };
      const generator = new NonAxisFeasibilitySectionGenerator({ logger });

      generator.generate([]);

      expect(logger.debug).not.toHaveBeenCalled();
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Comprehensive output tests
  // ─────────────────────────────────────────────────────────────────────────

  describe('comprehensive output', () => {
    it('renders complete section with all elements', () => {
      const generator = new NonAxisFeasibilitySectionGenerator();
      const results = [
        createNonAxisClauseFeasibility({
          clauseId: 'clause_ok_001',
          varPath: 'emotions.joy',
          threshold: 0.3,
          operator: '>=',
          classification: 'OK',
          passRate: 0.456,
          maxValue: 0.923,
          signal: 'final',
        }),
        createNonAxisClauseFeasibility({
          clauseId: 'clause_impossible_001',
          varPath: 'emotions.anger',
          threshold: 0.95,
          operator: '>=',
          classification: 'IMPOSSIBLE',
          passRate: 0,
          maxValue: 0.312,
          p95Value: 0.285,
          marginMax: -0.638,
          signal: 'final',
          evidence: {
            bestSampleRef: 'sample_123',
            note: 'Anger never reaches 0.95 in regime',
          },
        }),
      ];

      const output = generator.generate(results, 2500);

      // Section header
      expect(output).toContain('## Non-Axis Clause Feasibility');

      // Scope metadata
      expect(output).toContain('[NON-AXIS ONLY]');
      expect(output).toContain('[IN-REGIME]');

      // Population
      expect(output).toContain('2,500 in-regime samples');

      // Table headers
      expect(output).toContain(
        '| Variable | Clause | Pass Rate | Max Value | Classification |'
      );

      // OK row
      expect(output).toContain('`emotions.joy`');
      expect(output).toContain('45.6%');
      expect(output).toContain('✅ OK');

      // IMPOSSIBLE row
      expect(output).toContain('`emotions.anger`');
      expect(output).toContain('0.0%');
      expect(output).toContain('⛔ IMPOSSIBLE');

      // Breakdown section
      expect(output).toContain('### ⛔ IMPOSSIBLE Clauses');
      expect(output).toContain('`clause_impossible_001`');
      expect(output).toContain('Anger never reaches 0.95 in regime');
      expect(output).toContain('`sample_123`');
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────
// Test helpers
// ─────────────────────────────────────────────────────────────────────────

/**
 * Create a valid NonAxisClauseFeasibility result for testing.
 *
 * @returns {import('../../../../../src/expressionDiagnostics/models/NonAxisClauseFeasibility.js').NonAxisClauseFeasibility}
 */
function createValidResult() {
  return createNonAxisClauseFeasibility({
    clauseId: 'test_clause_001',
    varPath: 'emotions.joy',
    threshold: 0.5,
    operator: '>=',
    classification: 'OK',
    passRate: 0.25,
    maxValue: 0.9,
    signal: 'final',
  });
}
