/**
 * @file EntityDefinitionLookupFactory - Handles entity definition retrieval
 * @module EntityDefinitionLookupFactory
 */

import { getDefinition as lookupDefinition } from '../utils/definitionLookup.js';
import { validateDependency } from '../../utils/dependencyUtils.js';
import { ensureValidLogger } from '../../utils/loggerUtils.js';
import { DefinitionNotFoundError } from '../../errors/definitionNotFoundError.js';

/** @typedef {import('../entityDefinition.js').default} EntityDefinition */
/** @typedef {import('../../interfaces/coreServices.js').IDataRegistry} IDataRegistry */
/** @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger */

/**
 * @class EntityDefinitionLookupFactory
 * @description Specialized factory for entity definition lookup operations
 */
export default class EntityDefinitionLookupFactory {
  /** @type {ILogger} */
  #logger;

  /**
   * @class
   * @param {object} deps - Dependencies
   * @param {ILogger} deps.logger - Logger instance
   */
  constructor({ logger }) {
    validateDependency(logger, 'ILogger', console, {
      requiredMethods: ['info', 'error', 'warn', 'debug'],
    });
    this.#logger = ensureValidLogger(logger, 'EntityDefinitionLookupFactory');

    this.#logger.debug('EntityDefinitionLookupFactory initialized.');
  }

  /**
   * Retrieves an entity definition from the registry.
   *
   * @param {string} definitionId - The ID of the entity definition
   * @param {IDataRegistry} registry - The data registry to fetch from
   * @returns {EntityDefinition|null} The entity definition, or null when invalid
   */
  getDefinition(definitionId, registry) {
    if (!definitionId || typeof definitionId !== 'string') {
      this.#logger.warn(
        `[EntityDefinitionLookupFactory] Invalid definitionId provided: ${definitionId}`
      );
      return null;
    }

    if (!registry || typeof registry !== 'object') {
      this.#logger.error(
        `[EntityDefinitionLookupFactory] Invalid registry provided for definition '${definitionId}'`
      );
      return null;
    }

    try {
      const definition = lookupDefinition(definitionId, registry, this.#logger);

      if (definition) {
        this.#logger.debug(
          `[EntityDefinitionLookupFactory] Successfully retrieved definition '${definitionId}'`
        );
      } else {
        this.#logger.debug(
          `[EntityDefinitionLookupFactory] Definition '${definitionId}' not found in registry`
        );
      }

      return definition;
    } catch (error) {
      this.#logger.error(
        `[EntityDefinitionLookupFactory] Error retrieving definition '${definitionId}': ${error.message}`
      );
      return null;
    }
  }

  /**
   * Retrieves an entity definition and throws if not found.
   *
   * @param {string} definitionId - The ID of the entity definition
   * @param {IDataRegistry} registry - The data registry to fetch from
   * @returns {EntityDefinition} The entity definition
   * @throws {DefinitionNotFoundError} If the definition is not found
   */
  getDefinitionOrThrow(definitionId, registry) {
    const definition = this.getDefinition(definitionId, registry);

    if (!definition) {
      this.#logger.error(
        `[EntityDefinitionLookupFactory] Definition '${definitionId}' not found in registry`
      );
      throw new DefinitionNotFoundError(definitionId);
    }

    return definition;
  }

  /**
   * Checks if a definition exists in the registry.
   *
   * @param {string} definitionId - The ID of the entity definition
   * @param {IDataRegistry} registry - The data registry to check
   * @returns {boolean} True if the definition exists
   */
  hasDefinition(definitionId, registry) {
    return this.getDefinition(definitionId, registry) !== null;
  }

  /**
   * Retrieves multiple definitions at once.
   *
   * @param {string[]} definitionIds - Array of definition IDs to retrieve
   * @param {IDataRegistry} registry - The data registry to fetch from
   * @returns {Map<string, EntityDefinition|null>} Map of definition IDs to definitions
   */
  getMultipleDefinitions(definitionIds, registry) {
    const results = new Map();

    if (!Array.isArray(definitionIds)) {
      this.#logger.warn(
        '[EntityDefinitionLookupFactory] getMultipleDefinitions: definitionIds must be an array'
      );
      return results;
    }

    for (const definitionId of definitionIds) {
      const definition = this.getDefinition(definitionId, registry);
      results.set(definitionId, definition);
    }

    this.#logger.debug(
      `[EntityDefinitionLookupFactory] Retrieved ${results.size} definitions, ${Array.from(results.values()).filter((d) => d !== null).length} successful`
    );

    return results;
  }

  /**
   * Validates that a registry object is properly structured.
   *
   * @param {IDataRegistry} registry - The registry to validate
   * @throws {Error} If the registry is invalid
   */
  validateRegistry(registry) {
    if (!registry || typeof registry !== 'object') {
      throw new Error(
        'EntityDefinitionLookupFactory: registry must be an object'
      );
    }

    if (typeof registry.getEntityDefinition !== 'function') {
      throw new Error(
        'EntityDefinitionLookupFactory: registry must have getEntityDefinition method'
      );
    }
  }
}
