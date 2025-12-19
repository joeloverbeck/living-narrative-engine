/**
 * @file EntityQueryManager - Handles entity queries and lookups
 * @module EntityQueryManager
 */

import { validateDependency } from '../../utils/dependencyUtils.js';
import { ensureValidLogger } from '../../utils/loggerUtils.js';
import EntityQuery from '../../query/EntityQuery.js';
import {
  validateGetEntityInstanceParams as validateGetEntityInstanceParamsUtil,
  validateGetComponentDataParams as validateGetComponentDataParamsUtil,
  validateHasComponentParams as validateHasComponentParamsUtil,
  validateHasComponentOverrideParams as validateHasComponentOverrideParamsUtil,
  validateGetEntitiesWithComponentParams as validateGetEntitiesWithComponentParamsUtil,
} from '../utils/parameterValidators.js';

/** @typedef {import('../entity.js').default} Entity */
/** @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../services/entityRepositoryAdapter.js').default} EntityRepositoryAdapter */

/**
 * @class EntityQueryManager
 * @description Specialized manager for entity queries and lookups
 */
export default class EntityQueryManager {
  /** @type {EntityRepositoryAdapter} */
  #entityRepository;
  /** @type {ILogger} */
  #logger;

  /**
   * @class
   * @param {object} deps - Dependencies
   * @param {EntityRepositoryAdapter} deps.entityRepository - Entity repository adapter
   * @param {ILogger} deps.logger - Logger instance
   */
  constructor({ entityRepository, logger }) {
    validateDependency(logger, 'ILogger', console, {
      requiredMethods: ['info', 'error', 'warn', 'debug'],
    });
    this.#logger = ensureValidLogger(logger, 'EntityQueryManager');

    validateDependency(
      entityRepository,
      'EntityRepositoryAdapter',
      this.#logger,
      {
        requiredMethods: ['get', 'entities'],
      }
    );
    this.#entityRepository = entityRepository;

    this.#logger.debug('EntityQueryManager initialized.');
  }

  /**
   * Getter that returns an iterator over all active entities.
   *
   * @returns {IterableIterator<Entity>} Iterator over all active entities
   */
  get entities() {
    return this.#entityRepository.entities();
  }

  /**
   * Returns an array of all active entity IDs.
   *
   * @returns {string[]} Array of entity instance IDs.
   */
  getEntityIds() {
    return Array.from(this.entities, (e) => e.id);
  }

  /**
   * Retrieves an entity instance without throwing an error if not found.
   *
   * @param {string} instanceId - The ID of the entity instance.
   * @returns {Entity | undefined} The entity instance or undefined if not found.
   */
  #getEntityById(instanceId) {
    return this.#entityRepository.get(instanceId);
  }

  /**
   * Retrieve an entity instance by its ID.
   *
   * @param {string} instanceId - The ID of the entity instance.
   * @returns {Entity|undefined} The entity if found, otherwise undefined.
   * @throws {InvalidArgumentError} If the instanceId is invalid.
   */
  getEntityInstance(instanceId) {
    validateGetEntityInstanceParamsUtil(instanceId, this.#logger);
    const entity = this.#getEntityById(instanceId);
    if (!entity) {
      this.#logger.debug(
        `EntityQueryManager.getEntityInstance: Entity not found with ID: '${instanceId}'. Returning undefined.`
      );
      return undefined;
    }

    return entity;
  }

  /**
   * Retrieve component data for a specific entity.
   *
   * @param {string} instanceId - Entity instance ID.
   * @param {string} componentTypeId - Component type ID.
   * @returns {object|undefined} Component data or undefined if not found.
   * @throws {InvalidArgumentError} If parameters are invalid.
   */
  getComponentData(instanceId, componentTypeId) {
    validateGetComponentDataParamsUtil(
      instanceId,
      componentTypeId,
      this.#logger
    );
    const entity = this.#getEntityById(instanceId);
    if (!entity) {
      this.#logger.warn(
        `EntityQueryManager.getComponentData: Entity not found with ID: '${instanceId}'. Returning undefined for component '${componentTypeId}'.`
      );
      return undefined;
    }
    return entity.getComponentData(componentTypeId);
  }

  /**
   * Checks if an entity has data associated with a specific component type ID.
   * This includes both definition components and overrides.
   *
   * @param {string} instanceId - The ID (UUID) of the entity.
   * @param {string} componentTypeId - The unique string ID of the component type.
   * @param {boolean} [checkOverrideOnly] - If true, only check for component overrides.
   * @returns {boolean} True if the entity has the component data, false otherwise.
   * @throws {InvalidArgumentError} If parameters are invalid.
   */
  hasComponent(instanceId, componentTypeId, checkOverrideOnly = false) {
    // Handle the deprecated 3-parameter call
    if (arguments.length === 3) {
      this.#logger.warn(
        `EntityQueryManager.hasComponent: The 3-parameter version is deprecated. Use hasComponentOverride(instanceId, componentTypeId) instead of hasComponent(instanceId, componentTypeId, true).`
      );
      if (checkOverrideOnly) {
        return this.hasComponentOverride(instanceId, componentTypeId);
      }
    }

    validateHasComponentParamsUtil(instanceId, componentTypeId, this.#logger);
    const entity = this.#getEntityById(instanceId);
    return entity ? entity.hasComponent(componentTypeId) : false;
  }

  /**
   * Checks if an entity has a component override (instance-level component data).
   * This excludes components that only exist on the definition.
   *
   * @param {string} instanceId - The ID (UUID) of the entity.
   * @param {string} componentTypeId - The unique string ID of the component type.
   * @returns {boolean} True if the entity has a component override, false otherwise.
   * @throws {InvalidArgumentError} If parameters are invalid.
   */
  hasComponentOverride(instanceId, componentTypeId) {
    validateHasComponentOverrideParamsUtil(
      instanceId,
      componentTypeId,
      this.#logger
    );
    const entity = this.#getEntityById(instanceId);
    return entity ? entity.hasComponentOverride(componentTypeId) : false;
  }

  /**
   * Return **new array** of entities that possess `componentTypeId`.
   * Uses component index for O(1) lookup performance.
   * Logs diagnostic info for engine analytics / debugging.
   *
   * @param {string} componentTypeId - Component type ID to search for
   * @returns {Entity[]} Fresh array (never a live reference)
   * @throws {InvalidArgumentError} If componentTypeId is invalid.
   */
  getEntitiesWithComponent(componentTypeId) {
    validateGetEntitiesWithComponentParamsUtil(componentTypeId, this.#logger);

    // Use component index for O(1) lookup
    const entityIds =
      this.#entityRepository.getEntityIdsByComponent(componentTypeId);
    const results = [];

    for (const entityId of entityIds) {
      const entity = this.#entityRepository.get(entityId);
      if (entity) {
        results.push(entity);
      }
    }

    this.#logger.debug(
      `EntityQueryManager.getEntitiesWithComponent found ${results.length} entities with component '${componentTypeId}' using index`
    );

    // Enhanced logging for debugging park bench scope resolution issue
    if (componentTypeId === 'sitting:allows_sitting') {
      this.#logger.debug(
        `EntityQueryManager detailed search for 'sitting:allows_sitting'`,
        {
          componentTypeId,
          entityIdsFromIndex: Array.from(entityIds),
          totalEntityIdsFound: entityIds.size,
          entitiesFound: results.map((entity) => ({
            id: entity.id,
            hasComponent: entity.hasComponent(componentTypeId),
            componentData: entity.getComponentData(componentTypeId),
          })),
          repositoryStats: {
            totalEntities: this.#entityRepository.size(),
            componentIndexSize: this.#entityRepository.getEntityIdsByComponent
              ? this.#entityRepository.getEntityIdsByComponent(componentTypeId)
                  .size
              : 'unknown',
          },
        }
      );
    }

    return results;
  }

  /**
   * Find entities matching complex query criteria.
   *
   * @param {object} queryObj - Query object with withAll, withAny, without conditions
   * @returns {Entity[]} Array of entities matching the query
   */
  findEntities(queryObj) {
    const query = new EntityQuery(queryObj);

    // A query must have at least one positive condition.
    if (!query.hasPositiveConditions()) {
      this.#logger.warn(
        'EntityQueryManager.findEntities called with no "withAll" or "withAny" conditions. Returning empty array.'
      );
      return [];
    }

    const results = [...this.entities].filter((e) => query.matches(e));

    this.#logger.debug(
      `EntityQueryManager.findEntities found ${results.length} entities for query.`
    );
    return results;
  }

  /**
   * Returns a list of all component type IDs attached to a given entity.
   *
   * @param {string} entityId - The ID of the entity.
   * @returns {string[]} An array of component ID strings.
   * @throws {InvalidArgumentError} If the entityId is invalid.
   */
  getAllComponentTypesForEntity(entityId) {
    validateGetEntityInstanceParamsUtil(entityId, this.#logger);
    const entity = this.#getEntityById(entityId);
    if (!entity) {
      this.#logger.debug(
        `EntityQueryManager.getAllComponentTypesForEntity: Entity not found with ID: '${entityId}'. Returning empty array.`
      );
      return [];
    }
    return entity.componentTypeIds;
  }
}
