/**
 * @file EntityConstructionFactory - Handles entity construction and assembly
 * @module EntityConstructionFactory
 */

import Entity from '../entity.js';
import EntityInstanceData from '../entityInstanceData.js';
import { injectDefaultComponents } from '../utils/defaultComponentInjector.js';
import { validateDependency } from '../../utils/dependencyUtils.js';
import { ensureValidLogger } from '../../utils/loggerUtils.js';

/** @typedef {import('../entityDefinition.js').default} EntityDefinition */
/** @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger */

/**
 * @class EntityConstructionFactory
 * @description Specialized factory for entity construction and assembly operations
 */
export default class EntityConstructionFactory {
  /** @type {ILogger} */
  #logger;
  /** @type {Function} */
  #validateAndClone;

  /**
   * @class
   * @param {object} deps - Dependencies
   * @param {ILogger} deps.logger - Logger instance
   * @param {Function} deps.validateAndClone - Validation and cloning function
   */
  constructor({ logger, validateAndClone }) {
    validateDependency(logger, 'ILogger', console, {
      requiredMethods: ['info', 'error', 'warn', 'debug'],
    });
    this.#logger = ensureValidLogger(logger, 'EntityConstructionFactory');

    if (typeof validateAndClone !== 'function') {
      throw new Error('validateAndClone must be a function');
    }
    this.#validateAndClone = validateAndClone;

    this.#logger.debug('EntityConstructionFactory initialized.');
  }

  /**
   * Constructs a complete entity with all components and default injections.
   *
   * @param {EntityDefinition} definition - Entity definition
   * @param {string} instanceId - Entity instance ID
   * @param {Record<string, object|null>} components - Component data
   * @param {string} definitionId - Definition ID for logging context
   * @param {string} action - Description string like "created." or "reconstructed."
   * @returns {Entity} The constructed entity
   */
  constructEntity(definition, instanceId, components, definitionId, action) {
    this.#logger.debug(
      `[EntityConstructionFactory] Constructing entity '${instanceId}' with definition '${definitionId}'`
    );

    const data = this.#createEntityInstanceData(
      instanceId,
      definition,
      components
    );

    const entity = this.#createEntityWrapper(data);

    this.#applyDefaultComponents(entity);

    const completionMessage = `[EntityConstructionFactory] Entity instance '${instanceId}' (def: '${definitionId}') ${action}`;

    this.#logger.debug(completionMessage);

    return entity;
  }

  /**
   * Creates the EntityInstanceData object.
   *
   * @param {string} instanceId - Entity instance ID
   * @param {EntityDefinition} definition - Entity definition
   * @param {Record<string, object|null>} components - Component data
   * @returns {EntityInstanceData} The instance data object
   */
  #createEntityInstanceData(instanceId, definition, components) {
    try {
      return new EntityInstanceData(
        instanceId,
        definition,
        components,
        this.#logger
      );
    } catch (error) {
      this.#logger.error(
        `[EntityConstructionFactory] Failed to create EntityInstanceData for '${instanceId}': ${error.message}`
      );
      throw error;
    }
  }

  /**
   * Creates the Entity wrapper around the instance data.
   *
   * @param {EntityInstanceData} data - Entity instance data
   * @returns {Entity} The entity wrapper
   */
  #createEntityWrapper(data) {
    try {
      return new Entity(data);
    } catch (error) {
      this.#logger.error(
        `[EntityConstructionFactory] Failed to create Entity wrapper: ${error.message}`
      );
      throw error;
    }
  }

  /**
   * Applies default component injections to the entity.
   *
   * @param {Entity} entity - Entity to apply defaults to
   */
  #applyDefaultComponents(entity) {
    try {
      injectDefaultComponents(entity, this.#logger, this.#validateAndClone);
      this.#logger.debug(
        `[EntityConstructionFactory] Default components applied to entity '${entity.id}'`
      );
    } catch (error) {
      this.#logger.error(
        `[EntityConstructionFactory] Failed to apply default components to entity '${entity.id}': ${error.message}`
      );
      throw error;
    }
  }

  /**
   * Creates a minimal entity for testing purposes (without default components).
   *
   * @param {EntityDefinition} definition - Entity definition
   * @param {string} instanceId - Entity instance ID
   * @param {Record<string, object|null>} components - Component data
   * @returns {Entity} The minimal entity
   */
  createMinimalEntity(definition, instanceId, components = {}) {
    this.#logger.debug(
      `[EntityConstructionFactory] Creating minimal entity '${instanceId}' for testing`
    );

    const data = this.#createEntityInstanceData(
      instanceId,
      definition,
      components
    );
    return this.#createEntityWrapper(data);
  }

  /**
   * Validates entity construction parameters.
   *
   * @param {EntityDefinition} definition - Entity definition
   * @param {string} instanceId - Entity instance ID
   * @param {Record<string, object|null>} components - Component data
   * @throws {Error} If parameters are invalid
   */
  validateConstructionParams(definition, instanceId, components) {
    if (!definition || typeof definition !== 'object') {
      throw new Error(
        'EntityConstructionFactory: definition must be an object'
      );
    }

    if (!instanceId || typeof instanceId !== 'string') {
      throw new Error(
        'EntityConstructionFactory: instanceId must be a non-empty string'
      );
    }

    if (components && typeof components !== 'object') {
      throw new Error(
        'EntityConstructionFactory: components must be an object or null'
      );
    }
  }
}
