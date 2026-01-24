/**
 * @file Unit tests for GateASTNormalizer
 * @description Tests gate parsing to AST, toString, evaluate, normalize, and implication checking.
 * @see tickets/PROANAOVEV3-006-gate-ast-normalizer.md
 */

import { describe, it, expect } from '@jest/globals';
import GateASTNormalizer from '../../../../../src/expressionDiagnostics/services/prototypeOverlap/GateASTNormalizer.js';

describe('GateASTNormalizer', () => {
  /**
   * Create a mock logger for testing.
   *
   * @returns {object} Mock logger
   */
  const createMockLogger = () => ({
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
  });

  /**
   * Create normalizer instance for testing.
   *
   * @returns {{normalizer: GateASTNormalizer, logger: object}} Normalizer instance and mock logger
   */
  const createNormalizer = () => {
    const logger = createMockLogger();
    const normalizer = new GateASTNormalizer({ logger });
    return { normalizer, logger };
  };

  describe('constructor', () => {
    it('should create instance with valid logger', () => {
      const { normalizer } = createNormalizer();
      expect(normalizer).toBeInstanceOf(GateASTNormalizer);
    });

    it('should throw when logger is missing', () => {
      expect(() => new GateASTNormalizer({ logger: null })).toThrow();
    });

    it('should throw when logger lacks required methods', () => {
      const invalidLogger = { debug: jest.fn() }; // Missing warn, error
      expect(() => new GateASTNormalizer({ logger: invalidLogger })).toThrow();
    });
  });

  describe('parse - String Predicates', () => {
    it('should parse simple gate string with >=', () => {
      const { normalizer } = createNormalizer();

      const result = normalizer.parse('valence >= 0.35');

      expect(result.parseComplete).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.ast).toEqual({
        type: 'comparison',
        axis: 'valence',
        operator: '>=',
        threshold: 0.35,
      });
    });

    it('should parse simple gate string with <=', () => {
      const { normalizer } = createNormalizer();

      const result = normalizer.parse('threat <= 0.20');

      expect(result.parseComplete).toBe(true);
      expect(result.ast.operator).toBe('<=');
      expect(result.ast.threshold).toBe(0.2);
    });

    it('should parse simple gate string with >', () => {
      const { normalizer } = createNormalizer();

      const result = normalizer.parse('arousal > 0.50');

      expect(result.parseComplete).toBe(true);
      expect(result.ast.operator).toBe('>');
    });

    it('should parse simple gate string with <', () => {
      const { normalizer } = createNormalizer();

      const result = normalizer.parse('threat < 0.30');

      expect(result.parseComplete).toBe(true);
      expect(result.ast.operator).toBe('<');
    });

    it('should parse simple gate string with ==', () => {
      const { normalizer } = createNormalizer();

      const result = normalizer.parse('valence == 0.50');

      expect(result.parseComplete).toBe(true);
      expect(result.ast.operator).toBe('==');
    });

    it('should parse negative threshold values', () => {
      const { normalizer } = createNormalizer();

      const result = normalizer.parse('agency_control >= -0.25');

      expect(result.parseComplete).toBe(true);
      expect(result.ast.threshold).toBe(-0.25);
    });

    it('should parse compound AND expression', () => {
      const { normalizer } = createNormalizer();

      const result = normalizer.parse('valence >= 0.20 AND threat <= 0.30');

      expect(result.parseComplete).toBe(true);
      expect(result.ast.type).toBe('and');
      expect(result.ast.children).toHaveLength(2);
      expect(result.ast.children[0].axis).toBe('valence');
      expect(result.ast.children[1].axis).toBe('threat');
    });

    it('should parse compound OR expression', () => {
      const { normalizer } = createNormalizer();

      const result = normalizer.parse('valence >= 0.50 OR arousal >= 0.50');

      expect(result.parseComplete).toBe(true);
      expect(result.ast.type).toBe('or');
      expect(result.ast.children).toHaveLength(2);
    });

    it('should handle case-insensitive AND/OR', () => {
      const { normalizer } = createNormalizer();

      const result1 = normalizer.parse('valence >= 0.20 and threat <= 0.30');
      const result2 = normalizer.parse('valence >= 0.20 And threat <= 0.30');

      expect(result1.parseComplete).toBe(true);
      expect(result1.ast.type).toBe('and');

      expect(result2.parseComplete).toBe(true);
      expect(result2.ast.type).toBe('and');
    });

    it('should handle whitespace variations', () => {
      const { normalizer } = createNormalizer();

      const result1 = normalizer.parse('valence>=0.35');
      const result2 = normalizer.parse('valence  >=  0.35');
      const result3 = normalizer.parse('  valence >= 0.35  ');

      expect(result1.parseComplete).toBe(true);
      expect(result2.parseComplete).toBe(true);
      expect(result3.parseComplete).toBe(true);
    });

    it('should return error for empty string', () => {
      const { normalizer } = createNormalizer();

      const result = normalizer.parse('');

      expect(result.parseComplete).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should return error for invalid gate format', () => {
      const { normalizer } = createNormalizer();

      const result = normalizer.parse('invalid gate');

      expect(result.parseComplete).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('parse - Array Format', () => {
    it('should parse array of string gates', () => {
      const { normalizer } = createNormalizer();

      const result = normalizer.parse([
        'valence >= 0.20',
        'threat <= 0.30',
      ]);

      expect(result.parseComplete).toBe(true);
      expect(result.ast.type).toBe('and');
      expect(result.ast.children).toHaveLength(2);
    });

    it('should parse array of object gates with axis/op/value', () => {
      const { normalizer } = createNormalizer();

      const result = normalizer.parse([
        { axis: 'valence', op: '>=', value: 0.20 },
        { axis: 'threat', op: '<=', value: 0.30 },
      ]);

      expect(result.parseComplete).toBe(true);
      expect(result.ast.type).toBe('and');
      expect(result.ast.children[0].axis).toBe('valence');
      expect(result.ast.children[1].axis).toBe('threat');
    });

    it('should parse array with operator/threshold properties', () => {
      const { normalizer } = createNormalizer();

      const result = normalizer.parse([
        { axis: 'valence', operator: '>=', threshold: 0.20 },
      ]);

      expect(result.parseComplete).toBe(true);
      expect(result.ast.type).toBe('comparison');
      expect(result.ast.threshold).toBe(0.2);
    });

    it('should return null for empty array', () => {
      const { normalizer } = createNormalizer();

      const result = normalizer.parse([]);

      expect(result.parseComplete).toBe(true);
      expect(result.ast).toBeNull();
    });

    it('should return single AST for single-element array', () => {
      const { normalizer } = createNormalizer();

      const result = normalizer.parse(['valence >= 0.20']);

      expect(result.parseComplete).toBe(true);
      expect(result.ast.type).toBe('comparison');
    });
  });

  describe('parse - JSON-Logic Format', () => {
    it('should parse JSON-Logic comparison with var', () => {
      const { normalizer } = createNormalizer();

      const result = normalizer.parse({
        '>=': [{ var: 'valence' }, 0.5],
      });

      expect(result.parseComplete).toBe(true);
      expect(result.ast).toEqual({
        type: 'comparison',
        axis: 'valence',
        operator: '>=',
        threshold: 0.5,
      });
    });

    it('should parse JSON-Logic comparison with value first', () => {
      const { normalizer } = createNormalizer();

      const result = normalizer.parse({
        '>=': [0.5, { var: 'valence' }],
      });

      expect(result.parseComplete).toBe(true);
      expect(result.ast.operator).toBe('<='); // Flipped
      expect(result.ast.threshold).toBe(0.5);
    });

    it('should parse JSON-Logic AND expression', () => {
      const { normalizer } = createNormalizer();

      const result = normalizer.parse({
        and: [
          { '>=': [{ var: 'valence' }, 0.5] },
          { '<=': [{ var: 'threat' }, 0.3] },
        ],
      });

      expect(result.parseComplete).toBe(true);
      expect(result.ast.type).toBe('and');
      expect(result.ast.children).toHaveLength(2);
    });

    it('should parse JSON-Logic OR expression', () => {
      const { normalizer } = createNormalizer();

      const result = normalizer.parse({
        or: [
          { '>=': [{ var: 'valence' }, 0.5] },
          { '>=': [{ var: 'arousal' }, 0.5] },
        ],
      });

      expect(result.parseComplete).toBe(true);
      expect(result.ast.type).toBe('or');
    });

    it('should parse JSON-Logic NOT expression', () => {
      const { normalizer } = createNormalizer();

      const result = normalizer.parse({
        '!': { '>=': [{ var: 'threat' }, 0.5] },
      });

      expect(result.parseComplete).toBe(true);
      expect(result.ast.type).toBe('not');
      expect(result.ast.operand.type).toBe('comparison');
    });

    it('should handle nested JSON-Logic expressions', () => {
      const { normalizer } = createNormalizer();

      const result = normalizer.parse({
        and: [
          { '>=': [{ var: 'valence' }, 0.5] },
          {
            or: [
              { '>=': [{ var: 'arousal' }, 0.3] },
              { '<': [{ var: 'threat' }, 0.2] },
            ],
          },
        ],
      });

      expect(result.parseComplete).toBe(true);
      expect(result.ast.type).toBe('and');
      expect(result.ast.children[1].type).toBe('or');
    });
  });

  describe('parse - Error Handling', () => {
    it('should handle null input', () => {
      const { normalizer } = createNormalizer();

      const result = normalizer.parse(null);

      expect(result.parseComplete).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should handle undefined input', () => {
      const { normalizer } = createNormalizer();

      const result = normalizer.parse(undefined);

      expect(result.parseComplete).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should collect multiple errors from array parsing', () => {
      const { normalizer } = createNormalizer();

      const result = normalizer.parse([
        'valid >= 0.5',
        'invalid gate format',
        'another invalid',
      ]);

      expect(result.parseComplete).toBe(false);
      expect(result.errors.length).toBe(2);
    });
  });

  describe('toString', () => {
    it('should convert comparison AST to string', () => {
      const { normalizer } = createNormalizer();

      const ast = {
        type: 'comparison',
        axis: 'valence',
        operator: '>=',
        threshold: 0.35,
      };

      expect(normalizer.toString(ast)).toBe('valence >= 0.35');
    });

    it('should convert AND AST to string', () => {
      const { normalizer } = createNormalizer();

      const ast = {
        type: 'and',
        children: [
          { type: 'comparison', axis: 'valence', operator: '>=', threshold: 0.2 },
          { type: 'comparison', axis: 'threat', operator: '<=', threshold: 0.3 },
        ],
      };

      expect(normalizer.toString(ast)).toBe('valence >= 0.2 AND threat <= 0.3');
    });

    it('should convert OR AST to string', () => {
      const { normalizer } = createNormalizer();

      const ast = {
        type: 'or',
        children: [
          { type: 'comparison', axis: 'valence', operator: '>=', threshold: 0.5 },
          { type: 'comparison', axis: 'arousal', operator: '>=', threshold: 0.5 },
        ],
      };

      expect(normalizer.toString(ast)).toBe('valence >= 0.5 OR arousal >= 0.5');
    });

    it('should wrap nested OR in AND for clarity', () => {
      const { normalizer } = createNormalizer();

      const ast = {
        type: 'and',
        children: [
          { type: 'comparison', axis: 'valence', operator: '>=', threshold: 0.5 },
          {
            type: 'or',
            children: [
              { type: 'comparison', axis: 'arousal', operator: '>=', threshold: 0.3 },
              { type: 'comparison', axis: 'threat', operator: '<', threshold: 0.2 },
            ],
          },
        ],
      };

      expect(normalizer.toString(ast)).toBe(
        'valence >= 0.5 AND (arousal >= 0.3 OR threat < 0.2)'
      );
    });

    it('should handle null AST', () => {
      const { normalizer } = createNormalizer();

      expect(normalizer.toString(null)).toBe('true');
    });

    it('should handle NOT AST', () => {
      const { normalizer } = createNormalizer();

      const ast = {
        type: 'not',
        operand: { type: 'comparison', axis: 'threat', operator: '>=', threshold: 0.5 },
      };

      expect(normalizer.toString(ast)).toBe('NOT (threat >= 0.5)');
    });
  });

  describe('evaluate', () => {
    it('should evaluate comparison correctly', () => {
      const { normalizer } = createNormalizer();

      const ast = {
        type: 'comparison',
        axis: 'valence',
        operator: '>=',
        threshold: 0.35,
      };

      expect(normalizer.evaluate(ast, { valence: 0.5 })).toBe(true);
      expect(normalizer.evaluate(ast, { valence: 0.3 })).toBe(false);
      expect(normalizer.evaluate(ast, { valence: 0.35 })).toBe(true);
    });

    it('should evaluate all comparison operators', () => {
      const { normalizer } = createNormalizer();

      const context = { val: 0.5 };

      expect(normalizer.evaluate({ type: 'comparison', axis: 'val', operator: '>=', threshold: 0.5 }, context)).toBe(true);
      expect(normalizer.evaluate({ type: 'comparison', axis: 'val', operator: '>', threshold: 0.5 }, context)).toBe(false);
      expect(normalizer.evaluate({ type: 'comparison', axis: 'val', operator: '<=', threshold: 0.5 }, context)).toBe(true);
      expect(normalizer.evaluate({ type: 'comparison', axis: 'val', operator: '<', threshold: 0.5 }, context)).toBe(false);
      expect(normalizer.evaluate({ type: 'comparison', axis: 'val', operator: '==', threshold: 0.5 }, context)).toBe(true);
      expect(normalizer.evaluate({ type: 'comparison', axis: 'val', operator: '!=', threshold: 0.5 }, context)).toBe(false);
    });

    it('should evaluate AND correctly', () => {
      const { normalizer } = createNormalizer();

      const ast = {
        type: 'and',
        children: [
          { type: 'comparison', axis: 'valence', operator: '>=', threshold: 0.2 },
          { type: 'comparison', axis: 'threat', operator: '<=', threshold: 0.3 },
        ],
      };

      expect(normalizer.evaluate(ast, { valence: 0.5, threat: 0.1 })).toBe(true);
      expect(normalizer.evaluate(ast, { valence: 0.5, threat: 0.5 })).toBe(false);
      expect(normalizer.evaluate(ast, { valence: 0.1, threat: 0.1 })).toBe(false);
    });

    it('should evaluate OR correctly', () => {
      const { normalizer } = createNormalizer();

      const ast = {
        type: 'or',
        children: [
          { type: 'comparison', axis: 'valence', operator: '>=', threshold: 0.5 },
          { type: 'comparison', axis: 'arousal', operator: '>=', threshold: 0.5 },
        ],
      };

      expect(normalizer.evaluate(ast, { valence: 0.6, arousal: 0.3 })).toBe(true);
      expect(normalizer.evaluate(ast, { valence: 0.3, arousal: 0.6 })).toBe(true);
      expect(normalizer.evaluate(ast, { valence: 0.6, arousal: 0.6 })).toBe(true);
      expect(normalizer.evaluate(ast, { valence: 0.3, arousal: 0.3 })).toBe(false);
    });

    it('should evaluate NOT correctly', () => {
      const { normalizer } = createNormalizer();

      const ast = {
        type: 'not',
        operand: { type: 'comparison', axis: 'threat', operator: '>=', threshold: 0.5 },
      };

      expect(normalizer.evaluate(ast, { threat: 0.3 })).toBe(true);
      expect(normalizer.evaluate(ast, { threat: 0.7 })).toBe(false);
    });

    it('should treat missing axis as unconstrained (true)', () => {
      const { normalizer } = createNormalizer();

      const ast = {
        type: 'comparison',
        axis: 'valence',
        operator: '>=',
        threshold: 0.35,
      };

      expect(normalizer.evaluate(ast, {})).toBe(true);
    });

    it('should handle null AST (always true)', () => {
      const { normalizer } = createNormalizer();

      expect(normalizer.evaluate(null, { valence: 0.5 })).toBe(true);
    });
  });

  describe('normalize', () => {
    it('should return comparison unchanged', () => {
      const { normalizer } = createNormalizer();

      const ast = {
        type: 'comparison',
        axis: 'valence',
        operator: '>=',
        threshold: 0.35,
      };

      const normalized = normalizer.normalize(ast);

      expect(normalized).toEqual(ast);
    });

    it('should flatten nested AND', () => {
      const { normalizer } = createNormalizer();

      const ast = {
        type: 'and',
        children: [
          { type: 'comparison', axis: 'a', operator: '>=', threshold: 0.1 },
          {
            type: 'and',
            children: [
              { type: 'comparison', axis: 'b', operator: '>=', threshold: 0.2 },
              { type: 'comparison', axis: 'c', operator: '>=', threshold: 0.3 },
            ],
          },
        ],
      };

      const normalized = normalizer.normalize(ast);

      expect(normalized.type).toBe('and');
      expect(normalized.children).toHaveLength(3);
    });

    it('should deduplicate identical constraints', () => {
      const { normalizer } = createNormalizer();

      const ast = {
        type: 'and',
        children: [
          { type: 'comparison', axis: 'valence', operator: '>=', threshold: 0.5 },
          { type: 'comparison', axis: 'valence', operator: '>=', threshold: 0.5 },
        ],
      };

      const normalized = normalizer.normalize(ast);

      expect(normalized.type).toBe('comparison');
    });

    it('should sort children alphabetically by axis', () => {
      const { normalizer } = createNormalizer();

      const ast = {
        type: 'and',
        children: [
          { type: 'comparison', axis: 'threat', operator: '>=', threshold: 0.1 },
          { type: 'comparison', axis: 'arousal', operator: '>=', threshold: 0.2 },
          { type: 'comparison', axis: 'valence', operator: '>=', threshold: 0.3 },
        ],
      };

      const normalized = normalizer.normalize(ast);

      expect(normalized.children[0].axis).toBe('arousal');
      expect(normalized.children[1].axis).toBe('threat');
      expect(normalized.children[2].axis).toBe('valence');
    });

    it('should handle null AST', () => {
      const { normalizer } = createNormalizer();

      expect(normalizer.normalize(null)).toBeNull();
    });

    it('should simplify single-child AND', () => {
      const { normalizer } = createNormalizer();

      const ast = {
        type: 'and',
        children: [
          { type: 'comparison', axis: 'valence', operator: '>=', threshold: 0.5 },
        ],
      };

      const normalized = normalizer.normalize(ast);

      expect(normalized.type).toBe('comparison');
    });
  });

  describe('checkImplication', () => {
    it('should detect A implies B when A is narrower', () => {
      const { normalizer } = createNormalizer();

      // A: valence >= 0.5 (narrower)
      // B: valence >= 0.3 (wider)
      const astA = { type: 'comparison', axis: 'valence', operator: '>=', threshold: 0.5 };
      const astB = { type: 'comparison', axis: 'valence', operator: '>=', threshold: 0.3 };

      const result = normalizer.checkImplication(astA, astB);

      expect(result.implies).toBe(true);
      expect(result.isVacuous).toBe(false);
    });

    it('should not detect implication when A is wider', () => {
      const { normalizer } = createNormalizer();

      // A: valence >= 0.3 (wider)
      // B: valence >= 0.5 (narrower)
      const astA = { type: 'comparison', axis: 'valence', operator: '>=', threshold: 0.3 };
      const astB = { type: 'comparison', axis: 'valence', operator: '>=', threshold: 0.5 };

      const result = normalizer.checkImplication(astA, astB);

      expect(result.implies).toBe(false);
    });

    it('should detect implication with upper bounds', () => {
      const { normalizer } = createNormalizer();

      // A: threat <= 0.2 (narrower)
      // B: threat <= 0.5 (wider)
      const astA = { type: 'comparison', axis: 'threat', operator: '<=', threshold: 0.2 };
      const astB = { type: 'comparison', axis: 'threat', operator: '<=', threshold: 0.5 };

      const result = normalizer.checkImplication(astA, astB);

      expect(result.implies).toBe(true);
    });

    it('should handle compound AND constraints', () => {
      const { normalizer } = createNormalizer();

      // A: valence >= 0.5 AND threat <= 0.2
      // B: valence >= 0.3 AND threat <= 0.5
      const astA = {
        type: 'and',
        children: [
          { type: 'comparison', axis: 'valence', operator: '>=', threshold: 0.5 },
          { type: 'comparison', axis: 'threat', operator: '<=', threshold: 0.2 },
        ],
      };
      const astB = {
        type: 'and',
        children: [
          { type: 'comparison', axis: 'valence', operator: '>=', threshold: 0.3 },
          { type: 'comparison', axis: 'threat', operator: '<=', threshold: 0.5 },
        ],
      };

      const result = normalizer.checkImplication(astA, astB);

      expect(result.implies).toBe(true);
    });

    it('should handle null A (vacuous)', () => {
      const { normalizer } = createNormalizer();

      const astB = { type: 'comparison', axis: 'valence', operator: '>=', threshold: 0.5 };

      const result = normalizer.checkImplication(null, astB);

      expect(result.implies).toBe(false);
      expect(result.isVacuous).toBe(true);
    });

    it('should handle null B (always implied)', () => {
      const { normalizer } = createNormalizer();

      const astA = { type: 'comparison', axis: 'valence', operator: '>=', threshold: 0.5 };

      const result = normalizer.checkImplication(astA, null);

      expect(result.implies).toBe(true);
      expect(result.isVacuous).toBe(true);
    });

    it('should handle both null (mutual vacuous)', () => {
      const { normalizer } = createNormalizer();

      const result = normalizer.checkImplication(null, null);

      expect(result.implies).toBe(true);
      expect(result.isVacuous).toBe(true);
    });

    it('should not imply when A has no constraint on B axis', () => {
      const { normalizer } = createNormalizer();

      // A: valence >= 0.5 (no threat constraint)
      // B: threat <= 0.3
      const astA = { type: 'comparison', axis: 'valence', operator: '>=', threshold: 0.5 };
      const astB = { type: 'comparison', axis: 'threat', operator: '<=', threshold: 0.3 };

      const result = normalizer.checkImplication(astA, astB);

      expect(result.implies).toBe(false);
    });
  });

  describe('Round-trip: parse -> toString', () => {
    it('should round-trip simple gates', () => {
      const { normalizer } = createNormalizer();

      const original = 'valence >= 0.35';
      const result = normalizer.parse(original);
      const reconstructed = normalizer.toString(result.ast);

      expect(reconstructed).toBe(original);
    });

    it('should round-trip compound AND gates', () => {
      const { normalizer } = createNormalizer();

      const original = 'valence >= 0.2 AND threat <= 0.3';
      const result = normalizer.parse(original);
      const reconstructed = normalizer.toString(result.ast);

      expect(reconstructed).toBe(original);
    });
  });

  describe('Integration with real gate patterns', () => {
    it('should parse typical emotion prototype gates', () => {
      const { normalizer } = createNormalizer();

      const gates = [
        'threat <= 0.20',
        'uncertainty <= 0.25',
        'valence >= 0.20',
        'arousal >= 0.30',
      ];

      for (const gate of gates) {
        const result = normalizer.parse(gate);
        expect(result.parseComplete).toBe(true);
        expect(result.ast.type).toBe('comparison');
      }
    });

    it('should parse array of gates as AND', () => {
      const { normalizer } = createNormalizer();

      const gates = [
        'threat <= 0.20',
        'valence >= 0.20',
        'uncertainty <= 0.20',
      ];

      const result = normalizer.parse(gates);

      expect(result.parseComplete).toBe(true);
      expect(result.ast.type).toBe('and');
      expect(result.ast.children).toHaveLength(3);
    });

    it('should evaluate gate array against context', () => {
      const { normalizer } = createNormalizer();

      const result = normalizer.parse([
        'threat <= 0.20',
        'valence >= 0.20',
      ]);

      const satisfied = normalizer.evaluate(result.ast, {
        threat: 0.1,
        valence: 0.5,
      });

      const notSatisfied = normalizer.evaluate(result.ast, {
        threat: 0.5,
        valence: 0.5,
      });

      expect(satisfied).toBe(true);
      expect(notSatisfied).toBe(false);
    });
  });
});
