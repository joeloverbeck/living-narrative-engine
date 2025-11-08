/**
 * @file Parameter Validator for Scope DSL
 * @description Validates inputs to resolve methods before they are packaged into contexts
 * @see contextValidator.js - Validates internal resolution context structure
 */

import { ParameterValidationError } from '../errors/parameterValidationError.js';

/**
 * Validates parameters passed to scope resolution methods
 * Provides fail-fast validation with context-aware error messages
 *
 * @class ParameterValidator
 */
export class ParameterValidator {
  /**
   * Validates that a value is a valid actor entity instance
   *
   * An actor entity must:
   * - Be an object
   * - Have an 'id' property of type string
   * - Have an id that is not empty or "undefined"
   * - If it has 'components', it must be an object
   *
   * Also detects common mistakes:
   * - Passing action pipeline context (has 'actor' or 'targets' properties)
   * - Passing scope resolution context (has 'runtimeCtx' or 'dispatcher' properties)
   *
   * @param {unknown} value - The value to validate
   * @param {string} source - The source location calling this validation (for error messages)
   * @returns {boolean} True if validation passes
   * @throws {ParameterValidationError} If validation fails
   */
  static validateActorEntity(value, source) {
    // Check if value is an object
    if (!value || typeof value !== 'object') {
      throw new ParameterValidationError(
        `[${source}] actorEntity must be an object, received ${typeof value}`,
        {
          expected: 'Entity instance with id, components properties',
          received: typeof value,
          hint: 'actorEntity must be an entity instance, not a primitive value',
          example:
            'actorEntity = entityManager.getEntity("actor-123") // or { id: "actor-123", components: {...} }',
        }
      );
    }

    // Detect common mistake: passing action pipeline context
    if (value.actor !== undefined || value.targets !== undefined) {
      throw new ParameterValidationError(
        `[${source}] actorEntity received an action pipeline context object instead of entity instance`,
        {
          expected: 'Entity instance with id, components properties',
          received: 'action pipeline context object (has actor/targets)',
          hint: 'actorEntity must be an entity instance, not an action context (with actor/targets) or scope context (with runtimeCtx/dispatcher)',
          example:
            'actorEntity = entityManager.getEntity("actor-123") // or { id: "actor-123", components: {...} }',
        }
      );
    }

    // Detect common mistake: passing scope resolution context
    if (value.runtimeCtx !== undefined || value.dispatcher !== undefined) {
      throw new ParameterValidationError(
        `[${source}] actorEntity received a scope resolution context object instead of entity instance`,
        {
          expected: 'Entity instance with id, components properties',
          received: 'scope resolution context object (has runtimeCtx/dispatcher)',
          hint: 'actorEntity must be an entity instance, not an action context (with actor/targets) or scope context (with runtimeCtx/dispatcher)',
          example:
            'actorEntity = entityManager.getEntity("actor-123") // or { id: "actor-123", components: {...} }',
        }
      );
    }

    // Check for id property
    if (!('id' in value)) {
      throw new ParameterValidationError(
        `[${source}] actorEntity must have an 'id' property`,
        {
          expected: 'Entity instance with id, components properties',
          received: 'object without id property',
          hint: 'actorEntity must have an id property that uniquely identifies the entity',
          example:
            'actorEntity = entityManager.getEntity("actor-123") // or { id: "actor-123", components: {...} }',
        }
      );
    }

    // Check id is a string
    if (typeof value.id !== 'string') {
      throw new ParameterValidationError(
        `[${source}] actorEntity.id must be a string, received ${typeof value.id}`,
        {
          expected: 'Entity instance with id, components properties',
          received: `object with id of type ${typeof value.id}`,
          hint: 'actorEntity.id must be a string identifier',
          example:
            'actorEntity = entityManager.getEntity("actor-123") // or { id: "actor-123", components: {...} }',
        }
      );
    }

    // Check id is not empty
    if (value.id.trim() === '') {
      throw new ParameterValidationError(
        `[${source}] actorEntity.id must not be an empty string`,
        {
          expected: 'Entity instance with id, components properties',
          received: 'object with empty string id',
          hint: 'actorEntity.id must be a non-empty string identifier',
          example:
            'actorEntity = entityManager.getEntity("actor-123") // or { id: "actor-123", components: {...} }',
        }
      );
    }

    // Check id is not the string "undefined"
    if (value.id === 'undefined') {
      throw new ParameterValidationError(
        `[${source}] actorEntity.id must not be the string "undefined"`,
        {
          expected: 'Entity instance with id, components properties',
          received: 'object with id = "undefined"',
          hint: 'actorEntity.id was set to the string "undefined", which suggests an error in entity creation',
          example:
            'actorEntity = entityManager.getEntity("actor-123") // or { id: "actor-123", components: {...} }',
        }
      );
    }

    // If components exists, check it's an object
    if ('components' in value && typeof value.components !== 'object') {
      throw new ParameterValidationError(
        `[${source}] actorEntity.components must be an object if present, received ${typeof value.components}`,
        {
          expected: 'Entity instance with id, components properties',
          received: `object with components of type ${typeof value.components}`,
          hint: 'If actorEntity has a components property, it must be an object',
          example:
            'actorEntity = entityManager.getEntity("actor-123") // or { id: "actor-123", components: {...} }',
        }
      );
    }

    return true;
  }

  /**
   * Validates that a value is a valid runtime context with required services
   *
   * A runtime context must:
   * - Be an object
   * - Have 'entityManager' service
   * - Have 'jsonLogicEval' service
   * - Have 'logger' service
   *
   * Optional properties (not validated):
   * - location, componentRegistry, container, target, targets, etc.
   *
   * @param {unknown} value - The value to validate
   * @param {string} source - The source location calling this validation (for error messages)
   * @returns {boolean} True if validation passes
   * @throws {ParameterValidationError} If validation fails
   */
  static validateRuntimeContext(value, source) {
    // Check if value is an object
    if (!value || typeof value !== 'object') {
      throw new ParameterValidationError(
        `[${source}] runtimeCtx must be an object, received ${typeof value}`,
        {
          expected: 'runtimeCtx with all required services',
          received: typeof value,
          hint: 'Ensure runtimeCtx includes entityManager, jsonLogicEval, and logger',
          example: 'runtimeCtx = { entityManager, jsonLogicEval, logger }',
        }
      );
    }

    // Check for required services
    const requiredServices = ['entityManager', 'jsonLogicEval', 'logger'];
    const missingServices = requiredServices.filter(
      (service) => !(service in value)
    );

    if (missingServices.length > 0) {
      throw new ParameterValidationError(
        `[${source}] runtimeCtx is missing required services: ${missingServices.join(', ')}`,
        {
          expected: 'runtimeCtx with all required services',
          received: `missing: ${missingServices.join(', ')}`,
          hint: 'Ensure runtimeCtx includes entityManager, jsonLogicEval, and logger',
          example: 'runtimeCtx = { entityManager, jsonLogicEval, logger }',
        }
      );
    }

    return true;
  }

  /**
   * Validates that a value is a valid AST node
   *
   * An AST node must:
   * - Be an object
   * - Have a 'type' property (e.g., 'Source', 'Filter', 'Step', 'Union')
   *
   * Note: Source nodes additionally have a 'kind' property, but all nodes must have 'type'
   *
   * @param {unknown} value - The value to validate
   * @param {string} source - The source location calling this validation (for error messages)
   * @returns {boolean} True if validation passes
   * @throws {ParameterValidationError} If validation fails
   */
  static validateAST(value, source) {
    // Check if value is an object
    if (!value || typeof value !== 'object') {
      throw new ParameterValidationError(
        `[${source}] AST must be an object, received ${typeof value}`,
        {
          expected: 'Scope DSL AST object with type property',
          received: typeof value,
          hint: 'AST nodes must specify their type for resolver dispatch (Source, Filter, Step, Union, etc.)',
        }
      );
    }

    // Check for type property
    if (!('type' in value)) {
      throw new ParameterValidationError(
        `[${source}] AST must have a 'type' property`,
        {
          expected: 'Scope DSL AST object with type property',
          received: 'object without type property',
          hint: 'AST nodes must specify their type for resolver dispatch (Source, Filter, Step, Union, etc.)',
        }
      );
    }

    return true;
  }
}

export default ParameterValidator;
