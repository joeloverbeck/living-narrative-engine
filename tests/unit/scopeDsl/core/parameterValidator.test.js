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
        expect(error.context.expected).toBe(
          'runtimeCtx with all required services'
        );
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
        expect(error.message).toContain('missing required services');
        expect(error.message).toContain('entityManager');
        expect(error.context.received).toContain('entityManager');
      });

      it('should fail for missing jsonLogicEval', () => {
        const runtimeCtx = {
          entityManager: { getEntity: () => {} },
          logger: { info: () => {} },
        };

        let error;
        try {
          ParameterValidator.validateRuntimeContext(runtimeCtx, 'test-source');
        } catch (err) {
          error = err;
        }

        expect(error).toBeInstanceOf(ParameterValidationError);
        expect(error.message).toContain('missing required services');
        expect(error.message).toContain('jsonLogicEval');
        expect(error.context.received).toContain('jsonLogicEval');
      });

      it('should fail for missing logger', () => {
        const runtimeCtx = {
          entityManager: { getEntity: () => {} },
          jsonLogicEval: { apply: () => {} },
        };

        let error;
        try {
          ParameterValidator.validateRuntimeContext(runtimeCtx, 'test-source');
        } catch (err) {
          error = err;
        }

        expect(error).toBeInstanceOf(ParameterValidationError);
        expect(error.message).toContain('missing required services');
        expect(error.message).toContain('logger');
        expect(error.context.received).toContain('logger');
      });

      it('should fail for missing multiple services', () => {
        const runtimeCtx = {
          entityManager: { getEntity: () => {} },
        };

        let error;
        try {
          ParameterValidator.validateRuntimeContext(runtimeCtx, 'test-source');
        } catch (err) {
          error = err;
        }

        expect(error).toBeInstanceOf(ParameterValidationError);
        expect(error.message).toContain('missing required services');
        expect(error.message).toContain('jsonLogicEval');
        expect(error.message).toContain('logger');
        expect(error.context.received).toContain('jsonLogicEval');
        expect(error.context.received).toContain('logger');
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
    });
  });
});
