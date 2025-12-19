/**
 * @file Unit tests for ScopeResolutionError class
 */

import { describe, it, expect } from '@jest/globals';
import { ScopeResolutionError } from '../../../../src/scopeDsl/errors/scopeResolutionError.js';
import BaseError from '../../../../src/errors/baseError.js';

describe('ScopeResolutionError', () => {
  describe('Basic error creation', () => {
    it('should create error with message only', () => {
      const error = new ScopeResolutionError('Scope resolution failed');

      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(BaseError);
      expect(error).toBeInstanceOf(ScopeResolutionError);
      expect(error.message).toBe('Scope resolution failed');
      expect(error.name).toBe('ScopeResolutionError');
    });

    it('should create error with message and empty context', () => {
      const error = new ScopeResolutionError('Scope resolution failed', {});

      expect(error.message).toBe('Scope resolution failed');
      expect(error.context).toEqual({});
    });

    it('should create error with full context', () => {
      const originalError = new Error('Parameter validation failed');
      const context = {
        scopeName: 'personal-space:close_actors',
        phase: 'parameter extraction',
        parameters: {
          contextType: 'object',
          hasActorEntity: true,
          hasActor: false,
        },
        expected: 'Entity instance with id property',
        received: 'Full context object',
        hint: 'Extract actorEntity from context before passing',
        suggestion: 'Use: const actorEntity = context.actorEntity',
        example:
          'const actorEntity = context.actorEntity;\nconst result = scopeEngine.resolve(ast, actorEntity);',
        originalError,
      };

      const error = new ScopeResolutionError(
        'Invalid parameter passed to scope resolver',
        context
      );

      expect(error.message).toBe('Invalid parameter passed to scope resolver');
      expect(error.context.scopeName).toBe('personal-space:close_actors');
      expect(error.context.phase).toBe('parameter extraction');
      expect(error.context.parameters).toEqual({
        contextType: 'object',
        hasActorEntity: true,
        hasActor: false,
      });
      expect(error.context.expected).toBe('Entity instance with id property');
      expect(error.context.received).toBe('Full context object');
      expect(error.context.hint).toBe(
        'Extract actorEntity from context before passing'
      );
      expect(error.context.suggestion).toBe(
        'Use: const actorEntity = context.actorEntity'
      );
      expect(error.context.example).toContain(
        'const actorEntity = context.actorEntity;'
      );
      // Original error should be serialized
      expect(error.context.originalError).toEqual({
        name: 'Error',
        message: 'Parameter validation failed',
        stack: expect.any(String),
      });
    });

    it('should extend Error', () => {
      const error = new ScopeResolutionError('Test error');

      expect(error instanceof Error).toBe(true);
    });

    it('should extend BaseError', () => {
      const error = new ScopeResolutionError('Test error');

      expect(error instanceof BaseError).toBe(true);
    });

    it('should be instance of ScopeResolutionError', () => {
      const error = new ScopeResolutionError('Test error');

      expect(error instanceof ScopeResolutionError).toBe(true);
    });
  });

  describe('Error properties from BaseError', () => {
    it('should have correct error code', () => {
      const error = new ScopeResolutionError('Test message');

      expect(error.code).toBe('SCOPE_RESOLUTION_ERROR');
    });

    it('should have timestamp', () => {
      const error = new ScopeResolutionError('Test message');

      expect(error.timestamp).toBeDefined();
      expect(typeof error.timestamp).toBe('string');
      // Verify it's a valid ISO timestamp
      expect(() => new Date(error.timestamp)).not.toThrow();
    });

    it('should have correlation ID', () => {
      const error = new ScopeResolutionError('Test message');

      expect(error.correlationId).toBeDefined();
      expect(typeof error.correlationId).toBe('string');
      expect(error.correlationId.length).toBeGreaterThan(0);
    });

    it('should return correct severity via getSeverity()', () => {
      const error = new ScopeResolutionError('Test message');

      expect(error.getSeverity()).toBe('error');
      expect(error.severity).toBe('error');
    });

    it('should return correct recoverability via isRecoverable()', () => {
      const error = new ScopeResolutionError('Test message');

      expect(error.isRecoverable()).toBe(false);
      expect(error.recoverable).toBe(false);
    });

    it('should capture stack trace automatically', () => {
      const error = new ScopeResolutionError('Test message');

      expect(error.stack).toBeDefined();
      expect(typeof error.stack).toBe('string');
      expect(error.stack).toContain('ScopeResolutionError');
      expect(error.stack).toContain('Test message');
    });
  });

  describe('toString() override', () => {
    it('should format basic message', () => {
      const error = new ScopeResolutionError('Scope resolution failed');

      const result = error.toString();

      expect(result).toContain('ScopeResolutionError: Scope resolution failed');
    });

    it('should include scope name section', () => {
      const error = new ScopeResolutionError('Scope resolution failed', {
        scopeName: 'personal-space:close_actors_facing_each_other',
      });

      const result = error.toString();

      expect(result).toContain(
        'Scope: personal-space:close_actors_facing_each_other'
      );
    });

    it('should include phase section', () => {
      const error = new ScopeResolutionError('Scope resolution failed', {
        phase: 'parameter extraction',
      });

      const result = error.toString();

      expect(result).toContain('Phase: parameter extraction');
    });

    it('should format parameters object', () => {
      const error = new ScopeResolutionError('Scope resolution failed', {
        parameters: {
          contextType: 'object',
          hasActorEntity: true,
          hasActor: false,
        },
      });

      const result = error.toString();

      expect(result).toContain('Parameters:');
      expect(result).toContain('contextType: object');
      expect(result).toContain('hasActorEntity: true');
      expect(result).toContain('hasActor: false');
    });

    it('should indent nested parameter objects', () => {
      const error = new ScopeResolutionError('Scope resolution failed', {
        parameters: {
          context: {
            actor: 'entity1',
            target: 'entity2',
          },
          options: {
            strict: true,
            verbose: false,
          },
        },
      });

      const result = error.toString();

      expect(result).toContain('Parameters:');
      expect(result).toContain('context:');
      expect(result).toContain('actor: entity1');
      expect(result).toContain('target: entity2');
      expect(result).toContain('options:');
      expect(result).toContain('strict: true');
      expect(result).toContain('verbose: false');
    });

    it('should include expected/received', () => {
      const error = new ScopeResolutionError('Scope resolution failed', {
        expected: 'Entity instance with id property',
        received: 'Full context object with actor, targets properties',
      });

      const result = error.toString();

      expect(result).toContain('Expected: Entity instance with id property');
      expect(result).toContain(
        'Received: Full context object with actor, targets properties'
      );
    });

    it('should include hint with emoji', () => {
      const error = new ScopeResolutionError('Scope resolution failed', {
        hint: 'Extract actorEntity from context before passing to ScopeEngine.resolve()',
      });

      const result = error.toString();

      expect(result).toContain(
        '💡 Hint: Extract actorEntity from context before passing to ScopeEngine.resolve()'
      );
    });

    it('should include suggestion', () => {
      const error = new ScopeResolutionError('Scope resolution failed', {
        suggestion:
          'Use: const actorEntity = context.actorEntity || context.actor',
      });

      const result = error.toString();

      expect(result).toContain(
        'Suggestion: Use: const actorEntity = context.actorEntity || context.actor'
      );
    });

    it('should include multiline example', () => {
      const error = new ScopeResolutionError('Scope resolution failed', {
        example:
          'const actorEntity = context.actorEntity || context.actor;\nconst result = scopeEngine.resolve(scopeData.ast, actorEntity, runtimeCtx);',
      });

      const result = error.toString();

      expect(result).toContain('Example:');
      expect(result).toContain(
        'const actorEntity = context.actorEntity || context.actor;'
      );
      expect(result).toContain(
        'const result = scopeEngine.resolve(scopeData.ast, actorEntity, runtimeCtx);'
      );
    });

    it('should include original error message', () => {
      const originalError = new Error('actorEntity has invalid id property');
      originalError.name = 'ParameterValidationError';
      const error = new ScopeResolutionError('Scope resolution failed', {
        originalError,
      });

      const result = error.toString();

      expect(result).toContain(
        'Original Error: ParameterValidationError: actorEntity has invalid id property'
      );
    });

    it('should include stack trace excerpt', () => {
      const originalError = new Error('Original error');
      const error = new ScopeResolutionError('Scope resolution failed', {
        originalError,
      });

      const result = error.toString();

      expect(result).toContain('Stack Trace:');
      // Should contain some stack trace lines
      expect(
        result.split('\n').filter((line) => line.includes('at ')).length
      ).toBeGreaterThan(0);
    });

    it('should format all sections in correct order', () => {
      const originalError = new Error('Original validation error');
      const error = new ScopeResolutionError(
        'Invalid parameter passed to scope resolver',
        {
          scopeName: 'personal-space:close_actors_facing_each_other',
          phase: 'parameter extraction',
          parameters: {
            contextType: 'object',
            hasActorEntity: true,
            hasActor: false,
            extractedType: 'object',
          },
          expected: 'Entity instance with id property',
          received: 'Full context object with actor, targets properties',
          hint: 'Extract actorEntity from context before passing to ScopeEngine.resolve()',
          suggestion:
            'Use: const actorEntity = context.actorEntity || context.actor',
          example:
            'const actorEntity = context.actorEntity || context.actor;\nconst result = scopeEngine.resolve(scopeData.ast, actorEntity, runtimeCtx);',
          originalError,
        }
      );

      const result = error.toString();

      // Verify order by checking index positions
      const scopeIndex = result.indexOf('Scope:');
      const phaseIndex = result.indexOf('Phase:');
      const parametersIndex = result.indexOf('Parameters:');
      const expectedIndex = result.indexOf('Expected:');
      const receivedIndex = result.indexOf('Received:');
      const hintIndex = result.indexOf('💡 Hint:');
      const suggestionIndex = result.indexOf('Suggestion:');
      const exampleIndex = result.indexOf('Example:');
      const originalErrorIndex = result.indexOf('Original Error:');
      const stackIndex = result.indexOf('Stack Trace:');
      const metadataIndex = result.indexOf('[BaseError metadata]');

      // Verify all sections are present
      expect(scopeIndex).toBeGreaterThan(-1);
      expect(phaseIndex).toBeGreaterThan(-1);
      expect(parametersIndex).toBeGreaterThan(-1);
      expect(expectedIndex).toBeGreaterThan(-1);
      expect(receivedIndex).toBeGreaterThan(-1);
      expect(hintIndex).toBeGreaterThan(-1);
      expect(suggestionIndex).toBeGreaterThan(-1);
      expect(exampleIndex).toBeGreaterThan(-1);
      expect(originalErrorIndex).toBeGreaterThan(-1);
      expect(stackIndex).toBeGreaterThan(-1);
      expect(metadataIndex).toBeGreaterThan(-1);

      // Verify order
      expect(scopeIndex).toBeLessThan(phaseIndex);
      expect(phaseIndex).toBeLessThan(parametersIndex);
      expect(parametersIndex).toBeLessThan(expectedIndex);
      expect(expectedIndex).toBeLessThan(receivedIndex);
      expect(receivedIndex).toBeLessThan(hintIndex);
      expect(hintIndex).toBeLessThan(suggestionIndex);
      expect(suggestionIndex).toBeLessThan(exampleIndex);
      expect(exampleIndex).toBeLessThan(originalErrorIndex);
      expect(originalErrorIndex).toBeLessThan(stackIndex);
      expect(stackIndex).toBeLessThan(metadataIndex);
    });

    it('should handle multiline hints with proper indentation', () => {
      const error = new ScopeResolutionError('Test', {
        hint: 'First line of hint\nSecond line of hint\nThird line of hint',
      });

      const result = error.toString();

      expect(result).toContain('💡 Hint: First line of hint');
      expect(result).toContain('           Second line of hint');
      expect(result).toContain('           Third line of hint');
    });

    it('should handle multiline suggestions with proper indentation', () => {
      const error = new ScopeResolutionError('Test', {
        suggestion: 'First line of suggestion\nSecond line of suggestion',
      });

      const result = error.toString();

      expect(result).toContain('Suggestion: First line of suggestion');
      expect(result).toContain('              Second line of suggestion');
    });

    it('should include BaseError metadata section', () => {
      const error = new ScopeResolutionError('Test error');

      const result = error.toString();

      expect(result).toContain('[BaseError metadata]');
      expect(result).toContain('Code: SCOPE_RESOLUTION_ERROR');
      expect(result).toContain('Severity: error');
      expect(result).toContain('Recoverable: false');
      expect(result).toContain('Timestamp:');
      expect(result).toContain('Correlation ID:');
    });

    it('should handle original error as string', () => {
      const error = new ScopeResolutionError('Test error', {
        originalError:
          'ParameterValidationError: actorEntity has invalid id property',
      });

      const result = error.toString();

      expect(result).toContain(
        'Original Error: ParameterValidationError: actorEntity has invalid id property'
      );
    });

    it('should use own stack trace if original error has no stack', () => {
      const error = new ScopeResolutionError('Test error', {
        originalError: 'Simple error string',
      });

      const result = error.toString();

      expect(result).toContain('Stack Trace:');
      expect(result).toContain('ScopeResolutionError');
    });
  });

  describe('toJSON() inherited from BaseError', () => {
    it('should return serializable object', () => {
      const context = {
        scopeName: 'personal-space:close_actors',
        phase: 'filter evaluation',
        hint: 'Check your filter logic',
      };

      const error = new ScopeResolutionError('Test error', context);
      const json = error.toJSON();

      expect(json).toBeDefined();
      expect(typeof json).toBe('object');
    });

    it('should include name, message, code, context, timestamp, severity, recoverable, correlationId, stack', () => {
      const context = {
        scopeName: 'personal-space:close_actors',
        phase: 'filter evaluation',
        expected: 'boolean result',
        received: 'undefined',
      };

      const error = new ScopeResolutionError('Test error', context);
      const json = error.toJSON();

      expect(json.name).toBe('ScopeResolutionError');
      expect(json.message).toBe('Test error');
      expect(json.code).toBe('SCOPE_RESOLUTION_ERROR');
      expect(json.context).toEqual(context);
      expect(json.timestamp).toBeDefined();
      expect(json.severity).toBe('error');
      expect(json.recoverable).toBe(false);
      expect(json.correlationId).toBeDefined();
      expect(json.stack).toBeDefined();
    });

    it('should not lose data in JSON round-trip', () => {
      const context = {
        scopeName: 'personal-space:close_actors',
        phase: 'parameter extraction',
        parameters: {
          contextType: 'object',
          hasActorEntity: true,
        },
        hint: 'Extract entity first',
        suggestion: 'Use context.actorEntity',
        example: 'const entity = context.actorEntity;',
      };

      const error = new ScopeResolutionError('Test error', context);
      const json = error.toJSON();
      const stringified = JSON.stringify(json);
      const parsed = JSON.parse(stringified);

      expect(parsed.name).toBe('ScopeResolutionError');
      expect(parsed.message).toBe('Test error');
      expect(parsed.code).toBe('SCOPE_RESOLUTION_ERROR');
      expect(parsed.context).toEqual(context);
      expect(parsed.severity).toBe('error');
      expect(parsed.recoverable).toBe(false);
    });
  });

  describe('error preservation', () => {
    it('should preserve original error message in context.originalError', () => {
      const originalError = new Error('Parameter validation failed');
      const error = new ScopeResolutionError('Scope resolution failed', {
        originalError,
      });

      // Error should be serialized to preserve across deep copy
      expect(error.context.originalError).toEqual({
        name: 'Error',
        message: 'Parameter validation failed',
        stack: expect.any(String),
      });
      expect(error.context.originalError.message).toBe(
        'Parameter validation failed'
      );
    });

    it('should preserve original error stack in context', () => {
      const originalError = new Error('Parameter validation failed');
      const error = new ScopeResolutionError('Scope resolution failed', {
        originalError,
      });

      expect(error.context.originalError.stack).toBeDefined();
      expect(typeof error.context.originalError.stack).toBe('string');
      expect(error.context.originalError.stack).toContain(
        'Parameter validation failed'
      );
    });

    it('should maintain error chain', () => {
      const rootError = new Error('Root cause');
      const intermediateError = new ScopeResolutionError('Intermediate error', {
        originalError: rootError,
      });
      const finalError = new ScopeResolutionError('Final error', {
        originalError: intermediateError,
      });

      // Intermediate error is serialized as a ScopeResolutionError instance
      // Since it's a ScopeResolutionError object, it gets serialized differently
      expect(finalError.context.originalError).toEqual({
        name: 'ScopeResolutionError',
        message: 'Intermediate error',
        stack: expect.any(String),
      });

      // The intermediate error's context should contain the root error (serialized)
      expect(intermediateError.context.originalError).toEqual({
        name: 'Error',
        message: 'Root cause',
        stack: expect.any(String),
      });
    });
  });

  describe('context access via BaseError', () => {
    it('should expose context via getContext()', () => {
      const context = {
        scopeName: 'personal-space:close_actors',
        phase: 'filter evaluation',
      };

      const error = new ScopeResolutionError('Test error', context);
      const retrievedContext = error.getContext();

      expect(retrievedContext).toEqual(context);
    });

    it('should return deep copy of context (defensive)', () => {
      const context = {
        scopeName: 'personal-space:close_actors',
        nested: { value: 'original' },
      };

      const error = new ScopeResolutionError('Test error', context);
      const retrievedContext = error.getContext();

      // Modify the retrieved context
      retrievedContext.scopeName = 'modified';
      retrievedContext.nested.value = 'modified';

      // Original error context should be unchanged
      expect(error.context.scopeName).toBe('personal-space:close_actors');
      expect(error.context.nested.value).toBe('original');
    });

    it('should allow reading specific context properties via getContext(key)', () => {
      const context = {
        scopeName: 'personal-space:close_actors',
        phase: 'filter evaluation',
        hint: 'Check your logic',
      };

      const error = new ScopeResolutionError('Test error', context);

      expect(error.getContext('scopeName')).toBe('personal-space:close_actors');
      expect(error.getContext('phase')).toBe('filter evaluation');
      expect(error.getContext('hint')).toBe('Check your logic');
    });

    it('should support addContext() for fluent interface', () => {
      const error = new ScopeResolutionError('Test error', {
        scopeName: 'personal-space:close_actors',
      });

      const result = error.addContext('phase', 'parameter extraction');

      expect(result).toBe(error); // Fluent interface
      expect(error.getContext('phase')).toBe('parameter extraction');
      expect(error.context.phase).toBe('parameter extraction');
    });
  });

  describe('Real-world usage scenarios', () => {
    it('should create comprehensive error for scope resolution failure', () => {
      const originalError = new Error(
        "ParameterValidationError: actorEntity has invalid 'id' property: undefined"
      );
      const error = new ScopeResolutionError(
        'Invalid parameter passed to scope resolver',
        {
          scopeName: 'personal-space:close_actors_facing_each_other',
          phase: 'parameter extraction',
          parameters: {
            contextType: 'object',
            hasActorEntity: true,
            hasActor: false,
            extractedType: 'object',
          },
          expected: 'Entity instance with id property',
          received: 'Full context object with actor, targets properties',
          hint: 'Extract actorEntity from context before passing to ScopeEngine.resolve()',
          suggestion:
            'Use: const actorEntity = context.actorEntity || context.actor',
          example:
            'const actorEntity = context.actorEntity || context.actor;\nconst result = scopeEngine.resolve(scopeData.ast, actorEntity, runtimeCtx);',
          originalError,
        }
      );

      expect(error.message).toBe('Invalid parameter passed to scope resolver');
      expect(error.context.scopeName).toBe(
        'personal-space:close_actors_facing_each_other'
      );
      expect(error.context.phase).toBe('parameter extraction');
      expect(error.severity).toBe('error');
      expect(error.recoverable).toBe(false);

      const formatted = error.toString();
      expect(formatted).toContain(
        'Scope: personal-space:close_actors_facing_each_other'
      );
      expect(formatted).toContain('Phase: parameter extraction');
      expect(formatted).toContain('Parameters:');
      expect(formatted).toContain('💡 Hint:');
      expect(formatted).toContain('Suggestion:');
      expect(formatted).toContain('Example:');
      expect(formatted).toContain('Original Error:');
      expect(formatted).toContain('[BaseError metadata]');
    });

    it('should create helpful error for filter evaluation failure', () => {
      const error = new ScopeResolutionError(
        'Filter evaluation returned invalid result',
        {
          scopeName: 'positioning:actors_sitting_close',
          phase: 'filter evaluation',
          expected: 'boolean or array of entities',
          received: 'null',
          hint: 'Filter must return a boolean (true/false) or an array of entity IDs',
          example: 'return entities.filter(e => e.distance < 2);',
        }
      );

      expect(error.context.scopeName).toBe('positioning:actors_sitting_close');
      expect(error.context.phase).toBe('filter evaluation');

      const formatted = error.toString();
      expect(formatted).toContain('filter evaluation');
      expect(formatted).toContain('boolean or array of entities');
    });

    it('should create detailed error for missing scope', () => {
      const error = new ScopeResolutionError('Scope not found in registry', {
        scopeName: 'custom:nonexistent_scope',
        phase: 'scope lookup',
        hint: 'Make sure the scope is defined in your mod and loaded correctly',
        suggestion: 'Check data/mods/[modId]/scopes/ for scope definitions',
      });

      expect(error.context.scopeName).toBe('custom:nonexistent_scope');
      expect(error.severity).toBe('error');

      const formatted = error.toString();
      expect(formatted).toContain('custom:nonexistent_scope');
      expect(formatted).toContain('scope lookup');
    });
  });
});
