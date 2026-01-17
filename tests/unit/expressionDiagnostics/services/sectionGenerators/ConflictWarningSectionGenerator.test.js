/**
 * @file Unit tests for ConflictWarningSectionGenerator
 */

import { describe, it, expect, jest } from '@jest/globals';
import ConflictWarningSectionGenerator from '../../../../../src/expressionDiagnostics/services/sectionGenerators/ConflictWarningSectionGenerator.js';
import {
  createFitFeasibilityConflict,
  createPrototypeScore,
} from '../../../../../src/expressionDiagnostics/models/FitFeasibilityConflict.js';

describe('ConflictWarningSectionGenerator', () => {
  // ─────────────────────────────────────────────────────────────────────────
  // Construction tests
  // ─────────────────────────────────────────────────────────────────────────

  describe('construction', () => {
    it('constructs without options', () => {
      expect(() => new ConflictWarningSectionGenerator()).not.toThrow();
    });

    it('constructs with empty options object', () => {
      expect(() => new ConflictWarningSectionGenerator({})).not.toThrow();
    });

    it('constructs with logger', () => {
      const logger = { debug: jest.fn() };
      expect(
        () => new ConflictWarningSectionGenerator({ logger })
      ).not.toThrow();
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Empty input tests
  // ─────────────────────────────────────────────────────────────────────────

  describe('empty input handling', () => {
    it('returns empty string for null input', () => {
      const generator = new ConflictWarningSectionGenerator();
      const result = generator.generate(null);
      expect(result).toBe('');
    });

    it('returns empty string for undefined input', () => {
      const generator = new ConflictWarningSectionGenerator();
      const result = generator.generate(undefined);
      expect(result).toBe('');
    });

    it('returns empty string for empty array', () => {
      const generator = new ConflictWarningSectionGenerator();
      const result = generator.generate([]);
      expect(result).toBe('');
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Section header tests
  // ─────────────────────────────────────────────────────────────────────────

  describe('section header', () => {
    it('includes warning emoji in section header when conflicts exist', () => {
      const generator = new ConflictWarningSectionGenerator();
      const conflict = createFitFeasibilityConflict({
        type: 'fit_vs_clause_impossible',
        explanation: 'Test conflict',
      });
      const result = generator.generate([conflict]);

      expect(result).toContain('## ⚠️ Fit vs Feasibility Conflicts');
    });

    it('includes blockquote intro when conflicts exist', () => {
      const generator = new ConflictWarningSectionGenerator();
      const conflict = createFitFeasibilityConflict({
        type: 'gate_contradiction',
        explanation: 'Test conflict',
      });
      const result = generator.generate([conflict]);

      expect(result).toContain(
        '> The following conflicts indicate discrepancies between prototype fit rankings and clause feasibility analysis.'
      );
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Conflict type formatting tests
  // ─────────────────────────────────────────────────────────────────────────

  describe('conflict type formatting', () => {
    it('formats fit_vs_clause_impossible type correctly', () => {
      const generator = new ConflictWarningSectionGenerator();
      const conflict = createFitFeasibilityConflict({
        type: 'fit_vs_clause_impossible',
        explanation: 'Some explanation',
      });
      const result = generator.generate([conflict]);

      expect(result).toContain('Fit vs Clause Impossible');
    });

    it('formats gate_contradiction type correctly', () => {
      const generator = new ConflictWarningSectionGenerator();
      const conflict = createFitFeasibilityConflict({
        type: 'gate_contradiction',
        explanation: 'Gate conflict detected',
      });
      const result = generator.generate([conflict]);

      expect(result).toContain('Gate Contradiction');
    });

    it('includes conflict number in heading', () => {
      const generator = new ConflictWarningSectionGenerator();
      const conflict = createFitFeasibilityConflict({
        type: 'fit_vs_clause_impossible',
        explanation: 'Test',
      });
      const result = generator.generate([conflict]);

      expect(result).toContain('Conflict #1');
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Severity emoji tests
  // ─────────────────────────────────────────────────────────────────────────

  describe('severity emojis', () => {
    it('uses 🚨 emoji for fit_vs_clause_impossible conflicts', () => {
      const generator = new ConflictWarningSectionGenerator();
      const conflict = createFitFeasibilityConflict({
        type: 'fit_vs_clause_impossible',
        explanation: 'Critical conflict',
      });
      const result = generator.generate([conflict]);

      expect(result).toContain('#### 🚨 Conflict #1');
    });

    it('uses ⚠️ emoji for gate_contradiction conflicts', () => {
      const generator = new ConflictWarningSectionGenerator();
      const conflict = createFitFeasibilityConflict({
        type: 'gate_contradiction',
        explanation: 'Gate issue',
      });
      const result = generator.generate([conflict]);

      expect(result).toContain('#### ⚠️ Conflict #1');
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Content rendering tests
  // ─────────────────────────────────────────────────────────────────────────

  describe('content rendering', () => {
    it('includes explanation in output', () => {
      const generator = new ConflictWarningSectionGenerator();
      const conflict = createFitFeasibilityConflict({
        type: 'fit_vs_clause_impossible',
        explanation:
          'The top-scoring prototypes have no feasible clause path.',
      });
      const result = generator.generate([conflict]);

      expect(result).toContain('**Explanation**');
      expect(result).toContain(
        'The top-scoring prototypes have no feasible clause path.'
      );
    });

    it('formats prototype scores to 3 decimal places', () => {
      const generator = new ConflictWarningSectionGenerator();
      const conflict = createFitFeasibilityConflict({
        type: 'fit_vs_clause_impossible',
        explanation: 'Test',
        topPrototypes: [
          createPrototypeScore('joy', 0.856789),
          createPrototypeScore('sadness', 0.5),
        ],
      });
      const result = generator.generate([conflict]);

      expect(result).toContain('**Top Prototypes**');
      expect(result).toContain('`joy`: 0.857');
      expect(result).toContain('`sadness`: 0.500');
    });

    it('wraps clause IDs in backticks', () => {
      const generator = new ConflictWarningSectionGenerator();
      const conflict = createFitFeasibilityConflict({
        type: 'gate_contradiction',
        explanation: 'Clauses are impossible',
        impossibleClauseIds: ['clause_001', 'moodAxes.anger >= 0.5'],
      });
      const result = generator.generate([conflict]);

      expect(result).toContain('**Impossible Clauses**');
      expect(result).toContain('- `clause_001`');
      expect(result).toContain('- `moodAxes.anger >= 0.5`');
    });

    it('includes suggested fixes when provided', () => {
      const generator = new ConflictWarningSectionGenerator();
      const conflict = createFitFeasibilityConflict({
        type: 'fit_vs_clause_impossible',
        explanation: 'Test',
        suggestedFixes: [
          'Lower the threshold for anger',
          'Add alternative emotion prerequisites',
        ],
      });
      const result = generator.generate([conflict]);

      expect(result).toContain('**Suggested Fixes**');
      expect(result).toContain('- Lower the threshold for anger');
      expect(result).toContain('- Add alternative emotion prerequisites');
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Multiple conflicts tests
  // ─────────────────────────────────────────────────────────────────────────

  describe('multiple conflicts', () => {
    it('renders multiple conflicts with sequential numbering', () => {
      const generator = new ConflictWarningSectionGenerator();
      const conflicts = [
        createFitFeasibilityConflict({
          type: 'fit_vs_clause_impossible',
          explanation: 'First conflict',
        }),
        createFitFeasibilityConflict({
          type: 'gate_contradiction',
          explanation: 'Second conflict',
        }),
      ];
      const result = generator.generate(conflicts);

      expect(result).toContain('Conflict #1');
      expect(result).toContain('Conflict #2');
      expect(result).toContain('First conflict');
      expect(result).toContain('Second conflict');
    });

    it('uses correct emoji for each conflict type in mixed list', () => {
      const generator = new ConflictWarningSectionGenerator();
      const conflicts = [
        createFitFeasibilityConflict({
          type: 'fit_vs_clause_impossible',
          explanation: 'Critical one',
        }),
        createFitFeasibilityConflict({
          type: 'gate_contradiction',
          explanation: 'Warning one',
        }),
      ];
      const result = generator.generate(conflicts);

      // First conflict should have 🚨
      expect(result).toContain('#### 🚨 Conflict #1: Fit vs Clause Impossible');
      // Second conflict should have ⚠️
      expect(result).toContain('#### ⚠️ Conflict #2: Gate Contradiction');
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Edge case tests (empty subsections omitted)
  // ─────────────────────────────────────────────────────────────────────────

  describe('empty subsection handling', () => {
    it('omits Top Prototypes section when array is empty', () => {
      const generator = new ConflictWarningSectionGenerator();
      const conflict = createFitFeasibilityConflict({
        type: 'fit_vs_clause_impossible',
        explanation: 'Test',
        topPrototypes: [],
      });
      const result = generator.generate([conflict]);

      expect(result).not.toContain('**Top Prototypes**');
    });

    it('omits Impossible Clauses section when array is empty', () => {
      const generator = new ConflictWarningSectionGenerator();
      const conflict = createFitFeasibilityConflict({
        type: 'gate_contradiction',
        explanation: 'Test',
        impossibleClauseIds: [],
      });
      const result = generator.generate([conflict]);

      expect(result).not.toContain('**Impossible Clauses**');
    });

    it('omits Suggested Fixes section when array is empty', () => {
      const generator = new ConflictWarningSectionGenerator();
      const conflict = createFitFeasibilityConflict({
        type: 'fit_vs_clause_impossible',
        explanation: 'Test',
        suggestedFixes: [],
      });
      const result = generator.generate([conflict]);

      expect(result).not.toContain('**Suggested Fixes**');
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Logger integration tests
  // ─────────────────────────────────────────────────────────────────────────

  describe('logger integration', () => {
    it('calls logger.debug when generating with conflicts', () => {
      const logger = { debug: jest.fn() };
      const generator = new ConflictWarningSectionGenerator({ logger });
      const conflict = createFitFeasibilityConflict({
        type: 'fit_vs_clause_impossible',
        explanation: 'Test',
      });

      generator.generate([conflict]);

      expect(logger.debug).toHaveBeenCalledWith(
        'ConflictWarningSectionGenerator: Generating section for 1 conflict(s)'
      );
    });

    it('does not throw when logger.debug is undefined', () => {
      const logger = { info: jest.fn() }; // No debug method
      const generator = new ConflictWarningSectionGenerator({ logger });
      const conflict = createFitFeasibilityConflict({
        type: 'fit_vs_clause_impossible',
        explanation: 'Test',
      });

      expect(() => generator.generate([conflict])).not.toThrow();
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Full conflict rendering test (comprehensive)
  // ─────────────────────────────────────────────────────────────────────────

  describe('full conflict rendering', () => {
    it('renders complete conflict with all fields', () => {
      const generator = new ConflictWarningSectionGenerator();
      const conflict = createFitFeasibilityConflict({
        type: 'fit_vs_clause_impossible',
        explanation:
          'Top-scoring prototypes joy and excitement have impossible clause paths.',
        topPrototypes: [
          createPrototypeScore('joy', 0.923456),
          createPrototypeScore('excitement', 0.812345),
        ],
        impossibleClauseIds: ['moodAxes.anger >= 0.9', 'moodAxes.fear >= 0.8'],
        suggestedFixes: [
          'Lower the anger threshold to 0.5',
          'Consider using OR logic between clauses',
          'Review prototype definitions',
        ],
      });

      const result = generator.generate([conflict]);

      // Section header
      expect(result).toContain('## ⚠️ Fit vs Feasibility Conflicts');

      // Conflict header
      expect(result).toContain(
        '#### 🚨 Conflict #1: Fit vs Clause Impossible'
      );

      // Explanation
      expect(result).toContain(
        'Top-scoring prototypes joy and excitement have impossible clause paths.'
      );

      // Prototypes with 3 decimal places
      expect(result).toContain('`joy`: 0.923');
      expect(result).toContain('`excitement`: 0.812');

      // Clause IDs in backticks
      expect(result).toContain('- `moodAxes.anger >= 0.9`');
      expect(result).toContain('- `moodAxes.fear >= 0.8`');

      // Suggested fixes
      expect(result).toContain('- Lower the anger threshold to 0.5');
      expect(result).toContain('- Consider using OR logic between clauses');
      expect(result).toContain('- Review prototype definitions');
    });
  });
});
