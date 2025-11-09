/**
 * @file Unit tests for ParameterValidator
 * @description Tests validation of scope resolution parameters
 */

import { describe, it, expect } from '@jest/globals';
import { ParameterValidator } from '../../../../src/scopeDsl/core/parameterValidator.js';
import { ParameterValidationError } from '../../../../src/scopeDsl/errors/parameterValidationError.js';

describe('ParameterValidator', () => {
  describe('validateActorEntity', () => {
    describe('valid entities', () => {
      it('should pass for valid entity with id and components', () => {
        const entity = {
          id: 'actor-123',
          components: {
            'core:actor': { name: 'Test Actor' },
          },
        };

        const result = ParameterValidator.validateActorEntity(
          entity,
          'test-source'
        );
        expect(result).toBe(true);
      });

      it('should pass for valid entity with id only', () => {
        const entity = {
          id: 'actor-456',
        };

        const result = ParameterValidator.validateActorEntity(
          entity,
          'test-source'
        );
        expect(result).toBe(true);
      });

      it('should allow extra properties beyond id and components', () => {
        const entity = {
          id: 'actor-789',
          components: { 'core:actor': { name: 'Test' } },
          extraProp1: 'allowed',
          extraProp2: 123,
        };

        const result = ParameterValidator.validateActorEntity(
          entity,
          'test-source'
        );
        expect(result).toBe(true);
      });

      it('should allow missing components property', () => {
        const entity = {
          id: 'actor-123',
          // No components property at all
        };

        const result = ParameterValidator.validateActorEntity(
          entity,
          'test-source'
        );
        expect(result).toBe(true);
      });

      it('should allow null components', () => {
        const entity = {
          id: 'actor-456',
          components: null,
        };

        const result = ParameterValidator.validateActorEntity(
          entity,
          'test-source'
        );
        expect(result).toBe(true);
      });
    });

    describe('invalid values', () => {
      it('should fail for undefined value', () => {
        let error;
        try {
          ParameterValidator.validateActorEntity(undefined, 'test-source');
        } catch (err) {
          error = err;
        }

        expect(error).toBeInstanceOf(ParameterValidationError);
        expect(error.message).toContain('actorEntity must be an object');
        expect(error.context.expected).toBe(
          'Entity instance with id, components properties'
        );
        expect(error.context.received).toBe('undefined');
      });

      it('should fail for null value', () => {
        let error;
        try {
          ParameterValidator.validateActorEntity(null, 'test-source');
        } catch (err) {
          error = err;
        }

        expect(error).toBeInstanceOf(ParameterValidationError);
        expect(error.message).toContain('actorEntity must be an object');
        expect(error.context.received).toBe('object');
      });

      it('should fail for primitive string value', () => {
        let error;
        try {
          ParameterValidator.validateActorEntity('actor-123', 'test-source');
        } catch (err) {
          error = err;
        }

        expect(error).toBeInstanceOf(ParameterValidationError);
        expect(error.message).toContain('actorEntity must be an object');
        expect(error.context.received).toBe('string');
      });

      it('should fail for primitive number value', () => {
        let error;
        try {
          ParameterValidator.validateActorEntity(123, 'test-source');
        } catch (err) {
          error = err;
        }

        expect(error).toBeInstanceOf(ParameterValidationError);
        expect(error.message).toContain('actorEntity must be an object');
        expect(error.context.received).toBe('number');
      });

      it('should fail for primitive boolean value', () => {
        let error;
        try {
          ParameterValidator.validateActorEntity(true, 'test-source');
        } catch (err) {
          error = err;
        }

        expect(error).toBeInstanceOf(ParameterValidationError);
        expect(error.message).toContain('actorEntity must be an object');
        expect(error.context.received).toBe('boolean');
      });

      it('should fail for array value', () => {
        let error;
        try {
          ParameterValidator.validateActorEntity(['actor-123'], 'test-source');
        } catch (err) {
          error = err;
        }

        expect(error).toBeInstanceOf(ParameterValidationError);
        // Arrays pass the typeof check but fail the id property check
        expect(error.message).toContain("must have an 'id' property");
        expect(error.context.received).toBe('object without id property');
      });

      it('should fail for object without id', () => {
        let error;
        try {
          ParameterValidator.validateActorEntity(
            { name: 'Test' },
            'test-source'
          );
        } catch (err) {
          error = err;
        }

        expect(error).toBeInstanceOf(ParameterValidationError);
        expect(error.message).toContain("must have an 'id' property");
        expect(error.context.expected).toBe(
          'Entity instance with id, components properties'
        );
        expect(error.context.received).toBe('object without id property');
      });

      it('should fail for object with null id', () => {
        let error;
        try {
          ParameterValidator.validateActorEntity({ id: null }, 'test-source');
        } catch (err) {
          error = err;
        }

        expect(error).toBeInstanceOf(ParameterValidationError);
        expect(error.message).toContain('actorEntity.id must be a string');
        expect(error.context.received).toContain('object');
      });

      it('should fail for object with undefined id', () => {
        let error;
        try {
          ParameterValidator.validateActorEntity(
            { id: undefined },
            'test-source'
          );
        } catch (err) {
          error = err;
        }

        expect(error).toBeInstanceOf(ParameterValidationError);
        expect(error.message).toContain('actorEntity.id must be a string');
        expect(error.context.received).toContain('undefined');
      });

      it('should fail for object with non-string id', () => {
        let error;
        try {
          ParameterValidator.validateActorEntity({ id: 123 }, 'test-source');
        } catch (err) {
          error = err;
        }

        expect(error).toBeInstanceOf(ParameterValidationError);
        expect(error.message).toContain('actorEntity.id must be a string');
        expect(error.context.received).toContain('number');
      });

      it('should fail for object with empty string id', () => {
        let error;
        try {
          ParameterValidator.validateActorEntity({ id: '   ' }, 'test-source');
        } catch (err) {
          error = err;
        }

        expect(error).toBeInstanceOf(ParameterValidationError);
        expect(error.message).toContain(
          'actorEntity.id must not be an empty string'
        );
        expect(error.context.received).toBe('object with empty string id');
      });

      it('should fail for object with "undefined" string as id', () => {
        let error;
        try {
          ParameterValidator.validateActorEntity(
            { id: 'undefined' },
            'test-source'
          );
        } catch (err) {
          error = err;
        }

        expect(error).toBeInstanceOf(ParameterValidationError);
        expect(error.message).toContain(
          'actorEntity.id must not be the string "undefined"'
        );
        expect(error.context.hint).toContain(
          'set to the string "undefined", which suggests an error in entity creation'
        );
      });

      it('should fail for object with non-object components', () => {
        let error;
        try {
          ParameterValidator.validateActorEntity(
            { id: 'actor-123', components: 'not-an-object' },
            'test-source'
          );
        } catch (err) {
          error = err;
        }

        expect(error).toBeInstanceOf(ParameterValidationError);
        expect(error.message).toContain(
          'actorEntity.components must be an object if present'
        );
        expect(error.context.received).toContain('string');
      });
    });

    describe('context object detection', () => {
      it('should detect action pipeline context object with actor property', () => {
        const actionContext = {
          actor: { id: 'actor-123' },
          targets: [],
        };

        let error;
        try {
          ParameterValidator.validateActorEntity(actionContext, 'test-source');
        } catch (err) {
          error = err;
        }

        expect(error).toBeInstanceOf(ParameterValidationError);
        expect(error.message).toContain(
          'action pipeline context object instead of entity instance'
        );
        expect(error.context.received).toContain('actor/targets');
        expect(error.context.hint).toContain(
          'not an action context (with actor/targets) or scope context (with runtimeCtx/dispatcher)'
        );
      });

      it('should detect action pipeline context object with targets property', () => {
        const actionContext = {
          targets: [{ id: 'target-123' }],
          actionId: 'some-action',
        };

        let error;
        try {
          ParameterValidator.validateActorEntity(actionContext, 'test-source');
        } catch (err) {
          error = err;
        }

        expect(error).toBeInstanceOf(ParameterValidationError);
        expect(error.message).toContain('action pipeline context object');
        expect(error.context.received).toContain('actor/targets');
      });

      it('should detect scope resolution context object with runtimeCtx property', () => {
        const scopeContext = {
          runtimeCtx: { entityManager: {}, logger: {} },
          actorEntity: { id: 'actor-123' },
        };

        let error;
        try {
          ParameterValidator.validateActorEntity(scopeContext, 'test-source');
        } catch (err) {
          error = err;
        }

        expect(error).toBeInstanceOf(ParameterValidationError);
        expect(error.message).toContain(
          'scope resolution context object instead of entity instance'
        );
        expect(error.context.received).toContain('runtimeCtx/dispatcher');
        expect(error.context.hint).toContain(
          'not an action context (with actor/targets) or scope context (with runtimeCtx/dispatcher)'
        );
      });

      it('should detect scope resolution context object with dispatcher property', () => {
        const scopeContext = {
          dispatcher: { resolve: () => {} },
          depth: 0,
        };

        let error;
        try {
          ParameterValidator.validateActorEntity(scopeContext, 'test-source');
        } catch (err) {
          error = err;
        }

        expect(error).toBeInstanceOf(ParameterValidationError);
        expect(error.message).toContain('scope resolution context object');
        expect(error.context.received).toContain('runtimeCtx/dispatcher');
      });
    });
  });

  describe('validateRuntimeContext', () => {
    describe('valid contexts', () => {
      it('should pass for valid runtimeCtx with all required services', () => {
        const runtimeCtx = {
          entityManager: { getEntity: () => {} },
          jsonLogicEval: { apply: () => {} },
          logger: { info: () => {}, warn: () => {}, error: () => {} },
        };

        const result = ParameterValidator.validateRuntimeContext(
          runtimeCtx,
          'test-source'
        );
        expect(result).toBe(true);
      });

      it('should pass when extra properties are present', () => {
        const runtimeCtx = {
          entityManager: { getEntity: () => {} },
          jsonLogicEval: { apply: () => {} },
          logger: { info: () => {} },
          // Extra properties
          location: 'test-location',
          componentRegistry: {},
          container: {},
          target: { id: 'target-123' },
          targets: [],
        };

        const result = ParameterValidator.validateRuntimeContext(
          runtimeCtx,
          'test-source'
        );
        expect(result).toBe(true);
      });
    });

    describe('invalid contexts', () => {
      it('should fail for undefined value', () => {
        let error;
        try {
          ParameterValidator.validateRuntimeContext(undefined, 'test-source');
        } catch (err) {
          error = err;
        }

        expect(error).toBeInstanceOf(ParameterValidationError);
        expect(error.message).toContain('runtimeCtx must be an object');
        expect(error.context.expected).toBe('runtimeCtx with required services');
        expect(error.context.received).toBe('undefined');
      });

      it('should fail for null value', () => {
        let error;
        try {
          ParameterValidator.validateRuntimeContext(null, 'test-source');
        } catch (err) {
          error = err;
        }

        expect(error).toBeInstanceOf(ParameterValidationError);
        expect(error.message).toContain('runtimeCtx must be an object');
        expect(error.context.received).toBe('object');
      });

      it('should fail for primitive string value', () => {
        let error;
        try {
          ParameterValidator.validateRuntimeContext(
            'not-an-object',
            'test-source'
          );
        } catch (err) {
          error = err;
        }

        expect(error).toBeInstanceOf(ParameterValidationError);
        expect(error.message).toContain('runtimeCtx must be an object');
        expect(error.context.received).toBe('string');
      });

      it('should fail for primitive number value', () => {
        let error;
        try {
          ParameterValidator.validateRuntimeContext(123, 'test-source');
        } catch (err) {
          error = err;
        }

        expect(error).toBeInstanceOf(ParameterValidationError);
        expect(error.message).toContain('runtimeCtx must be an object');
        expect(error.context.received).toBe('number');
      });

      it('should fail for missing entityManager', () => {
        const runtimeCtx = {
          jsonLogicEval: { apply: () => {} },
          logger: { info: () => {} },
        };

        let error;
        try {
          ParameterValidator.validateRuntimeContext(runtimeCtx, 'test-source');
        } catch (err) {
          error = err;
        }

        expect(error).toBeInstanceOf(ParameterValidationError);
        expect(error.message).toContain('missing critical services');
        expect(error.message).toContain('entityManager');
        expect(error.context.received).toContain('entityManager');
      });

      it('should pass when jsonLogicEval is missing (optional service)', () => {
        const runtimeCtx = {
          entityManager: { getEntity: () => {} },
          logger: { info: () => {} },
        };

        const result = ParameterValidator.validateRuntimeContext(
          runtimeCtx,
          'test-source'
        );
        expect(result).toBe(true);
      });

      it('should pass when logger is missing (optional service)', () => {
        const runtimeCtx = {
          entityManager: { getEntity: () => {} },
          jsonLogicEval: { apply: () => {} },
        };

        const result = ParameterValidator.validateRuntimeContext(
          runtimeCtx,
          'test-source'
        );
        expect(result).toBe(true);
      });

      it('should pass when both optional services are missing', () => {
        const runtimeCtx = {
          entityManager: { getEntity: () => {} },
        };

        const result = ParameterValidator.validateRuntimeContext(
          runtimeCtx,
          'test-source'
        );
        expect(result).toBe(true);
      });
    });

    describe('error messages', () => {
      it('should include source location in error message', () => {
        let error;
        try {
          ParameterValidator.validateRuntimeContext(
            undefined,
            'MyCustomSource.resolve'
          );
        } catch (err) {
          error = err;
        }

        expect(error).toBeInstanceOf(ParameterValidationError);
        expect(error.message).toContain('[MyCustomSource.resolve]');
      });

      it('should provide example runtimeCtx in error context', () => {
        let error;
        try {
          ParameterValidator.validateRuntimeContext({}, 'test-source');
        } catch (err) {
          error = err;
        }

        expect(error).toBeInstanceOf(ParameterValidationError);
        expect(error.context.example).toBeDefined();
        expect(error.context.example).toContain('entityManager');
      });

      it('should clarify that only entityManager is required', () => {
        let error;
        try {
          ParameterValidator.validateRuntimeContext(
            { jsonLogicEval: {}, logger: {} },
            'test-source'
          );
        } catch (err) {
          error = err;
        }

        expect(error).toBeInstanceOf(ParameterValidationError);
        expect(error.message).toContain('entityManager');
        expect(error.context.hint).toContain('entityManager');
      });

      it('should list missing critical service in error context', () => {
        let error;
        try {
          ParameterValidator.validateRuntimeContext({}, 'test-source');
        } catch (err) {
          error = err;
        }

        expect(error).toBeInstanceOf(ParameterValidationError);
        expect(error.context.received).toContain('entityManager');
      });
    });
  });

  describe('validateAST', () => {
    describe('valid AST nodes', () => {
      it('should pass for valid AST with type property (Source)', () => {
        const ast = {
          type: 'Source',
          kind: 'builtin',
          name: 'self',
        };

        const result = ParameterValidator.validateAST(ast, 'test-source');
        expect(result).toBe(true);
      });

      it('should pass for valid Source AST with both type and kind', () => {
        const ast = {
          type: 'Source',
          kind: 'scope',
          scopeId: 'close_actors',
        };

        const result = ParameterValidator.validateAST(ast, 'test-source');
        expect(result).toBe(true);
      });

      it('should pass for valid Filter AST with type property', () => {
        const ast = {
          type: 'Filter',
          logic: { '==': [{ var: 'name' }, 'Test'] },
        };

        const result = ParameterValidator.validateAST(ast, 'test-source');
        expect(result).toBe(true);
      });

      it('should pass for AST with extra properties beyond type', () => {
        const ast = {
          type: 'Union',
          left: { type: 'Source', kind: 'builtin', name: 'self' },
          right: { type: 'Source', kind: 'builtin', name: 'none' },
          extraProp: 'should be allowed',
        };

        const result = ParameterValidator.validateAST(ast, 'test-source');
        expect(result).toBe(true);
      });
    });

    describe('invalid AST nodes', () => {
      it('should fail for undefined value', () => {
        let error;
        try {
          ParameterValidator.validateAST(undefined, 'test-source');
        } catch (err) {
          error = err;
        }

        expect(error).toBeInstanceOf(ParameterValidationError);
        expect(error.message).toContain('AST must be an object');
        expect(error.context.expected).toBe(
          'Scope DSL AST object with type property'
        );
        expect(error.context.received).toBe('undefined');
      });

      it('should fail for null value', () => {
        let error;
        try {
          ParameterValidator.validateAST(null, 'test-source');
        } catch (err) {
          error = err;
        }

        expect(error).toBeInstanceOf(ParameterValidationError);
        expect(error.message).toContain('AST must be an object');
        expect(error.context.received).toBe('object');
      });

      it('should fail for object without type property', () => {
        let error;
        try {
          ParameterValidator.validateAST({ name: 'test' }, 'test-source');
        } catch (err) {
          error = err;
        }

        expect(error).toBeInstanceOf(ParameterValidationError);
        expect(error.message).toContain("AST must have a 'type' property");
        expect(error.context.expected).toBe(
          'Scope DSL AST object with type property'
        );
        expect(error.context.received).toBe('object without type property');
        expect(error.context.hint).toContain(
          'AST nodes must specify their type for resolver dispatch'
        );
      });

      it('should fail for object with only kind property (missing type)', () => {
        let error;
        try {
          ParameterValidator.validateAST(
            { kind: 'scope', name: 'test' },
            'test-source'
          );
        } catch (err) {
          error = err;
        }

        expect(error).toBeInstanceOf(ParameterValidationError);
        expect(error.message).toContain("AST must have a 'type' property");
        expect(error.context.received).toBe('object without type property');
      });

      it('should fail for primitive string value', () => {
        let error;
        try {
          ParameterValidator.validateAST('not-an-ast', 'test-source');
        } catch (err) {
          error = err;
        }

        expect(error).toBeInstanceOf(ParameterValidationError);
        expect(error.message).toContain('AST must be an object');
        expect(error.context.received).toBe('string');
      });
    });

    describe('error messages', () => {
      it('should include source location in error message', () => {
        let error;
        try {
          ParameterValidator.validateAST(undefined, 'FilterResolver.resolve');
        } catch (err) {
          error = err;
        }

        expect(error).toBeInstanceOf(ParameterValidationError);
        expect(error.message).toContain('[FilterResolver.resolve]');
      });

      it('should indicate type property is required for resolver dispatch', () => {
        let error;
        try {
          ParameterValidator.validateAST({ name: 'test' }, 'test-source');
        } catch (err) {
          error = err;
        }

        expect(error).toBeInstanceOf(ParameterValidationError);
        expect(error.context.hint).toContain('resolver dispatch');
      });

      it('should list valid AST node types in hint', () => {
        let error;
        try {
          ParameterValidator.validateAST({ name: 'test' }, 'test-source');
        } catch (err) {
          error = err;
        }

        expect(error).toBeInstanceOf(ParameterValidationError);
        expect(error.context.hint).toContain('Source');
        expect(error.context.hint).toContain('Filter');
      });
    });
  });
});
