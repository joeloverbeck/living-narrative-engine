import errorFactory from '../../../../src/scopeDsl/core/errorFactory.js';
import { ScopeDslError } from '../../../../src/scopeDsl/errors/scopeDslError.js';
import ScopeDslErrorHandler from '../../../../src/scopeDsl/core/scopeDslErrorHandler.js';

describe('errorFactory', () => {
  describe('unknown (regression tests)', () => {
    it('should create ScopeDslError with correct message for simple kind', () => {
      const error = errorFactory.unknown('invalidKind', {
        type: 'Test',
        kind: 'invalidKind',
      });

      expect(error).toBeInstanceOf(ScopeDslError);
      expect(error.message).toBe(
        'Unknown node kind: \'invalidKind\'. Full node: {"type":"Test","kind":"invalidKind"}'
      );
      expect(error.name).toBe('ScopeDslError');
    });

    it('should handle complex node values', () => {
      const complexNode = {
        type: 'Step',
        kind: 'unknownStep',
        param: 'someParam',
        nested: {
          foo: 'bar',
          array: [1, 2, 3],
        },
      };

      const error = errorFactory.unknown('unknownStep', complexNode);

      expect(error).toBeInstanceOf(ScopeDslError);
      expect(error.message).toContain("Unknown node kind: 'unknownStep'");
      expect(error.message).toContain(JSON.stringify(complexNode));
    });

    it('should handle null and undefined values', () => {
      const errorNull = errorFactory.unknown('nullKind', null);
      expect(errorNull.message).toBe(
        "Unknown node kind: 'nullKind'. Full node: null"
      );

      const errorUndefined = errorFactory.unknown('undefinedKind', undefined);
      expect(errorUndefined.message).toBe(
        "Unknown node kind: 'undefinedKind'. Full node: undefined"
      );
    });

    it('should handle circular references in node value', () => {
      const circularNode = { type: 'Test', kind: 'circular' };
      circularNode.self = circularNode;

      // JSON.stringify will throw on circular references
      expect(() => errorFactory.unknown('circular', circularNode)).toThrow();
    });

    it('should handle string values', () => {
      const error = errorFactory.unknown('stringKind', 'just a string');
      expect(error.message).toBe(
        'Unknown node kind: \'stringKind\'. Full node: "just a string"'
      );
    });

    it('should handle number values', () => {
      const error = errorFactory.unknown('numberKind', 42);
      expect(error.message).toBe(
        "Unknown node kind: 'numberKind'. Full node: 42"
      );
    });

    it('should handle boolean values', () => {
      const error = errorFactory.unknown('boolKind', true);
      expect(error.message).toBe(
        "Unknown node kind: 'boolKind'. Full node: true"
      );
    });

    it('should handle array values', () => {
      const error = errorFactory.unknown('arrayKind', ['a', 'b', 'c']);
      expect(error.message).toBe(
        'Unknown node kind: \'arrayKind\'. Full node: ["a","b","c"]'
      );
    });

    it('should escape special characters in kind parameter', () => {
      const error = errorFactory.unknown('kind\'with"quotes', { type: 'Test' });
      expect(error.message).toContain("Unknown node kind: 'kind'with\"quotes'");
    });
  });

  describe('fromTemplate', () => {
    it('should create error from missingContext template with parameters', () => {
      const error = errorFactory.fromTemplate('missingContext', {
        field: 'actor',
        resolver: 'EntityResolver',
      });

      expect(error).toBeInstanceOf(ScopeDslError);
      expect(error.message).toBe(
        'Required context field "actor" is missing for EntityResolver'
      );
    });

    it('should create error from invalidData template with parameters', () => {
      const error = errorFactory.fromTemplate('invalidData', {
        field: 'position',
        expected: 'object',
        actual: 'string',
      });

      expect(error).toBeInstanceOf(ScopeDslError);
      expect(error.message).toBe(
        'Invalid data format in position: expected object, got string'
      );
    });

    it('should create error from resolutionFailure template with parameters', () => {
      const error = errorFactory.fromTemplate('resolutionFailure', {
        path: 'actor.items',
        resolver: 'ItemResolver',
        reason: 'entity not found',
      });

      expect(error).toBeInstanceOf(ScopeDslError);
      expect(error.message).toBe(
        'Failed to resolve actor.items in ItemResolver: entity not found'
      );
    });

    it('should create error from cycleDetected template with parameters', () => {
      const error = errorFactory.fromTemplate('cycleDetected', {
        path: 'actor.followers.leader',
        depth: 5,
      });

      expect(error).toBeInstanceOf(ScopeDslError);
      expect(error.message).toBe(
        'Circular reference detected in actor.followers.leader at depth 5'
      );
    });

    it('should create error from depthExceeded template with parameters', () => {
      const error = errorFactory.fromTemplate('depthExceeded', {
        maxDepth: 10,
        path: 'deeply.nested.property',
      });

      expect(error).toBeInstanceOf(ScopeDslError);
      expect(error.message).toBe(
        'Maximum depth 10 exceeded at deeply.nested.property'
      );
    });

    it('should create error from parseError template with parameters', () => {
      const error = errorFactory.fromTemplate('parseError', {
        source: 'scope expression',
        reason: 'unexpected token',
      });

      expect(error).toBeInstanceOf(ScopeDslError);
      expect(error.message).toBe(
        'Parse error in scope expression: unexpected token'
      );
    });

    it('should create error from configuration template with parameters', () => {
      const error = errorFactory.fromTemplate('configuration', {
        setting: 'maxDepth',
        reason: 'must be positive integer',
      });

      expect(error).toBeInstanceOf(ScopeDslError);
      expect(error.message).toBe(
        'Configuration error in maxDepth: must be positive integer'
      );
    });

    it('should handle unknown template keys gracefully', () => {
      const error = errorFactory.fromTemplate('unknownTemplate', {
        param1: 'value1',
        param2: 'value2',
      });

      expect(error).toBeInstanceOf(ScopeDslError);
      expect(error.message).toBe(
        'Unknown error template: \'unknownTemplate\'. Parameters: {"param1":"value1","param2":"value2"}'
      );
    });

    it('should handle missing parameters by leaving placeholders', () => {
      const error = errorFactory.fromTemplate('missingContext', {
        field: 'actor',
        // resolver parameter missing
      });

      expect(error).toBeInstanceOf(ScopeDslError);
      expect(error.message).toBe(
        'Required context field "actor" is missing for {resolver}'
      );
    });

    it('should handle empty parameters object', () => {
      const error = errorFactory.fromTemplate('missingContext', {});

      expect(error).toBeInstanceOf(ScopeDslError);
      expect(error.message).toBe(
        'Required context field "{field}" is missing for {resolver}'
      );
    });

    it('should handle null and undefined parameters', () => {
      const errorNull = errorFactory.fromTemplate('missingContext', null);
      expect(errorNull.message).toBe(
        'Required context field "{field}" is missing for {resolver}'
      );

      const errorUndefined = errorFactory.fromTemplate(
        'missingContext',
        undefined
      );
      expect(errorUndefined.message).toBe(
        'Required context field "{field}" is missing for {resolver}'
      );
    });
  });

  describe('createForCategory', () => {
    it('should create error with custom message and interpolation', () => {
      const error = errorFactory.createForCategory(
        'invalid_data',
        'Custom error in {component}: {details}',
        {
          component: 'Parser',
          details: 'malformed JSON',
        }
      );

      expect(error).toBeInstanceOf(ScopeDslError);
      expect(error.message).toBe('Custom error in Parser: malformed JSON');
    });

    it('should create error without parameters', () => {
      const error = errorFactory.createForCategory(
        'configuration',
        'Simple error message'
      );

      expect(error).toBeInstanceOf(ScopeDslError);
      expect(error.message).toBe('Simple error message');
    });

    it('should handle missing parameters in custom message', () => {
      const error = errorFactory.createForCategory(
        'invalid_data',
        'Error in {component}: {missing}',
        {
          component: 'Parser',
          // missing parameter not provided
        }
      );

      expect(error).toBeInstanceOf(ScopeDslError);
      expect(error.message).toBe('Error in Parser: {missing}');
    });
  });

  describe('createWithHandler', () => {
    let mockErrorHandler;
    let mockLogger;

    beforeEach(() => {
      mockLogger = {
        error: jest.fn(),
        warn: jest.fn(),
        debug: jest.fn(),
        info: jest.fn(),
      };

      mockErrorHandler = new ScopeDslErrorHandler({
        logger: mockLogger,
        config: { isDevelopment: true },
      });
    });

    it('should use error handler when provided for valid template', () => {
      const context = { actor: 'testActor' };
      const resolverName = 'TestResolver';

      expect(() => {
        errorFactory.createWithHandler(
          'missingContext',
          {
            field: 'location',
            resolver: resolverName,
          },
          context,
          resolverName,
          mockErrorHandler
        );
      }).toThrow(ScopeDslError);

      expect(mockLogger.error).toHaveBeenCalled();
    });

    it('should use error handler for unknown template keys', () => {
      const context = { test: 'data' };
      const resolverName = 'TestResolver';

      expect(() => {
        errorFactory.createWithHandler(
          'unknownTemplate',
          {
            param: 'value',
          },
          context,
          resolverName,
          mockErrorHandler
        );
      }).toThrow(ScopeDslError);

      expect(mockLogger.error).toHaveBeenCalled();
    });

    it('should fallback to fromTemplate when no error handler provided', () => {
      const error = errorFactory.createWithHandler(
        'missingContext',
        {
          field: 'actor',
          resolver: 'TestResolver',
        },
        {},
        'TestResolver',
        null
      );

      expect(error).toBeInstanceOf(ScopeDslError);
      expect(error.message).toBe(
        'Required context field "actor" is missing for TestResolver'
      );
    });

    it('should fallback to fromTemplate when error handler is undefined', () => {
      const error = errorFactory.createWithHandler(
        'invalidData',
        {
          field: 'position',
          expected: 'object',
          actual: 'string',
        },
        {},
        'TestResolver'
      );

      expect(error).toBeInstanceOf(ScopeDslError);
      expect(error.message).toBe(
        'Invalid data format in position: expected object, got string'
      );
    });
  });

  describe('_interpolateMessage (private method behavior)', () => {
    it('should support nested property access', () => {
      const error = errorFactory.fromTemplate('missingContext', {
        field: 'actor.name',
        resolver: 'TestResolver',
      });

      expect(error.message).toBe(
        'Required context field "actor.name" is missing for TestResolver'
      );
    });

    it('should handle nested object parameters', () => {
      const error = errorFactory.createForCategory(
        'test',
        'Error in {config.setting}: {config.reason}',
        {
          config: {
            setting: 'maxDepth',
            reason: 'invalid value',
          },
        }
      );

      expect(error.message).toBe('Error in maxDepth: invalid value');
    });

    it('should handle special values (null, undefined)', () => {
      const error = errorFactory.createForCategory(
        'test',
        'Values: {nullValue}, {undefinedValue}, {stringValue}',
        {
          nullValue: null,
          undefinedValue: undefined,
          stringValue: 'test',
        }
      );

      expect(error.message).toBe('Values: null, undefined, test');
    });

    it('should handle non-string values by JSON stringifying', () => {
      const error = errorFactory.createForCategory(
        'test',
        'Object: {obj}, Array: {arr}, Number: {num}',
        {
          obj: { key: 'value' },
          arr: [1, 2, 3],
          num: 42,
        }
      );

      expect(error.message).toBe(
        'Object: {"key":"value"}, Array: [1,2,3], Number: 42'
      );
    });

    it('should handle circular references in parameter values gracefully', () => {
      const circular = { name: 'test' };
      circular.self = circular;

      const error = errorFactory.createForCategory(
        'test',
        'Circular: {circular}',
        {
          circular: circular,
        }
      );

      // Should fallback to String() conversion when JSON.stringify fails
      expect(error.message).toBe('Circular: [object Object]');
    });
  });
});
