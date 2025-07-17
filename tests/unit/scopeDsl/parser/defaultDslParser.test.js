/**
 * @file Unit tests for DefaultDslParser
 * @description Tests for the default DSL parser implementation
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import DefaultDslParser from '../../../../src/scopeDsl/parser/defaultDslParser.js';
import { IDslParser } from '../../../../src/scopeDsl/IDslParser.js';
import { parseDslExpression } from '../../../../src/scopeDsl/parser/parser.js';

// Mock the parser module
jest.mock('../../../../src/scopeDsl/parser/parser.js', () => ({
  parseDslExpression: jest.fn(),
}));

describe('DefaultDslParser', () => {
  let parser;

  beforeEach(() => {
    jest.clearAllMocks();
    parser = new DefaultDslParser();
  });

  describe('Constructor', () => {
    it('should create an instance of DefaultDslParser', () => {
      expect(parser).toBeInstanceOf(DefaultDslParser);
    });

    it('should extend IDslParser', () => {
      expect(parser).toBeInstanceOf(IDslParser);
    });

    it('should have a parse method', () => {
      expect(typeof parser.parse).toBe('function');
    });
  });

  describe('parse() method', () => {
    it('should call parseDslExpression with the provided expression', () => {
      const testExpression = 'actor.name';
      const expectedResult = { type: 'Source', kind: 'actor' };

      parseDslExpression.mockReturnValue(expectedResult);

      const result = parser.parse(testExpression);

      expect(parseDslExpression).toHaveBeenCalledWith(testExpression);
      expect(parseDslExpression).toHaveBeenCalledTimes(1);
      expect(result).toBe(expectedResult);
    });

    it('should return the result from parseDslExpression', () => {
      const testExpression = 'entities(core:actor)';
      const expectedResult = {
        type: 'Source',
        kind: 'entities',
        param: 'core:actor',
      };

      parseDslExpression.mockReturnValue(expectedResult);

      const result = parser.parse(testExpression);

      expect(result).toEqual(expectedResult);
    });

    it('should handle complex expressions', () => {
      const testExpression =
        'actor.core:position[{ "==": [{ "var": "entity.id" }, "test"] }]';
      const expectedResult = {
        type: 'Filter',
        logic: { '==': [{ var: 'entity.id' }, 'test'] },
        parent: {
          type: 'Step',
          field: 'core:position',
          isArray: false,
          parent: { type: 'Source', kind: 'actor' },
        },
      };

      parseDslExpression.mockReturnValue(expectedResult);

      const result = parser.parse(testExpression);

      expect(result).toEqual(expectedResult);
    });

    it('should handle empty string expressions', () => {
      const testExpression = '';
      const expectedResult = null;

      parseDslExpression.mockReturnValue(expectedResult);

      const result = parser.parse(testExpression);

      expect(parseDslExpression).toHaveBeenCalledWith(testExpression);
      expect(result).toBe(expectedResult);
    });

    it('should handle whitespace-only expressions', () => {
      const testExpression = '   ';
      const expectedResult = null;

      parseDslExpression.mockReturnValue(expectedResult);

      const result = parser.parse(testExpression);

      expect(parseDslExpression).toHaveBeenCalledWith(testExpression);
      expect(result).toBe(expectedResult);
    });
  });

  describe('Error handling', () => {
    it('should propagate errors from parseDslExpression', () => {
      const testExpression = 'invalid.expression';
      const expectedError = new Error('Parse error: Invalid syntax');

      parseDslExpression.mockImplementation(() => {
        throw expectedError;
      });

      expect(() => {
        parser.parse(testExpression);
      }).toThrow(expectedError);

      expect(parseDslExpression).toHaveBeenCalledWith(testExpression);
    });

    it('should propagate syntax errors from parseDslExpression', () => {
      const testExpression = 'actor[';
      const syntaxError = new Error('Syntax error: Unexpected end of input');

      parseDslExpression.mockImplementation(() => {
        throw syntaxError;
      });

      expect(() => {
        parser.parse(testExpression);
      }).toThrow(syntaxError);
    });

    it('should handle null expressions gracefully', () => {
      const testExpression = null;
      const expectedError = new Error('Expression cannot be null');

      parseDslExpression.mockImplementation(() => {
        throw expectedError;
      });

      expect(() => {
        parser.parse(testExpression);
      }).toThrow(expectedError);
    });

    it('should handle undefined expressions gracefully', () => {
      const testExpression = undefined;
      const expectedError = new Error('Expression cannot be undefined');

      parseDslExpression.mockImplementation(() => {
        throw expectedError;
      });

      expect(() => {
        parser.parse(testExpression);
      }).toThrow(expectedError);
    });
  });

  describe('Interface compliance', () => {
    it('should implement the IDslParser interface', () => {
      expect(parser).toBeInstanceOf(IDslParser);
    });

    it('should override the parse method from IDslParser', () => {
      // The parent class throws an error, so our implementation should not
      const testExpression = 'actor';
      parseDslExpression.mockReturnValue({ type: 'Source', kind: 'actor' });

      expect(() => {
        parser.parse(testExpression);
      }).not.toThrow('IDslParser.parse method not implemented.');
    });

    it('should have the same method signature as IDslParser', () => {
      const parseMethod = parser.parse;
      expect(parseMethod.length).toBe(1); // Should accept one parameter
    });
  });

  describe('Integration with parseDslExpression', () => {
    it('should pass through string expressions unchanged', () => {
      const expressions = [
        'actor',
        'location',
        'entities(core:actor)',
        'actor.name',
        'location.exits[]',
        'entities(core:item)[{ "var": "entity.id" }]',
      ];

      expressions.forEach((expr) => {
        parseDslExpression.mockReturnValue({ parsed: expr });

        parser.parse(expr);

        expect(parseDslExpression).toHaveBeenCalledWith(expr);
      });
    });

    it('should delegate all parsing logic to parseDslExpression', () => {
      const testExpression = 'complex.expression.with.multiple.steps';
      const mockResult = { type: 'Complex', result: 'parsed' };

      parseDslExpression.mockReturnValue(mockResult);

      const result = parser.parse(testExpression);

      expect(parseDslExpression).toHaveBeenCalledWith(testExpression);
      expect(result).toBe(mockResult);

      // Verify no additional processing is done
      expect(parseDslExpression).toHaveBeenCalledTimes(1);
    });
  });
});
