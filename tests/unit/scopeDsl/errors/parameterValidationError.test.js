/**
 * @file Unit tests for ParameterValidationError class
 */

import { describe, it, expect } from '@jest/globals';
import { ParameterValidationError } from '../../../../src/scopeDsl/errors/parameterValidationError.js';
import BaseError from '../../../../src/errors/baseError.js';

describe('ParameterValidationError', () => {
  describe('Basic error creation', () => {
    it('should create error with message only', () => {
      const error = new ParameterValidationError('Test error message');

      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(BaseError);
      expect(error).toBeInstanceOf(ParameterValidationError);
      expect(error.message).toBe('Test error message');
      expect(error.name).toBe('ParameterValidationError');
    });

    it('should create error with message and empty context', () => {
      const error = new ParameterValidationError('Test error message', {});

      expect(error.message).toBe('Test error message');
      expect(error.context).toEqual({});
    });

    it('should create error with full context', () => {
      const context = {
        expected: 'string id property',
        received: 'undefined',
        hint: 'Extract actorEntity from context before calling',
        example: 'const actorEntity = context.actorEntity;'
      };

      const error = new ParameterValidationError('Invalid parameter', context);

      expect(error.message).toBe('Invalid parameter');
      expect(error.context).toEqual(context);
      expect(error.context.expected).toBe('string id property');
      expect(error.context.received).toBe('undefined');
      expect(error.context.hint).toBe('Extract actorEntity from context before calling');
      expect(error.context.example).toBe('const actorEntity = context.actorEntity;');
    });
  });

  describe('Error properties', () => {
    it('should have correct error code', () => {
      const error = new ParameterValidationError('Test message');

      expect(error.code).toBe('PARAMETER_VALIDATION_ERROR');
    });

    it('should return warning severity', () => {
      const error = new ParameterValidationError('Test message');

      expect(error.getSeverity()).toBe('warning');
      expect(error.severity).toBe('warning');
    });

    it('should be recoverable', () => {
      const error = new ParameterValidationError('Test message');

      expect(error.isRecoverable()).toBe(true);
      expect(error.recoverable).toBe(true);
    });

    it('should have timestamp', () => {
      const error = new ParameterValidationError('Test message');

      expect(error.timestamp).toBeDefined();
      expect(typeof error.timestamp).toBe('string');
      // Verify it's a valid ISO timestamp
      expect(() => new Date(error.timestamp)).not.toThrow();
    });

    it('should have correlation ID', () => {
      const error = new ParameterValidationError('Test message');

      expect(error.correlationId).toBeDefined();
      expect(typeof error.correlationId).toBe('string');
      expect(error.correlationId.length).toBeGreaterThan(0);
    });
  });

  describe('Stack trace preservation', () => {
    it('should preserve stack trace', () => {
      const error = new ParameterValidationError('Test message');

      expect(error.stack).toBeDefined();
      expect(typeof error.stack).toBe('string');
      expect(error.stack).toContain('ParameterValidationError');
      expect(error.stack).toContain('Test message');
    });

    it('should have stack trace pointing to error creation location', () => {
      const error = new ParameterValidationError('Test message');

      expect(error.stack).toContain('parameterValidationError.test.js');
    });
  });

  describe('Context property access', () => {
    it('should access context via getter', () => {
      const context = {
        expected: 'object',
        received: 'undefined',
        customProperty: 'custom value'
      };

      const error = new ParameterValidationError('Test message', context);
      const retrievedContext = error.context;

      expect(retrievedContext).toEqual(context);
      expect(retrievedContext.expected).toBe('object');
      expect(retrievedContext.received).toBe('undefined');
      expect(retrievedContext.customProperty).toBe('custom value');
    });

    it('should return deep copy of context to prevent external modification', () => {
      const context = {
        expected: 'object',
        nested: { value: 'original' }
      };

      const error = new ParameterValidationError('Test message', context);
      const retrievedContext = error.context;

      // Modify the retrieved context
      retrievedContext.expected = 'modified';
      retrievedContext.nested.value = 'modified';

      // Original error context should be unchanged
      expect(error.context.expected).toBe('object');
      expect(error.context.nested.value).toBe('original');
    });

    it('should support additional context properties', () => {
      const context = {
        expected: 'string',
        received: 'number',
        parameterName: 'actorEntity',
        functionName: 'resolve'
      };

      const error = new ParameterValidationError('Test message', context);

      expect(error.context.parameterName).toBe('actorEntity');
      expect(error.context.functionName).toBe('resolve');
    });
  });

  describe('instanceof checks', () => {
    it('should be instanceof Error', () => {
      const error = new ParameterValidationError('Test message');

      expect(error instanceof Error).toBe(true);
    });

    it('should be instanceof BaseError', () => {
      const error = new ParameterValidationError('Test message');

      expect(error instanceof BaseError).toBe(true);
    });

    it('should be instanceof ParameterValidationError', () => {
      const error = new ParameterValidationError('Test message');

      expect(error instanceof ParameterValidationError).toBe(true);
    });
  });

  describe('toString() formatting', () => {
    it('should format basic message without context', () => {
      const error = new ParameterValidationError('Invalid parameter');

      const result = error.toString();

      expect(result).toBe('ParameterValidationError: Invalid parameter');
    });

    it('should format message with expected only', () => {
      const error = new ParameterValidationError('Invalid parameter', {
        expected: 'string id property'
      });

      const result = error.toString();

      expect(result).toContain('ParameterValidationError: Invalid parameter');
      expect(result).toContain('Expected: string id property');
    });

    it('should format message with received only', () => {
      const error = new ParameterValidationError('Invalid parameter', {
        received: 'undefined'
      });

      const result = error.toString();

      expect(result).toContain('ParameterValidationError: Invalid parameter');
      expect(result).toContain('Received: undefined');
    });

    it('should format message with hint only', () => {
      const error = new ParameterValidationError('Invalid parameter', {
        hint: 'Extract actorEntity from context'
      });

      const result = error.toString();

      expect(result).toContain('ParameterValidationError: Invalid parameter');
      expect(result).toContain('💡 Hint: Extract actorEntity from context');
    });

    it('should format message with example only', () => {
      const error = new ParameterValidationError('Invalid parameter', {
        example: 'const actorEntity = context.actorEntity;'
      });

      const result = error.toString();

      expect(result).toContain('ParameterValidationError: Invalid parameter');
      expect(result).toContain('Example:');
      expect(result).toContain('const actorEntity = context.actorEntity;');
    });

    it('should format message with all context properties', () => {
      const error = new ParameterValidationError(
        'ScopeEngine.resolve: actorEntity has invalid \'id\' property: undefined',
        {
          expected: 'string id property',
          received: 'undefined',
          hint: 'You appear to have passed the entire context object instead of extracting actorEntity.\nExtract actorEntity from context before calling ScopeEngine.resolve()',
          example: 'const actorEntity = context.actorEntity || context.actor;\nscopeEngine.resolve(ast, actorEntity, runtimeCtx);'
        }
      );

      const result = error.toString();

      expect(result).toContain('ParameterValidationError: ScopeEngine.resolve: actorEntity has invalid \'id\' property: undefined');
      expect(result).toContain('Expected: string id property');
      expect(result).toContain('Received: undefined');
      expect(result).toContain('💡 Hint: You appear to have passed the entire context object');
      expect(result).toContain('Extract actorEntity from context before calling ScopeEngine.resolve()');
      expect(result).toContain('Example:');
      expect(result).toContain('const actorEntity = context.actorEntity || context.actor;');
      expect(result).toContain('scopeEngine.resolve(ast, actorEntity, runtimeCtx);');
    });

    it('should properly indent multi-line hints', () => {
      const error = new ParameterValidationError('Test', {
        hint: 'First line of hint\nSecond line of hint\nThird line of hint'
      });

      const result = error.toString();

      expect(result).toContain('💡 Hint: First line of hint');
      expect(result).toContain('           Second line of hint');
      expect(result).toContain('           Third line of hint');
    });

    it('should properly indent multi-line examples', () => {
      const error = new ParameterValidationError('Test', {
        example: 'const x = 1;\nconst y = 2;\nreturn x + y;'
      });

      const result = error.toString();

      expect(result).toContain('Example:');
      expect(result).toContain('    const x = 1;');
      expect(result).toContain('    const y = 2;');
      expect(result).toContain('    return x + y;');
    });
  });

  describe('toJSON() serialization', () => {
    it('should serialize error to JSON', () => {
      const context = {
        expected: 'string',
        received: 'undefined',
        hint: 'Check your parameters'
      };

      const error = new ParameterValidationError('Test error', context);
      const json = error.toJSON();

      expect(json).toBeDefined();
      expect(json.name).toBe('ParameterValidationError');
      expect(json.message).toBe('Test error');
      expect(json.code).toBe('PARAMETER_VALIDATION_ERROR');
      expect(json.severity).toBe('warning');
      expect(json.recoverable).toBe(true);
    });

    it('should include all context in serialization', () => {
      const context = {
        expected: 'string id property',
        received: 'undefined',
        hint: 'Extract actorEntity from context',
        example: 'const actorEntity = context.actorEntity;',
        customField: 'custom value'
      };

      const error = new ParameterValidationError('Test error', context);
      const json = error.toJSON();

      expect(json.context).toEqual(context);
      expect(json.context.expected).toBe('string id property');
      expect(json.context.received).toBe('undefined');
      expect(json.context.hint).toBe('Extract actorEntity from context');
      expect(json.context.example).toBe('const actorEntity = context.actorEntity;');
      expect(json.context.customField).toBe('custom value');
    });

    it('should include timestamp and correlationId in serialization', () => {
      const error = new ParameterValidationError('Test error');
      const json = error.toJSON();

      expect(json.timestamp).toBeDefined();
      expect(typeof json.timestamp).toBe('string');
      expect(json.correlationId).toBeDefined();
      expect(typeof json.correlationId).toBe('string');
    });

    it('should include stack trace in serialization', () => {
      const error = new ParameterValidationError('Test error');
      const json = error.toJSON();

      expect(json.stack).toBeDefined();
      expect(typeof json.stack).toBe('string');
      expect(json.stack).toContain('ParameterValidationError');
    });
  });

  describe('Error code constant', () => {
    it('should use PARAMETER_VALIDATION_ERROR code', () => {
      const error = new ParameterValidationError('Test');

      expect(error.code).toBe('PARAMETER_VALIDATION_ERROR');
    });

    it('should maintain consistent error code across instances', () => {
      const error1 = new ParameterValidationError('First error');
      const error2 = new ParameterValidationError('Second error');

      expect(error1.code).toBe(error2.code);
      expect(error1.code).toBe('PARAMETER_VALIDATION_ERROR');
    });
  });

  describe('Real-world usage scenarios', () => {
    it('should create helpful error for missing actorEntity.id', () => {
      const error = new ParameterValidationError(
        'ScopeEngine.resolve: actorEntity has invalid \'id\' property: undefined',
        {
          expected: 'string id property',
          received: 'undefined',
          hint: 'You appear to have passed the entire context object instead of extracting actorEntity.\nExtract actorEntity from context before calling ScopeEngine.resolve()',
          example: 'const actorEntity = context.actorEntity || context.actor;\nscopeEngine.resolve(ast, actorEntity, runtimeCtx);'
        }
      );

      expect(error.message).toContain('actorEntity has invalid \'id\' property');
      expect(error.context.expected).toBe('string id property');
      expect(error.context.hint).toContain('passed the entire context object');

      const formatted = error.toString();
      expect(formatted).toContain('💡 Hint:');
      expect(formatted).toContain('Example:');
    });

    it('should create helpful error for invalid AST', () => {
      const error = new ParameterValidationError(
        'Invalid AST: missing required \'type\' property',
        {
          expected: 'AST object with type property',
          received: 'plain object without type',
          hint: 'The AST must be parsed before being passed to the resolver',
          example: 'const ast = scopeParser.parse(dslExpression);\nconst result = scopeEngine.resolve(ast, actorEntity, runtimeCtx);'
        }
      );

      expect(error.message).toContain('Invalid AST');
      expect(error.context.expected).toContain('AST object with type');

      const formatted = error.toString();
      expect(formatted).toContain('scopeParser.parse');
    });

    it('should create helpful error for missing runtime context', () => {
      const error = new ParameterValidationError(
        'Runtime context is required but was not provided',
        {
          expected: 'object with required runtime properties',
          received: 'undefined',
          hint: 'Runtime context must include entityManager, eventBus, and other required services',
          example: 'const runtimeCtx = {\n  entityManager,\n  eventBus,\n  logger\n};\nscopeEngine.resolve(ast, actorEntity, runtimeCtx);'
        }
      );

      expect(error.context.hint).toContain('Runtime context must include');

      const formatted = error.toString();
      expect(formatted).toContain('entityManager');
      expect(formatted).toContain('eventBus');
    });
  });
});
