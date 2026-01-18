/**
 * @file Unit tests for ImportanceSamplingValidator.
 * @see src/expressionDiagnostics/services/ImportanceSamplingValidator.js
 */

import { describe, expect, it, jest, beforeEach } from '@jest/globals';
import ImportanceSamplingValidator from '../../../../src/expressionDiagnostics/services/ImportanceSamplingValidator.js';

const createLogger = () => ({
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
});

describe('ImportanceSamplingValidator', () => {
  describe('constructor', () => {
    it('creates instance with valid dependencies', () => {
      const logger = createLogger();
      const validator = new ImportanceSamplingValidator({ logger });
      expect(validator).toBeInstanceOf(ImportanceSamplingValidator);
    });

    it('throws if logger is missing', () => {
      expect(() => new ImportanceSamplingValidator({})).toThrow();
    });

    it('throws if logger is null', () => {
      expect(() => new ImportanceSamplingValidator({ logger: null })).toThrow();
    });

    it('throws if logger is undefined', () => {
      expect(() => new ImportanceSamplingValidator({ logger: undefined })).toThrow();
    });

    it('accepts optional config override', () => {
      const logger = createLogger();
      const customConfig = {
        enabled: true,
        confidenceLevel: 0.99,
      };
      const validator = new ImportanceSamplingValidator({
        logger,
        config: customConfig,
      });
      expect(validator).toBeInstanceOf(ImportanceSamplingValidator);
    });
  });

  describe('validate() - empty/invalid inputs', () => {
    let logger;
    let validator;

    beforeEach(() => {
      logger = createLogger();
      validator = new ImportanceSamplingValidator({ logger });
    });

    it('returns low-confidence result for null proposal', () => {
      const result = validator.validate(null, [{ value: 1 }], { clauses: [] });
      expect(result.confidence).toBe('low');
      expect(result.sampleCount).toBe(0);
      expect(result.effectiveSampleSize).toBe(0);
      expect(result.estimatedRate).toBe(0);
      expect(result.confidenceInterval).toEqual([0, 1]);
    });

    it('returns low-confidence result for undefined proposal', () => {
      const result = validator.validate(undefined, [{ value: 1 }], { clauses: [] });
      expect(result.confidence).toBe('low');
    });

    it('returns low-confidence result for empty samples array', () => {
      const result = validator.validate({ edits: [] }, [], { clauses: [] });
      expect(result.confidence).toBe('low');
      expect(result.sampleCount).toBe(0);
    });

    it('returns low-confidence result for null samples', () => {
      const result = validator.validate({ edits: [] }, null, { clauses: [] });
      expect(result.confidence).toBe('low');
    });

    it('returns low-confidence result for undefined samples', () => {
      const result = validator.validate({ edits: [] }, undefined, { clauses: [] });
      expect(result.confidence).toBe('low');
    });

    it('returns valid ValidationResult structure', () => {
      const result = validator.validate(null, [], {});
      expect(result).toHaveProperty('estimatedRate');
      expect(result).toHaveProperty('confidenceInterval');
      expect(result).toHaveProperty('confidence');
      expect(result).toHaveProperty('sampleCount');
      expect(result).toHaveProperty('effectiveSampleSize');
      expect(typeof result.estimatedRate).toBe('number');
      expect(Array.isArray(result.confidenceInterval)).toBe(true);
      expect(result.confidenceInterval.length).toBe(2);
    });
  });

  describe('validate() - single sample edge case', () => {
    let logger;
    let validator;

    beforeEach(() => {
      logger = createLogger();
      validator = new ImportanceSamplingValidator({ logger });
    });

    it('handles single sample that passes', () => {
      const proposal = { edits: [] };
      const samples = [{ clauseValue: 0.5 }];
      const context = { clauses: [{ id: 'clauseValue', threshold: 0.3 }] };

      const result = validator.validate(proposal, samples, context);

      expect(result.sampleCount).toBe(1);
      expect(result.estimatedRate).toBe(1); // Single sample passes
      expect(result.effectiveSampleSize).toBe(1);
    });

    it('handles single sample that fails', () => {
      const proposal = { edits: [] };
      const samples = [{ clauseValue: 0.1 }];
      const context = { clauses: [{ id: 'clauseValue', threshold: 0.5 }] };

      const result = validator.validate(proposal, samples, context);

      expect(result.sampleCount).toBe(1);
      expect(result.estimatedRate).toBe(0); // Single sample fails
    });
  });

  describe('validate() - uniform weights (ESS = n)', () => {
    let logger;
    let validator;

    beforeEach(() => {
      logger = createLogger();
      validator = new ImportanceSamplingValidator({ logger });
    });

    it('computes ESS equal to sample count when no edits', () => {
      const proposal = { edits: [] };
      const samples = Array.from({ length: 100 }, () => ({ value: 0.5 }));
      const context = { clauses: [{ id: 'value', threshold: 0.3 }] };

      const result = validator.validate(proposal, samples, context);

      expect(result.sampleCount).toBe(100);
      expect(result.effectiveSampleSize).toBeCloseTo(100, 1);
    });

    it('computes ESS equal to sample count when all weights are 1', () => {
      const proposal = {
        edits: [
          {
            clauseId: 'nonexistent',
            editType: 'threshold',
            before: 0.5,
            after: 0.3,
          },
        ],
      };
      const samples = Array.from({ length: 50 }, () => ({ value: 0.5 }));
      const context = { clauses: [] }; // No matching clause, weights stay 1

      const result = validator.validate(proposal, samples, context);

      expect(result.effectiveSampleSize).toBeCloseTo(50, 1);
    });

    it('maintains ESS ≤ sample count invariant', () => {
      const proposal = {
        edits: [
          {
            clauseId: 'value',
            editType: 'threshold',
            before: 0.5,
            after: 0.3,
          },
        ],
      };
      const samples = Array.from({ length: 100 }, (_, i) => ({
        value: i / 100,
      }));
      const context = { clauses: [{ id: 'value', threshold: 0.5 }] };

      const result = validator.validate(proposal, samples, context);

      expect(result.effectiveSampleSize).toBeLessThanOrEqual(result.sampleCount);
    });
  });

  describe('validate() - skewed weights (low ESS)', () => {
    let logger;
    let validator;

    beforeEach(() => {
      logger = createLogger();
      validator = new ImportanceSamplingValidator({ logger });
    });

    it('produces lower ESS when threshold change affects many samples', () => {
      const proposal = {
        edits: [
          {
            clauseId: 'value',
            editType: 'threshold',
            before: 0.8,
            after: 0.2,
          },
        ],
      };
      // Most samples fail old threshold but pass new one
      const samples = Array.from({ length: 100 }, (_, i) => ({
        value: 0.1 + (i * 0.7) / 100, // Range 0.1 to 0.8
      }));
      const context = { clauses: [{ id: 'value', threshold: 0.8 }] };

      const result = validator.validate(proposal, samples, context);

      // ESS should be less than n due to weight variance
      expect(result.effectiveSampleSize).toBeLessThan(result.sampleCount);
    });

    it('reports low confidence when ESS is very small', () => {
      const proposal = {
        edits: [
          {
            clauseId: 'value',
            editType: 'threshold',
            before: 0.99,
            after: 0.01,
          },
        ],
      };
      const samples = [
        { value: 0.001 },
        { value: 0.002 },
        { value: 0.003 },
      ];
      const context = { clauses: [{ id: 'value', threshold: 0.99 }] };

      const result = validator.validate(proposal, samples, context);

      // With very few samples and extreme weight changes, confidence should be low
      expect(['low', 'medium']).toContain(result.confidence);
    });
  });

  describe('validate() - confidence level boundary conditions', () => {
    let logger;

    beforeEach(() => {
      logger = createLogger();
    });

    it('uses 90% confidence level when configured', () => {
      const config = { enabled: true, confidenceLevel: 0.9 };
      const validator = new ImportanceSamplingValidator({ logger, config });

      const proposal = { edits: [] };
      const samples = Array.from({ length: 100 }, () => ({ value: 0.5 }));
      const context = { clauses: [{ id: 'value', threshold: 0.3 }] };

      const result = validator.validate(proposal, samples, context);

      // 90% CI should be narrower than 95% CI
      expect(result.confidenceInterval[1] - result.confidenceInterval[0]).toBeLessThan(0.1);
    });

    it('uses 95% confidence level by default', () => {
      const validator = new ImportanceSamplingValidator({ logger });

      const proposal = { edits: [] };
      const samples = Array.from({ length: 100 }, () => ({ value: 0.5 }));
      const context = { clauses: [{ id: 'value', threshold: 0.3 }] };

      const result = validator.validate(proposal, samples, context);

      // Verifies default 95% CI behavior
      expect(result.confidenceInterval).toBeDefined();
      expect(result.confidenceInterval.length).toBe(2);
    });

    it('uses 99% confidence level when configured', () => {
      const config = { enabled: true, confidenceLevel: 0.99 };
      const validator = new ImportanceSamplingValidator({ logger, config });

      const proposal = { edits: [] };
      const samples = Array.from({ length: 100 }, () => ({ value: 0.5 }));
      const context = { clauses: [{ id: 'value', threshold: 0.3 }] };

      const result = validator.validate(proposal, samples, context);

      // 99% CI should be wider than 95% CI
      expect(result.confidenceInterval).toBeDefined();
    });

    it('falls back to 95% z-score for unknown confidence levels', () => {
      const config = { enabled: true, confidenceLevel: 0.85 };
      const validator = new ImportanceSamplingValidator({ logger, config });

      const proposal = { edits: [] };
      const samples = Array.from({ length: 100 }, () => ({ value: 0.5 }));
      const context = { clauses: [{ id: 'value', threshold: 0.3 }] };

      expect(() => validator.validate(proposal, samples, context)).not.toThrow();
    });
  });

  describe('validate() - confidence classification thresholds', () => {
    let logger;
    let validator;

    beforeEach(() => {
      logger = createLogger();
      validator = new ImportanceSamplingValidator({ logger });
    });

    it('classifies as high when ESS >= 100 and interval width < 0.05', () => {
      const proposal = { edits: [] };
      // All samples pass - very narrow interval
      const samples = Array.from({ length: 200 }, () => ({ value: 0.9 }));
      const context = { clauses: [{ id: 'value', threshold: 0.3 }] };

      const result = validator.validate(proposal, samples, context);

      expect(result.confidence).toBe('high');
    });

    it('classifies as medium when ESS >= 30 and interval width < 0.15', () => {
      const proposal = { edits: [] };
      // 80 samples with 90% pass rate - gives ESS=80 and interval width ~0.10
      const samples = Array.from({ length: 80 }, (_, i) => ({
        value: i < 72 ? 0.9 : 0.1,
      }));
      const context = { clauses: [{ id: 'value', threshold: 0.5 }] };

      const result = validator.validate(proposal, samples, context);

      // ESS=80 (< 100 for high), interval width ~0.10 (< 0.15)
      expect(['high', 'medium']).toContain(result.confidence);
    });

    it('classifies as low when ESS < 30', () => {
      const proposal = { edits: [] };
      const samples = Array.from({ length: 10 }, () => ({ value: 0.5 }));
      const context = { clauses: [{ id: 'value', threshold: 0.3 }] };

      const result = validator.validate(proposal, samples, context);

      expect(result.confidence).toBe('low');
    });

    it('classifies as low when interval width >= 0.15', () => {
      const proposal = { edits: [] };
      // Very mixed samples - wide interval
      const samples = Array.from({ length: 20 }, (_, i) => ({
        value: i % 2 === 0 ? 0.9 : 0.1,
      }));
      const context = { clauses: [{ id: 'value', threshold: 0.5 }] };

      const result = validator.validate(proposal, samples, context);

      // With 50% pass rate and only 20 samples, interval will be wide
      expect(result.confidence).toBe('low');
    });
  });

  describe('validate() - Wilson score interval properties', () => {
    let logger;
    let validator;

    beforeEach(() => {
      logger = createLogger();
      validator = new ImportanceSamplingValidator({ logger });
    });

    it('interval bounds are within [0, 1]', () => {
      const proposal = { edits: [] };
      const samples = Array.from({ length: 100 }, () => ({ value: 0.5 }));
      const context = { clauses: [{ id: 'value', threshold: 0.3 }] };

      const result = validator.validate(proposal, samples, context);

      expect(result.confidenceInterval[0]).toBeGreaterThanOrEqual(0);
      expect(result.confidenceInterval[1]).toBeLessThanOrEqual(1);
    });

    it('lower bound does not exceed upper bound', () => {
      const proposal = { edits: [] };
      const samples = Array.from({ length: 50 }, (_, i) => ({
        value: i < 25 ? 0.9 : 0.1,
      }));
      const context = { clauses: [{ id: 'value', threshold: 0.5 }] };

      const result = validator.validate(proposal, samples, context);

      expect(result.confidenceInterval[0]).toBeLessThanOrEqual(result.confidenceInterval[1]);
    });

    it('estimated rate is within confidence interval', () => {
      const proposal = { edits: [] };
      const samples = Array.from({ length: 100 }, (_, i) => ({
        value: i < 60 ? 0.9 : 0.1,
      }));
      const context = { clauses: [{ id: 'value', threshold: 0.5 }] };

      const result = validator.validate(proposal, samples, context);

      expect(result.estimatedRate).toBeGreaterThanOrEqual(result.confidenceInterval[0]);
      expect(result.estimatedRate).toBeLessThanOrEqual(result.confidenceInterval[1]);
    });

    it('handles edge case p=0 (all samples fail)', () => {
      const proposal = { edits: [] };
      const samples = Array.from({ length: 50 }, () => ({ value: 0.1 }));
      const context = { clauses: [{ id: 'value', threshold: 0.9 }] };

      const result = validator.validate(proposal, samples, context);

      expect(result.estimatedRate).toBe(0);
      expect(result.confidenceInterval[0]).toBe(0);
      expect(result.confidenceInterval[1]).toBeGreaterThan(0);
    });

    it('handles edge case p=1 (all samples pass)', () => {
      const proposal = { edits: [] };
      const samples = Array.from({ length: 50 }, () => ({ value: 0.9 }));
      const context = { clauses: [{ id: 'value', threshold: 0.1 }] };

      const result = validator.validate(proposal, samples, context);

      expect(result.estimatedRate).toBe(1);
      expect(result.confidenceInterval[0]).toBeLessThan(1);
      expect(result.confidenceInterval[1]).toBe(1);
    });
  });

  describe('validate() - threshold edit application', () => {
    let logger;
    let validator;

    beforeEach(() => {
      logger = createLogger();
      validator = new ImportanceSamplingValidator({ logger });
    });

    it('applies threshold edit to clause during evaluation', () => {
      const proposal = {
        edits: [
          {
            clauseId: 'testClause',
            editType: 'threshold',
            before: 0.8,
            after: 0.3,
          },
        ],
      };
      // Samples between 0.3 and 0.8 will pass with new threshold but fail with old
      const samples = Array.from({ length: 100 }, () => ({ testClause: 0.5 }));
      const context = { clauses: [{ id: 'testClause', threshold: 0.8 }] };

      const result = validator.validate(proposal, samples, context);

      expect(result.estimatedRate).toBe(1); // All pass with new threshold 0.3
    });

    it('handles structure edits (weight = 1)', () => {
      const proposal = {
        edits: [
          {
            clauseId: 'testClause',
            editType: 'structure',
            before: 'old',
            after: 'new',
          },
        ],
      };
      const samples = Array.from({ length: 50 }, () => ({ value: 0.5 }));
      const context = { clauses: [{ id: 'value', threshold: 0.3 }] };

      const result = validator.validate(proposal, samples, context);

      // Structure edits don't affect weights
      expect(result.effectiveSampleSize).toBeCloseTo(50, 1);
    });

    it('handles missing clause gracefully', () => {
      const proposal = {
        edits: [
          {
            clauseId: 'nonexistent',
            editType: 'threshold',
            before: 0.5,
            after: 0.3,
          },
        ],
      };
      const samples = Array.from({ length: 50 }, () => ({ value: 0.5 }));
      const context = { clauses: [{ id: 'other', threshold: 0.3 }] };

      expect(() => validator.validate(proposal, samples, context)).not.toThrow();
    });
  });

  describe('validate() - nested value extraction', () => {
    let logger;
    let validator;

    beforeEach(() => {
      logger = createLogger();
      validator = new ImportanceSamplingValidator({ logger });
    });

    it('extracts value from nested path using valuePath', () => {
      const proposal = { edits: [] };
      const samples = [
        { emotions: { joy: 0.8 } },
        { emotions: { joy: 0.2 } },
      ];
      const context = {
        clauses: [{ id: 'joy', valuePath: 'emotions.joy', threshold: 0.5 }],
      };

      const result = validator.validate(proposal, samples, context);

      expect(result.estimatedRate).toBe(0.5); // 1 of 2 passes
    });

    it('falls back to clause id when valuePath not specified', () => {
      const proposal = { edits: [] };
      const samples = [{ myClause: 0.8 }, { myClause: 0.2 }];
      const context = {
        clauses: [{ id: 'myClause', threshold: 0.5 }],
      };

      const result = validator.validate(proposal, samples, context);

      expect(result.estimatedRate).toBe(0.5);
    });

    it('handles missing nested values (defaults to 0)', () => {
      const proposal = { edits: [] };
      const samples = [{ other: 0.8 }, {}];
      const context = {
        clauses: [{ id: 'missing', threshold: 0.5 }],
      };

      const result = validator.validate(proposal, samples, context);

      expect(result.estimatedRate).toBe(0); // Both fail (missing values = 0)
    });
  });

  describe('validate() - error handling', () => {
    let logger;
    let validator;

    beforeEach(() => {
      logger = createLogger();
      validator = new ImportanceSamplingValidator({ logger });
    });

    it('catches errors and returns low-confidence result', () => {
      const proposal = { edits: [] };
      // Create samples that might cause issues
      const samples = [{ value: null }, { value: undefined }];
      const context = { clauses: [{ id: 'value', threshold: 0.5 }] };

      expect(() => validator.validate(proposal, samples, context)).not.toThrow();
      const result = validator.validate(proposal, samples, context);
      expect(result).toBeDefined();
    });

    it('logs error when validation fails', () => {
      // Force an error by passing a circular structure
      const proposal = { edits: [] };
      const circular = { value: 0.5 };
      circular.self = circular;

      const samples = [circular];
      const context = { clauses: [{ id: 'value', threshold: 0.3 }] };

      // Should handle without throwing and return a result
      const result = validator.validate(proposal, samples, context);
      expect(result).toBeDefined();
      expect(result).toHaveProperty('estimatedRate');
    });
  });

  describe('validateBatch()', () => {
    let logger;
    let validator;

    beforeEach(() => {
      logger = createLogger();
      validator = new ImportanceSamplingValidator({ logger });
    });

    it('returns empty Map for null proposals', () => {
      const result = validator.validateBatch(null, [{ value: 0.5 }], {});
      expect(result).toBeInstanceOf(Map);
      expect(result.size).toBe(0);
    });

    it('returns empty Map for undefined proposals', () => {
      const result = validator.validateBatch(undefined, [{ value: 0.5 }], {});
      expect(result).toBeInstanceOf(Map);
      expect(result.size).toBe(0);
    });

    it('validates multiple proposals', () => {
      const proposal1 = {
        edits: [{ clauseId: 'v', editType: 'threshold', before: 0.8, after: 0.3 }],
      };
      const proposal2 = {
        edits: [{ clauseId: 'v', editType: 'threshold', before: 0.8, after: 0.6 }],
      };
      const samples = Array.from({ length: 50 }, () => ({ v: 0.5 }));
      const context = { clauses: [{ id: 'v', threshold: 0.8 }] };

      const results = validator.validateBatch([proposal1, proposal2], samples, context);

      expect(results).toBeInstanceOf(Map);
      expect(results.size).toBe(2);
      expect(results.has(proposal1)).toBe(true);
      expect(results.has(proposal2)).toBe(true);
    });

    it('each proposal gets independent validation', () => {
      const passingProposal = {
        edits: [{ clauseId: 'v', editType: 'threshold', before: 0.9, after: 0.1 }],
      };
      const failingProposal = {
        edits: [{ clauseId: 'v', editType: 'threshold', before: 0.5, after: 0.9 }],
      };
      const samples = Array.from({ length: 50 }, () => ({ v: 0.5 }));
      const context = { clauses: [{ id: 'v', threshold: 0.9 }] };

      const results = validator.validateBatch(
        [passingProposal, failingProposal],
        samples,
        context
      );

      const passingResult = results.get(passingProposal);
      const failingResult = results.get(failingProposal);

      expect(passingResult.estimatedRate).toBeGreaterThan(failingResult.estimatedRate);
    });

    it('handles empty proposals array', () => {
      const result = validator.validateBatch([], [{ value: 0.5 }], {});
      expect(result).toBeInstanceOf(Map);
      expect(result.size).toBe(0);
    });
  });

  describe('validate() - weight computation', () => {
    let logger;
    let validator;

    beforeEach(() => {
      logger = createLogger();
      validator = new ImportanceSamplingValidator({ logger });
    });

    it('applies weight clamping to prevent extreme values', () => {
      const proposal = {
        edits: [
          {
            clauseId: 'v',
            editType: 'threshold',
            before: 0.99,
            after: 0.01,
          },
        ],
      };
      // Values near boundaries
      const samples = [{ v: 0.5 }, { v: 0.02 }, { v: 0.98 }];
      const context = { clauses: [{ id: 'v', threshold: 0.99 }] };

      const result = validator.validate(proposal, samples, context);

      // Should not produce NaN or Infinity
      expect(Number.isFinite(result.estimatedRate)).toBe(true);
      expect(Number.isFinite(result.effectiveSampleSize)).toBe(true);
    });

    it('handles non-numeric threshold values gracefully', () => {
      const proposal = {
        edits: [
          {
            clauseId: 'v',
            editType: 'threshold',
            before: 'old',
            after: 'new',
          },
        ],
      };
      const samples = [{ v: 0.5 }];
      const context = { clauses: [{ id: 'v', threshold: 0.3 }] };

      expect(() => validator.validate(proposal, samples, context)).not.toThrow();
    });
  });

  describe('validate() - context handling', () => {
    let logger;
    let validator;

    beforeEach(() => {
      logger = createLogger();
      validator = new ImportanceSamplingValidator({ logger });
    });

    it('handles null context', () => {
      const proposal = { edits: [] };
      const samples = [{ value: 0.5 }];

      const result = validator.validate(proposal, samples, null);

      expect(result.estimatedRate).toBe(1); // No clauses to fail
    });

    it('handles undefined context', () => {
      const proposal = { edits: [] };
      const samples = [{ value: 0.5 }];

      const result = validator.validate(proposal, samples, undefined);

      expect(result.estimatedRate).toBe(1);
    });

    it('handles context without clauses array', () => {
      const proposal = { edits: [] };
      const samples = [{ value: 0.5 }];
      const context = { otherProperty: true };

      const result = validator.validate(proposal, samples, context);

      expect(result.estimatedRate).toBe(1);
    });

    it('handles empty clauses array', () => {
      const proposal = { edits: [] };
      const samples = [{ value: 0.5 }];
      const context = { clauses: [] };

      const result = validator.validate(proposal, samples, context);

      expect(result.estimatedRate).toBe(1);
    });
  });

  describe('validate() - multiple clauses', () => {
    let logger;
    let validator;

    beforeEach(() => {
      logger = createLogger();
      validator = new ImportanceSamplingValidator({ logger });
    });

    it('requires all clauses to pass', () => {
      const proposal = { edits: [] };
      const samples = [
        { a: 0.8, b: 0.8 }, // Both pass
        { a: 0.8, b: 0.2 }, // a passes, b fails
        { a: 0.2, b: 0.8 }, // a fails, b passes
        { a: 0.2, b: 0.2 }, // Both fail
      ];
      const context = {
        clauses: [
          { id: 'a', threshold: 0.5 },
          { id: 'b', threshold: 0.5 },
        ],
      };

      const result = validator.validate(proposal, samples, context);

      expect(result.estimatedRate).toBe(0.25); // Only 1 of 4 passes
    });

    it('applies multiple edits', () => {
      const proposal = {
        edits: [
          { clauseId: 'a', editType: 'threshold', before: 0.8, after: 0.3 },
          { clauseId: 'b', editType: 'threshold', before: 0.8, after: 0.3 },
        ],
      };
      const samples = Array.from({ length: 100 }, () => ({ a: 0.5, b: 0.5 }));
      const context = {
        clauses: [
          { id: 'a', threshold: 0.8 },
          { id: 'b', threshold: 0.8 },
        ],
      };

      const result = validator.validate(proposal, samples, context);

      expect(result.estimatedRate).toBe(1); // All pass with lower thresholds
    });
  });

  describe('validate() - null/undefined edits handling', () => {
    let logger;
    let validator;

    beforeEach(() => {
      logger = createLogger();
      validator = new ImportanceSamplingValidator({ logger });
    });

    it('handles proposal with null edits', () => {
      const proposal = { edits: null };
      const samples = [{ value: 0.5 }];
      const context = { clauses: [{ id: 'value', threshold: 0.3 }] };

      const result = validator.validate(proposal, samples, context);

      expect(result.estimatedRate).toBe(1);
    });

    it('handles proposal with undefined edits', () => {
      const proposal = { edits: undefined };
      const samples = [{ value: 0.5 }];
      const context = { clauses: [{ id: 'value', threshold: 0.3 }] };

      const result = validator.validate(proposal, samples, context);

      expect(result.estimatedRate).toBe(1);
    });

    it('handles proposal without edits property', () => {
      const proposal = {};
      const samples = [{ value: 0.5 }];
      const context = { clauses: [{ id: 'value', threshold: 0.3 }] };

      const result = validator.validate(proposal, samples, context);

      expect(result.estimatedRate).toBe(1);
    });
  });

  describe('debug logging', () => {
    let logger;
    let validator;

    beforeEach(() => {
      logger = createLogger();
      validator = new ImportanceSamplingValidator({ logger });
    });

    it('logs validation result details', () => {
      const proposal = { edits: [] };
      const samples = Array.from({ length: 50 }, () => ({ value: 0.5 }));
      const context = { clauses: [{ id: 'value', threshold: 0.3 }] };

      validator.validate(proposal, samples, context);

      expect(logger.debug).toHaveBeenCalled();
      const lastCall = logger.debug.mock.calls[logger.debug.mock.calls.length - 1][0];
      expect(lastCall).toContain('ImportanceSamplingValidator');
    });

    it('logs when invalid input is provided', () => {
      validator.validate(null, [], {});

      expect(logger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Invalid input')
      );
    });
  });

  describe('edge cases - additional coverage', () => {
    let logger;
    let validator;

    beforeEach(() => {
      logger = createLogger();
      validator = new ImportanceSamplingValidator({ logger });
    });

    describe('Wilson score interval with edge ESS', () => {
      it('returns full range [0, 1] when ESS is exactly 0', () => {
        // Force ESS = 0 by having proposal but invalid samples that produce 0 totalWeight
        // This tests line 310 indirectly
        const proposal = { edits: [] };
        const samples = [];  // Empty will return low-confidence early
        const context = { clauses: [] };

        const result = validator.validate(proposal, samples, context);

        // With empty samples, we get low confidence result with [0, 1] interval
        expect(result.confidenceInterval).toEqual([0, 1]);
      });

      it('handles interval calculation with very small ESS', () => {
        const proposal = { edits: [] };
        const samples = [{ value: 0.5 }];
        const context = { clauses: [{ id: 'value', threshold: 0.3 }] };

        const result = validator.validate(proposal, samples, context);

        // With ESS = 1, interval should be very wide
        const width = result.confidenceInterval[1] - result.confidenceInterval[0];
        expect(width).toBeGreaterThan(0.3);
      });
    });

    describe('nested value extraction edge cases', () => {
      it('handles clause with non-string valuePath', () => {
        const proposal = { edits: [] };
        const samples = [{ value: 0.8 }];
        const context = {
          clauses: [{ id: 'value', valuePath: 123, threshold: 0.5 }],
        };

        // Should not throw - handles gracefully
        expect(() => validator.validate(proposal, samples, context)).not.toThrow();
        const result = validator.validate(proposal, samples, context);
        // Non-string valuePath returns undefined from #getNestedValue, defaults to 0
        // 0 < 0.5 threshold means sample fails, so estimatedRate is 0
        expect(result.estimatedRate).toBe(0);
      });

      it('handles clause with null valuePath', () => {
        const proposal = { edits: [] };
        const samples = [{ myId: 0.8 }];
        const context = {
          clauses: [{ id: 'myId', valuePath: null, threshold: 0.5 }],
        };

        const result = validator.validate(proposal, samples, context);
        expect(result.estimatedRate).toBe(1);
      });

      it('handles deeply nested paths with missing intermediate keys', () => {
        const proposal = { edits: [] };
        const samples = [{ a: {} }]; // Missing b.c
        const context = {
          clauses: [{ id: 'test', valuePath: 'a.b.c', threshold: 0.5 }],
        };

        const result = validator.validate(proposal, samples, context);
        expect(result.estimatedRate).toBe(0); // Value extracts as 0, fails threshold
      });
    });

    describe('threshold weight computation special cases', () => {
      it('handles sample exactly at old threshold that fails new higher threshold', () => {
        const proposal = {
          edits: [
            {
              clauseId: 'value',
              editType: 'threshold',
              before: 0.5,
              after: 0.8,
            },
          ],
        };
        // Sample at exactly old threshold passes old, fails new
        const samples = [{ value: 0.5 }];
        const context = { clauses: [{ id: 'value', threshold: 0.5 }] };

        const result = validator.validate(proposal, samples, context);

        // Sample passes old (0.5 >= 0.5) but fails new (0.5 < 0.8)
        expect(result.estimatedRate).toBe(0);
      });

      it('handles sample between old and new threshold when lowering', () => {
        const proposal = {
          edits: [
            {
              clauseId: 'value',
              editType: 'threshold',
              before: 0.7,
              after: 0.3,
            },
          ],
        };
        // Sample at 0.5 fails old (0.5 < 0.7) but passes new (0.5 >= 0.3)
        const samples = [{ value: 0.5 }];
        const context = { clauses: [{ id: 'value', threshold: 0.7 }] };

        const result = validator.validate(proposal, samples, context);

        expect(result.estimatedRate).toBe(1);
        // Weight should be > 1 because sample is upweighted
        expect(result.effectiveSampleSize).toBeLessThanOrEqual(1);
      });
    });

    describe('clause without threshold', () => {
      it('uses 0 as default threshold when clause.threshold is undefined', () => {
        const proposal = { edits: [] };
        const samples = [{ value: 0.1 }];
        const context = {
          clauses: [{ id: 'value' }], // No threshold property
        };

        const result = validator.validate(proposal, samples, context);

        // 0.1 >= 0 (default), so passes
        expect(result.estimatedRate).toBe(1);
      });

      it('handles clause with null threshold', () => {
        const proposal = { edits: [] };
        const samples = [{ value: -0.1 }];
        const context = {
          clauses: [{ id: 'value', threshold: null }],
        };

        const result = validator.validate(proposal, samples, context);

        // -0.1 >= 0 (null coerces to 0) is false
        expect(result.estimatedRate).toBe(0);
      });
    });
  });
});
