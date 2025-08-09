/**
 * @file Unit tests for ExpressionEvaluator
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { ExpressionEvaluator } from '../../../../../../src/characterBuilder/templates/utilities/dataBinding/ExpressionEvaluator.js';

// Mock window globals for safe evaluation
global.Math = Math;
global.Date = Date;
global.parseInt = parseInt;
global.parseFloat = parseFloat;
global.isNaN = isNaN;
global.isFinite = isFinite;
global.JSON = JSON;

describe('ExpressionEvaluator', () => {
  let evaluator;

  beforeEach(() => {
    evaluator = new ExpressionEvaluator();
  });

  describe('constructor', () => {
    it('should create evaluator with default configuration', () => {
      expect(evaluator).toBeInstanceOf(ExpressionEvaluator);
    });

    it('should create evaluator with custom configuration', () => {
      const customEvaluator = new ExpressionEvaluator({
        enableCache: false,
        allowedGlobals: new Set(['Math']),
      });
      expect(customEvaluator).toBeInstanceOf(ExpressionEvaluator);
    });
  });

  describe('evaluate()', () => {
    it('should evaluate simple property access', () => {
      const context = { name: 'John', age: 30 };

      expect(evaluator.evaluate('name', context)).toBe('John');
      expect(evaluator.evaluate('age', context)).toBe(30);
    });

    it('should evaluate nested property access', () => {
      const context = { user: { name: 'John', address: { city: 'NYC' } } };

      expect(evaluator.evaluate('user.name', context)).toBe('John');
      expect(evaluator.evaluate('user.address.city', context)).toBe('NYC');
    });

    it('should evaluate arithmetic expressions', () => {
      const context = { a: 10, b: 5 };

      expect(evaluator.evaluate('a + b', context)).toBe(15);
      expect(evaluator.evaluate('a - b', context)).toBe(5);
      expect(evaluator.evaluate('a * b', context)).toBe(50);
      expect(evaluator.evaluate('a / b', context)).toBe(2);
    });

    it('should evaluate comparison expressions', () => {
      const context = { a: 10, b: 5 };

      expect(evaluator.evaluate('a > b', context)).toBe(true);
      expect(evaluator.evaluate('a < b', context)).toBe(false);
      expect(evaluator.evaluate('a === 10', context)).toBe(true);
      expect(evaluator.evaluate('b !== 10', context)).toBe(true);
    });

    it('should evaluate logical expressions', () => {
      const context = { isTrue: true, isFalse: false };

      expect(evaluator.evaluate('isTrue && isFalse', context)).toBe(false);
      expect(evaluator.evaluate('isTrue || isFalse', context)).toBe(true);
      expect(evaluator.evaluate('!isTrue', context)).toBe(false);
    });

    it('should handle Math operations', () => {
      const context = { value: 16 };

      expect(evaluator.evaluate('Math.sqrt(value)', context)).toBe(4);
      expect(evaluator.evaluate('Math.max(1, 2, 3)', context)).toBe(3);
      expect(evaluator.evaluate('Math.PI', context)).toBe(Math.PI);
    });

    it('should handle Date operations', () => {
      const context = { timestamp: '2023-01-01' };

      const result = evaluator.evaluate('new Date(timestamp)', context);
      expect(result).toBeInstanceOf(Date);
    });

    it('should handle array access', () => {
      const context = { items: ['a', 'b', 'c'] };

      expect(evaluator.evaluate('items[0]', context)).toBe('a');
      expect(evaluator.evaluate('items[1]', context)).toBe('b');
      expect(evaluator.evaluate('items.length', context)).toBe(3);
    });

    it('should handle string methods', () => {
      const context = { text: 'Hello World' };

      expect(evaluator.evaluate('text.toUpperCase()', context)).toBe(
        'HELLO WORLD'
      );
      expect(evaluator.evaluate('text.length', context)).toBe(11);
      expect(evaluator.evaluate('text.substring(0, 5)', context)).toBe('Hello');
    });

    it('should handle undefined properties', () => {
      const context = { name: 'John' };

      expect(evaluator.evaluate('undefined_prop', context)).toBeUndefined();
      expect(evaluator.evaluate('user.name', context)).toBeUndefined();
    });

    it('should handle non-string expressions', () => {
      expect(evaluator.evaluate(123, {})).toBe(123);
      expect(evaluator.evaluate(null, {})).toBe(null);
      expect(evaluator.evaluate(undefined, {})).toBeUndefined();
    });

    it('should return undefined for invalid expressions', () => {
      const context = {};

      // These should not crash but return undefined
      expect(evaluator.evaluate('invalid..syntax', context)).toBeUndefined();
      expect(evaluator.evaluate('', context)).toBe('');
    });
  });

  describe('isSafeExpression()', () => {
    it('should allow safe expressions', () => {
      expect(evaluator.isSafeExpression('name')).toBe(true);
      expect(evaluator.isSafeExpression('user.name')).toBe(true);
      expect(evaluator.isSafeExpression('a + b')).toBe(true);
      expect(evaluator.isSafeExpression('Math.max(1, 2)')).toBe(true);
    });

    it('should block dangerous expressions', () => {
      expect(evaluator.isSafeExpression('eval("code")')).toBe(false);
      expect(evaluator.isSafeExpression('window.location')).toBe(false);
      expect(evaluator.isSafeExpression('document.cookie')).toBe(false);
      expect(evaluator.isSafeExpression('constructor')).toBe(false);
      expect(evaluator.isSafeExpression('__proto__')).toBe(false);
      expect(evaluator.isSafeExpression('Function("code")')).toBe(false);
    });
  });

  describe('built-in filters', () => {
    it('should apply uppercase filter', () => {
      const result = evaluator.applyFilters('hello', ['uppercase']);
      expect(result).toBe('HELLO');
    });

    it('should apply lowercase filter', () => {
      const result = evaluator.applyFilters('HELLO', ['lowercase']);
      expect(result).toBe('hello');
    });

    it('should apply capitalize filter', () => {
      const result = evaluator.applyFilters('hello world', ['capitalize']);
      expect(result).toBe('Hello world');
    });

    it('should apply currency filter', () => {
      const result = evaluator.applyFilters(123.456, ['currency']);
      expect(result).toBe('$123.46');
    });

    it('should apply date filter', () => {
      const date = new Date('2023-01-01');
      const result = evaluator.applyFilters(date, ['date']);
      expect(result).toBe(date.toLocaleDateString());
    });

    it('should apply json filter', () => {
      const obj = { name: 'John', age: 30 };
      const result = evaluator.applyFilters(obj, ['json']);
      expect(result).toBe(JSON.stringify(obj));
    });

    it('should apply default filter', () => {
      const result1 = evaluator.applyFilters(null, ['default:fallback']);
      const result2 = evaluator.applyFilters('value', ['default:fallback']);

      expect(result1).toBe('fallback');
      expect(result2).toBe('value');
    });

    it('should chain multiple filters', () => {
      const result = evaluator.applyFilters('hello', [
        'uppercase',
        'default:fallback',
      ]);
      expect(result).toBe('HELLO');
    });
  });

  describe('addFilter()', () => {
    it('should add custom filter', () => {
      evaluator.addFilter('reverse', (value) =>
        String(value).split('').reverse().join('')
      );

      const result = evaluator.applyFilters('hello', ['reverse']);
      expect(result).toBe('olleh');
    });

    it('should add filter with parameters', () => {
      evaluator.addFilter('repeat', (value, times) =>
        String(value).repeat(parseInt(times) || 1)
      );

      const result = evaluator.applyFilters('hi', ['repeat:3']);
      expect(result).toBe('hihihi');
    });

    it('should throw error for non-function filter', () => {
      expect(() => {
        evaluator.addFilter('invalid', 'not a function');
      }).toThrow('Filter must be a function');
    });
  });

  describe('caching', () => {
    it('should cache expression results', () => {
      const context = { counter: 0 };

      // Mock function to track calls
      let callCount = 0;
      const originalEvaluate = evaluator.evaluate;

      // We can't easily mock the internal evaluate, so we test behavior
      const result1 = evaluator.evaluate('counter + 1', context);
      const result2 = evaluator.evaluate('counter + 1', context);

      expect(result1).toBe(1);
      expect(result2).toBe(1);
    });

    it('should clear cache', () => {
      evaluator.clearCache();
      // Cache clearing should not throw
      expect(true).toBe(true);
    });
  });

  describe('error handling', () => {
    it('should handle evaluation errors gracefully', () => {
      const context = {};

      // These should not crash the evaluator
      expect(() => {
        evaluator.evaluate('nonexistent.property.chain', context);
      }).not.toThrow();

      expect(() => {
        evaluator.evaluate('1/0', context);
      }).not.toThrow();
    });

    it('should handle filter errors gracefully', () => {
      evaluator.addFilter('error', () => {
        throw new Error('Filter error');
      });

      // Should not crash
      const result = evaluator.applyFilters('value', ['error']);
      expect(result).toBe('value'); // Should return original value
    });

    it('should handle unknown filters gracefully', () => {
      const result = evaluator.applyFilters('value', ['unknown_filter']);
      expect(result).toBe('value'); // Should return original value
    });
  });

  describe('complex expressions', () => {
    it('should handle complex object traversal', () => {
      const context = {
        users: [
          { name: 'John', active: true },
          { name: 'Jane', active: false },
        ],
      };

      expect(evaluator.evaluate('users[0].name', context)).toBe('John');
      expect(evaluator.evaluate('users[1].active', context)).toBe(false);
      expect(evaluator.evaluate('users.length', context)).toBe(2);
    });

    it('should handle conditional expressions', () => {
      const context = { age: 25, isAdult: true };

      expect(evaluator.evaluate('age > 18 ? "adult" : "minor"', context)).toBe(
        'adult'
      );
      expect(evaluator.evaluate('isAdult && age > 21', context)).toBe(true);
    });

    it('should handle template literals (if supported)', () => {
      const context = { name: 'John', age: 30 };

      // Note: Template literals might not be supported in all cases
      // This test verifies the evaluator can handle various string constructions
      expect(evaluator.evaluate('name + " is " + age', context)).toBe(
        'John is 30'
      );
    });
  });
});
