/**
 * @file Unit tests for FilterClauseAnalyzer
 * @description Tests the recursive analysis and breakdown of JSON Logic filter expressions.
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { FilterClauseAnalyzer } from '../../../../src/scopeDsl/analysis/filterClauseAnalyzer.js';

describe('FilterClauseAnalyzer', () => {
  let mockLogicEval;

  beforeEach(() => {
    // Mock logic evaluator with evaluate method
    mockLogicEval = {
      evaluate: (logic, context) => {
        // Handle primitives - they evaluate to themselves
        if (
          logic === null ||
          logic === undefined ||
          typeof logic !== 'object'
        ) {
          return logic;
        }

        // Handle arrays - they are data, not logic
        if (Array.isArray(logic)) {
          return logic;
        }

        // Handle empty objects
        if (Object.keys(logic).length === 0) {
          return logic;
        }

        const operator = Object.keys(logic)[0];
        const args = logic[operator];

        switch (operator) {
          case 'var': {
            const varName = typeof args === 'string' ? args : args[0];
            const defaultValue = Array.isArray(args) ? args[1] : undefined;
            return context[varName] ?? defaultValue;
          }
          case '==':
            return (
              mockLogicEval.evaluate(args[0], context) ===
              mockLogicEval.evaluate(args[1], context)
            );
          case '!=':
            return (
              mockLogicEval.evaluate(args[0], context) !==
              mockLogicEval.evaluate(args[1], context)
            );
          case '>':
            return (
              mockLogicEval.evaluate(args[0], context) >
              mockLogicEval.evaluate(args[1], context)
            );
          case '>=':
            return (
              mockLogicEval.evaluate(args[0], context) >=
              mockLogicEval.evaluate(args[1], context)
            );
          case '<':
            return (
              mockLogicEval.evaluate(args[0], context) <
              mockLogicEval.evaluate(args[1], context)
            );
          case '<=':
            return (
              mockLogicEval.evaluate(args[0], context) <=
              mockLogicEval.evaluate(args[1], context)
            );
          case 'in': {
            const value = mockLogicEval.evaluate(args[0], context);
            const array = mockLogicEval.evaluate(args[1], context);
            return Array.isArray(array) && array.includes(value);
          }
          case 'and':
            return args.every((arg) => mockLogicEval.evaluate(arg, context));
          case 'or':
            return args.some((arg) => mockLogicEval.evaluate(arg, context));
          case '!':
          case 'not':
            return !mockLogicEval.evaluate(args, context);
          default:
            return false;
        }
      },
    };
  });

  describe('Simple operators', () => {
    it('should analyze == operator', () => {
      const logic = { '==': [{ var: 'type' }, 'actor'] };
      const context = { type: 'actor' };

      const result = FilterClauseAnalyzer.analyzeFilter(
        logic,
        context,
        mockLogicEval
      );

      expect(result.result).toBe(true);
      expect(result.breakdown).toBeDefined();
      expect(result.breakdown.type).toBe('operator');
      expect(result.breakdown.operator).toBe('==');
      expect(result.breakdown.result).toBe(true);
      expect(result.breakdown.children).toHaveLength(2);
      expect(result.description).toContain('equals');
    });

    it('should analyze != operator', () => {
      const logic = { '!=': [{ var: 'type' }, 'enemy'] };
      const context = { type: 'actor' };

      const result = FilterClauseAnalyzer.analyzeFilter(
        logic,
        context,
        mockLogicEval
      );

      expect(result.result).toBe(true);
      expect(result.breakdown.operator).toBe('!=');
      expect(result.description).toContain('does not equal');
    });

    it('should analyze > operator', () => {
      const logic = { '>': [{ var: 'level' }, 5] };
      const context = { level: 10 };

      const result = FilterClauseAnalyzer.analyzeFilter(
        logic,
        context,
        mockLogicEval
      );

      expect(result.result).toBe(true);
      expect(result.breakdown.operator).toBe('>');
      expect(result.description).toContain('is greater than');
    });

    it('should analyze >= operator', () => {
      const logic = { '>=': [{ var: 'level' }, 5] };
      const context = { level: 5 };

      const result = FilterClauseAnalyzer.analyzeFilter(
        logic,
        context,
        mockLogicEval
      );

      expect(result.result).toBe(true);
      expect(result.breakdown.operator).toBe('>=');
      expect(result.description).toContain('is greater than or equal to');
    });

    it('should analyze < operator', () => {
      const logic = { '<': [{ var: 'level' }, 5] };
      const context = { level: 3 };

      const result = FilterClauseAnalyzer.analyzeFilter(
        logic,
        context,
        mockLogicEval
      );

      expect(result.result).toBe(true);
      expect(result.breakdown.operator).toBe('<');
      expect(result.description).toContain('is less than');
    });

    it('should analyze <= operator', () => {
      const logic = { '<=': [{ var: 'level' }, 5] };
      const context = { level: 5 };

      const result = FilterClauseAnalyzer.analyzeFilter(
        logic,
        context,
        mockLogicEval
      );

      expect(result.result).toBe(true);
      expect(result.breakdown.operator).toBe('<=');
      expect(result.description).toContain('is less than or equal to');
    });

    it('should analyze in operator', () => {
      const logic = { in: [{ var: 'type' }, ['actor', 'npc', 'enemy']] };
      const context = { type: 'actor' };

      const result = FilterClauseAnalyzer.analyzeFilter(
        logic,
        context,
        mockLogicEval
      );

      expect(result.result).toBe(true);
      expect(result.breakdown.operator).toBe('in');
      expect(result.description).toContain('is in');
    });
  });

  describe('Logical operators', () => {
    it('should analyze and operator with all true', () => {
      const logic = {
        and: [
          { '==': [{ var: 'type' }, 'actor'] },
          { '>': [{ var: 'level' }, 5] },
        ],
      };
      const context = { type: 'actor', level: 10 };

      const result = FilterClauseAnalyzer.analyzeFilter(
        logic,
        context,
        mockLogicEval
      );

      expect(result.result).toBe(true);
      expect(result.breakdown.operator).toBe('and');
      expect(result.breakdown.result).toBe(true);
      expect(result.breakdown.children).toHaveLength(2);
      expect(result.breakdown.children[0].result).toBe(true);
      expect(result.breakdown.children[1].result).toBe(true);
      expect(result.description).toContain('All conditions must be true');
    });

    it('should analyze and operator with some false', () => {
      const logic = {
        and: [
          { '==': [{ var: 'type' }, 'actor'] },
          { '>': [{ var: 'level' }, 5] },
        ],
      };
      const context = { type: 'actor', level: 3 };

      const result = FilterClauseAnalyzer.analyzeFilter(
        logic,
        context,
        mockLogicEval
      );

      expect(result.result).toBe(false);
      expect(result.breakdown.operator).toBe('and');
      expect(result.breakdown.result).toBe(false);
      expect(result.breakdown.children[0].result).toBe(true);
      expect(result.breakdown.children[1].result).toBe(false);
    });

    it('should analyze or operator with all false', () => {
      const logic = {
        or: [
          { '==': [{ var: 'type' }, 'enemy'] },
          { '>': [{ var: 'level' }, 10] },
        ],
      };
      const context = { type: 'actor', level: 3 };

      const result = FilterClauseAnalyzer.analyzeFilter(
        logic,
        context,
        mockLogicEval
      );

      expect(result.result).toBe(false);
      expect(result.breakdown.operator).toBe('or');
      expect(result.breakdown.result).toBe(false);
      expect(result.breakdown.children[0].result).toBe(false);
      expect(result.breakdown.children[1].result).toBe(false);
      expect(result.description).toContain(
        'At least one condition must be true'
      );
    });

    it('should analyze or operator with some true', () => {
      const logic = {
        or: [
          { '==': [{ var: 'type' }, 'actor'] },
          { '>': [{ var: 'level' }, 10] },
        ],
      };
      const context = { type: 'actor', level: 3 };

      const result = FilterClauseAnalyzer.analyzeFilter(
        logic,
        context,
        mockLogicEval
      );

      expect(result.result).toBe(true);
      expect(result.breakdown.operator).toBe('or');
      expect(result.breakdown.result).toBe(true);
      expect(result.breakdown.children[0].result).toBe(true);
      expect(result.breakdown.children[1].result).toBe(false);
    });

    it('should analyze ! (not) operator', () => {
      const logic = { '!': { '==': [{ var: 'type' }, 'enemy'] } };
      const context = { type: 'actor' };

      const result = FilterClauseAnalyzer.analyzeFilter(
        logic,
        context,
        mockLogicEval
      );

      expect(result.result).toBe(true);
      expect(result.breakdown.operator).toBe('!');
      expect(result.breakdown.result).toBe(true);
      expect(result.description).toContain('NOT');
    });

    it('should analyze not operator', () => {
      const logic = { not: { '==': [{ var: 'type' }, 'enemy'] } };
      const context = { type: 'actor' };

      const result = FilterClauseAnalyzer.analyzeFilter(
        logic,
        context,
        mockLogicEval
      );

      expect(result.result).toBe(true);
      expect(result.breakdown.operator).toBe('not');
      expect(result.description).toContain('NOT');
    });

    it('should handle not operator with primitive arguments', () => {
      const logic = { '!': 'unexpected truthy value' };
      const context = {};

      const result = FilterClauseAnalyzer.analyzeFilter(
        logic,
        context,
        mockLogicEval
      );

      expect(result.result).toBe(false);
      expect(result.breakdown.operator).toBe('!');
      expect(result.breakdown.children[0]).toMatchObject({
        type: 'value',
        value: 'unexpected truthy value',
      });
      expect(result.description).toBe('NOT (unexpected truthy value)');
    });
  });

  describe('Variable handling', () => {
    it('should resolve var references', () => {
      const logic = { '==': [{ var: 'type' }, 'actor'] };
      const context = { type: 'actor' };

      const result = FilterClauseAnalyzer.analyzeFilter(
        logic,
        context,
        mockLogicEval
      );

      const varNode = result.breakdown.children[0];
      expect(varNode.type).toBe('variable');
      expect(varNode.operator).toBe('var');
      expect(varNode.varName).toBe('type');
      expect(varNode.value).toBe('actor');
    });

    it('should show variable values', () => {
      const logic = { '==': [{ var: 'level' }, 5] };
      const context = { level: 10 };

      const result = FilterClauseAnalyzer.analyzeFilter(
        logic,
        context,
        mockLogicEval
      );

      const varNode = result.breakdown.children[0];
      expect(varNode.value).toBe(10);
      expect(varNode.description).toContain('var("level")');
      expect(varNode.description).toContain('10');
    });

    it('should handle default values', () => {
      const logic = { '==': [{ var: ['missing', 'default'] }, 'default'] };
      const context = {};

      const result = FilterClauseAnalyzer.analyzeFilter(
        logic,
        context,
        mockLogicEval
      );

      const varNode = result.breakdown.children[0];
      expect(varNode.varName).toBe('missing');
      expect(varNode.value).toBe('default');
    });

    it('should track variable paths', () => {
      const logic = { '==': [{ var: 'type' }, 'actor'] };
      const context = { type: 'actor' };

      const result = FilterClauseAnalyzer.analyzeFilter(
        logic,
        context,
        mockLogicEval
      );

      const varNode = result.breakdown.children[0];
      expect(varNode.path).toEqual([0]);
    });

    it('should describe standalone variable clauses', () => {
      const logic = { var: 'type' };
      const context = { type: 'actor' };

      const result = FilterClauseAnalyzer.analyzeFilter(
        logic,
        context,
        mockLogicEval
      );

      expect(result.result).toBe('actor');
      expect(result.breakdown).toMatchObject({
        type: 'variable',
        operator: 'var',
        varName: 'type',
        value: 'actor',
      });
      expect(result.description).toBe('variable "type"');
    });
  });

  describe('Nested conditions', () => {
    it('should analyze nested and/or', () => {
      const logic = {
        and: [
          { '==': [{ var: 'type' }, 'actor'] },
          {
            or: [
              { '>': [{ var: 'level' }, 10] },
              { '==': [{ var: 'role' }, 'admin'] },
            ],
          },
        ],
      };
      const context = { type: 'actor', level: 5, role: 'admin' };

      const result = FilterClauseAnalyzer.analyzeFilter(
        logic,
        context,
        mockLogicEval
      );

      expect(result.result).toBe(true);
      expect(result.breakdown.operator).toBe('and');
      expect(result.breakdown.children).toHaveLength(2);
      expect(result.breakdown.children[1].operator).toBe('or');
      expect(result.breakdown.children[1].children).toHaveLength(2);
    });

    it('should analyze deeply nested conditions', () => {
      const logic = {
        and: [
          {
            or: [{ '==': [{ var: 'a' }, 1] }, { '==': [{ var: 'b' }, 2] }],
          },
          {
            or: [{ '==': [{ var: 'c' }, 3] }, { '==': [{ var: 'd' }, 4] }],
          },
        ],
      };
      const context = { a: 1, b: 0, c: 3, d: 0 };

      const result = FilterClauseAnalyzer.analyzeFilter(
        logic,
        context,
        mockLogicEval
      );

      expect(result.result).toBe(true);
      expect(result.breakdown.children).toHaveLength(2);
      expect(result.breakdown.children[0].children).toHaveLength(2);
      expect(result.breakdown.children[1].children).toHaveLength(2);
    });

    it('should track paths correctly', () => {
      const logic = {
        and: [
          { '==': [{ var: 'type' }, 'actor'] },
          { '>': [{ var: 'level' }, 5] },
        ],
      };
      const context = { type: 'actor', level: 10 };

      const result = FilterClauseAnalyzer.analyzeFilter(
        logic,
        context,
        mockLogicEval
      );

      expect(result.breakdown.path).toEqual([]);
      expect(result.breakdown.children[0].path).toEqual([0]);
      expect(result.breakdown.children[1].path).toEqual([1]);
      expect(result.breakdown.children[0].children[0].path).toEqual([0, 0]);
    });
  });

  describe('Custom operators', () => {
    it('should handle condition_ref operator', () => {
      const logic = { condition_ref: 'core:is_actor' };
      const context = {};

      const result = FilterClauseAnalyzer.analyzeFilter(
        logic,
        context,
        mockLogicEval
      );

      expect(result.description).toContain('condition reference');
      expect(result.description).toContain('core:is_actor');
    });

    it('should handle anatomy operators', () => {
      const logic = {
        hasPartWithComponentValue: [
          'actor',
          'descriptors:build',
          'build',
          'muscular',
        ],
      };
      const context = {};

      const result = FilterClauseAnalyzer.analyzeFilter(
        logic,
        context,
        mockLogicEval
      );

      expect(result.description).toContain('hasPartWithComponentValue');
      expect(result.description).toContain('"actor"');
    });

    it('should format anatomy operators with scalar arguments', () => {
      const logic = { hasPartOfType: 'torso' };
      const context = {};

      const result = FilterClauseAnalyzer.analyzeFilter(
        logic,
        context,
        mockLogicEval
      );

      expect(result.description).toBe('hasPartOfType("torso")');
    });

    it('should format clothing operators with scalar arguments', () => {
      const logic = { isSocketCovered: 'torso' };
      const context = {};

      const result = FilterClauseAnalyzer.analyzeFilter(
        logic,
        context,
        mockLogicEval
      );

      expect(result.description).toBe('isSocketCovered("torso")');
    });

    it('should handle positioning operators', () => {
      const logic = { hasSittingSpaceToRight: ['actor', 'target', 1] };
      const context = {};

      const result = FilterClauseAnalyzer.analyzeFilter(
        logic,
        context,
        mockLogicEval
      );

      expect(result.description).toContain('hasSittingSpaceToRight');
      expect(result.description).toContain('"actor"');
    });

    it('should format positioning operators with scalar arguments', () => {
      const logic = { canScootCloser: 'actor' };
      const context = {};

      const result = FilterClauseAnalyzer.analyzeFilter(
        logic,
        context,
        mockLogicEval
      );

      expect(result.description).toBe('canScootCloser("actor")');
    });

    it('should provide generic descriptions for unknown operators', () => {
      const logic = { unknownOperator: ['arg1', 'arg2'] };
      const context = {};

      const result = FilterClauseAnalyzer.analyzeFilter(
        logic,
        context,
        mockLogicEval
      );

      expect(result.description).toContain('unknownOperator');
      expect(result.description).toContain('"arg1"');
      expect(result.description).toContain('"arg2"');
    });
  });

  describe('Array literal handling', () => {
    it('should treat array literals as values, not operators', () => {
      const logic = {
        in: [{ var: 'status' }, ['active', 'pending', 'approved']],
      };
      const context = { status: 'active' };

      const result = FilterClauseAnalyzer.analyzeFilter(
        logic,
        context,
        mockLogicEval
      );

      expect(result.result).toBe(true);
      expect(result.breakdown.operator).toBe('in');
      expect(result.breakdown.children).toHaveLength(2);

      // Second child should be the array literal treated as a value
      const arrayNode = result.breakdown.children[1];
      expect(arrayNode.type).toBe('value');
      expect(arrayNode.value).toEqual(['active', 'pending', 'approved']);
      expect(arrayNode.path).toEqual([1]);
    });

    it('should preserve entire array, not just first element', () => {
      const logic = {
        in: ['test', ['option1', 'option2', 'option3', 'option4']],
      };
      const context = {};

      const result = FilterClauseAnalyzer.analyzeFilter(
        logic,
        context,
        mockLogicEval
      );

      const arrayNode = result.breakdown.children[1];
      expect(arrayNode.type).toBe('value');
      expect(arrayNode.value).toHaveLength(4);
      expect(arrayNode.value).toEqual([
        'option1',
        'option2',
        'option3',
        'option4',
      ]);
    });

    it('should handle empty arrays as values', () => {
      const logic = { in: ['value', []] };
      const context = {};

      const result = FilterClauseAnalyzer.analyzeFilter(
        logic,
        context,
        mockLogicEval
      );

      const arrayNode = result.breakdown.children[1];
      expect(arrayNode.type).toBe('value');
      expect(arrayNode.value).toEqual([]);
    });

    it('should handle nested arrays as values', () => {
      const logic = { '==': [{ var: 'data' }, [['nested'], ['arrays']]] };
      const context = { data: [['nested'], ['arrays']] };

      const result = FilterClauseAnalyzer.analyzeFilter(
        logic,
        context,
        mockLogicEval
      );

      const arrayNode = result.breakdown.children[1];
      expect(arrayNode.type).toBe('value');
      expect(arrayNode.value).toEqual([['nested'], ['arrays']]);
    });

    it('should handle arrays with mixed types as values', () => {
      const logic = { in: ['test', ['string', 123, true, null]] };
      const context = {};

      const result = FilterClauseAnalyzer.analyzeFilter(
        logic,
        context,
        mockLogicEval
      );

      const arrayNode = result.breakdown.children[1];
      expect(arrayNode.type).toBe('value');
      expect(arrayNode.value).toEqual(['string', 123, true, null]);
    });
  });

  describe('Edge cases', () => {
    it('should handle null/undefined logic', () => {
      const result1 = FilterClauseAnalyzer.analyzeFilter(
        null,
        {},
        mockLogicEval
      );
      expect(result1.result).toBe(false);
      expect(result1.breakdown).toBeNull();
      expect(result1.description).toContain('Empty or invalid logic');

      const result2 = FilterClauseAnalyzer.analyzeFilter(
        undefined,
        {},
        mockLogicEval
      );
      expect(result2.result).toBe(false);
      expect(result2.breakdown).toBeNull();
    });

    it('should handle empty objects', () => {
      const logic = {};
      const context = {};

      const result = FilterClauseAnalyzer.analyzeFilter(
        logic,
        context,
        mockLogicEval
      );

      // Empty object evaluates based on mockLogicEval behavior
      expect(result.breakdown).toBeDefined();
    });

    it('should handle evaluation errors', () => {
      const errorLogicEval = {
        evaluate: () => {
          throw new Error('Evaluation failed');
        },
      };

      const logic = { '==': [{ var: 'type' }, 'actor'] };
      const context = { type: 'actor' };

      const result = FilterClauseAnalyzer.analyzeFilter(
        logic,
        context,
        errorLogicEval
      );

      expect(result.result).toBe(false);
      expect(result.breakdown).toBeNull();
      expect(result.error).toBe('Evaluation failed');
      expect(result.description).toContain('Error evaluating filter');
    });

    it('should handle missing variables', () => {
      const logic = { '==': [{ var: 'missing' }, 'value'] };
      const context = {};

      const result = FilterClauseAnalyzer.analyzeFilter(
        logic,
        context,
        mockLogicEval
      );

      const varNode = result.breakdown.children[0];
      expect(varNode.value).toBeUndefined();
    });
  });

  describe('Description generation', () => {
    it('should generate readable descriptions', () => {
      const logic = {
        and: [
          { '==': [{ var: 'type' }, 'actor'] },
          { '>': [{ var: 'level' }, 5] },
        ],
      };
      const context = { type: 'actor', level: 10 };

      const result = FilterClauseAnalyzer.analyzeFilter(
        logic,
        context,
        mockLogicEval
      );

      expect(result.description).toBe('All conditions must be true');
      expect(result.breakdown.children[0].description).toContain('equals');
      expect(result.breakdown.children[1].description).toContain(
        'is greater than'
      );
    });

    it('should format values correctly - primitives', () => {
      const logic = { '==': ['string', 123] };
      const context = {};

      const result = FilterClauseAnalyzer.analyzeFilter(
        logic,
        context,
        mockLogicEval
      );

      expect(result.description).toContain('"string"');
      expect(result.description).toContain('123');
    });

    it('should format values correctly - arrays', () => {
      const logic = { in: ['value', ['a', 'b', 'c']] };
      const context = {};

      const result = FilterClauseAnalyzer.analyzeFilter(
        logic,
        context,
        mockLogicEval
      );

      expect(result.description).toContain('[');
      expect(result.description).toContain('"a"');
      expect(result.description).toContain('"b"');
      expect(result.description).toContain('"c"');
    });

    it('should format condition references within values', () => {
      const logic = {
        in: ['value', [{ condition_ref: 'core:is_actor' }]],
      };
      const context = {};

      const result = FilterClauseAnalyzer.analyzeFilter(
        logic,
        context,
        mockLogicEval
      );

      expect(result.description).toContain('condition_ref("core:is_actor")');
    });

    it('should stringify object values for descriptions', () => {
      const logic = {
        in: ['value', [{ foo: 'bar', count: 3 }]],
      };
      const context = {};

      const result = FilterClauseAnalyzer.analyzeFilter(
        logic,
        context,
        mockLogicEval
      );

      expect(result.description).toContain('{"foo":"bar","count":3}');
    });

    it('should format values correctly - var references', () => {
      const logic = { '==': [{ var: 'type' }, { var: 'expected' }] };
      const context = { type: 'actor', expected: 'actor' };

      const result = FilterClauseAnalyzer.analyzeFilter(
        logic,
        context,
        mockLogicEval
      );

      expect(result.description).toContain('var("type")');
      expect(result.description).toContain('var("expected")');
    });

    it('should describe complex expressions', () => {
      const logic = {
        and: [
          { '==': [{ var: 'type' }, 'actor'] },
          {
            or: [
              { '>': [{ var: 'level' }, 10] },
              { in: [{ var: 'role' }, ['admin', 'moderator']] },
            ],
          },
        ],
      };
      const context = { type: 'actor', level: 5, role: 'admin' };

      const result = FilterClauseAnalyzer.analyzeFilter(
        logic,
        context,
        mockLogicEval
      );

      expect(result.description).toContain('All conditions must be true');
      expect(result.breakdown.children[1].description).toContain(
        'At least one condition must be true'
      );
    });
  });

  describe('Breakdown structure', () => {
    it('should have correct structure for operator nodes', () => {
      const logic = { '==': [{ var: 'type' }, 'actor'] };
      const context = { type: 'actor' };

      const result = FilterClauseAnalyzer.analyzeFilter(
        logic,
        context,
        mockLogicEval
      );

      expect(result.breakdown).toMatchObject({
        type: 'operator',
        operator: '==',
        result: expect.any(Boolean),
        children: expect.any(Array),
        path: expect.any(Array),
        description: expect.any(String),
      });
    });

    it('should have correct structure for variable nodes', () => {
      const logic = { '==': [{ var: 'type' }, 'actor'] };
      const context = { type: 'actor' };

      const result = FilterClauseAnalyzer.analyzeFilter(
        logic,
        context,
        mockLogicEval
      );

      const varNode = result.breakdown.children[0];
      expect(varNode).toMatchObject({
        type: 'variable',
        operator: 'var',
        varName: expect.any(String),
        value: expect.anything(),
        path: expect.any(Array),
        description: expect.any(String),
      });
    });

    it('should have correct structure for value nodes', () => {
      const logic = { '==': ['literal', { var: 'type' }] };
      const context = { type: 'actor' };

      const result = FilterClauseAnalyzer.analyzeFilter(
        logic,
        context,
        mockLogicEval
      );

      const valueNode = result.breakdown.children[0];
      expect(valueNode).toMatchObject({
        type: 'value',
        value: 'literal',
        path: expect.any(Array),
      });
    });
  });
});
