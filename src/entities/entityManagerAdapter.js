/**
 * @file Adapter that wraps EntityManager and exposes a limited subset of its API.
 * @see src/entities/entityManagerAdapter.js
 */

/**
 * @typedef {import('./entityManager.js').default} EntityManager
 * @typedef {import('./entity.js').default} Entity
 * @typedef {import('./locationQueryService.js').LocationQueryService} LocationQueryService
 * @typedef {import('../interfaces/IEntityManager.js').IEntityManager} IEntityManager
 */

import { IEntityManager } from '../interfaces/IEntityManager.js';

/**
 * @description Adapter that wraps EntityManager and provides location query functionality.
 * @class EntityManagerAdapter
 * @implements {IEntityManager}
 */
export class EntityManagerAdapter extends IEntityManager {
  /**
   * @param {object} dependencies
   * @param {EntityManager} dependencies.entityManager - The wrapped entity manager.
   * @param {LocationQueryService} dependencies.locationQueryService - The location query service.
   */
  constructor({ entityManager, locationQueryService }) {
    super();
    /** @private */
    this.entityManager = entityManager;
    /** @private */
    this.locationQueryService = locationQueryService;
  }

  /**
   * Delegates to the wrapped EntityManager to clear all entities.
   *
   * @returns {void}
   */
  clearAll() {
    this.entityManager.clearAll();
  }

  /**
   * Retrieves all entity instance IDs present in a specific location.
   *
   * @param {string} locationId - The unique ID of the location entity.
   * @returns {Set<string>} Set of entity instance IDs in the location.
   */
  getEntitiesInLocation(locationId) {
    return this.locationQueryService.getEntitiesInLocation(locationId);
  }

  /**
   * Returns an iterable of all active entity IDs.
   *
   * @returns {Iterable<string>} Iterable of entity IDs.
   */
  getEntityIds() {
    return this.entityManager.getEntityIds();
  }

  /**
   * Retrieves an active entity instance by its unique ID.
   *
   * @param {string} instanceId - The entity ID.
   * @returns {Entity | undefined} The entity instance if found.
   */
  getEntityInstance(instanceId) {
    return this.entityManager.getEntityInstance(instanceId);
  }

  /**
   * Creates a new Entity instance from a definition ID.
   *
   * @param {string} definitionId - The entity definition ID.
   * @param {object} [options] - Options for creation.
   * @returns {Entity} The created entity.
   */
  createEntityInstance(definitionId, options = {}) {
    return this.entityManager.createEntityInstance(definitionId, options);
  }

  /**
   * Reconstructs an entity from saved data.
   *
   * @param {object} serializedEntity - Saved entity data.
   * @returns {Entity} The reconstructed entity instance.
   */
  reconstructEntity(serializedEntity) {
    return this.entityManager.reconstructEntity(serializedEntity);
  }

  /**
   * Retrieves raw component data for an entity.
   *
   * @param {string} instanceId - The entity ID.
   * @param {string} componentTypeId - The component type ID.
   * @returns {object | undefined} The component data.
   */
  getComponentData(instanceId, componentTypeId) {
    return this.entityManager.getComponentData(instanceId, componentTypeId);
  }

  /**
   * Checks if an entity has data for a component type.
   *
   * @param {string} instanceId - The entity ID.
   * @param {string} componentTypeId - The component type ID.
   * @returns {boolean} True if the entity has the component.
   */
  hasComponent(instanceId, componentTypeId) {
    return this.entityManager.hasComponent(instanceId, componentTypeId);
  }

  /**
   * Checks if an entity has a component override.
   *
   * @param {string} instanceId - The entity ID.
   * @param {string} componentTypeId - The component type ID.
   * @returns {boolean} True if a component override exists.
   */
  hasComponentOverride(instanceId, componentTypeId) {
    return this.entityManager.hasComponentOverride(instanceId, componentTypeId);
  }

  /**
   * Fetches all entities that possess a component type.
   *
   * @param {string} componentTypeId - The component type ID.
   * @returns {Entity[]} Array of matching entities.
   */
  getEntitiesWithComponent(componentTypeId) {
    return this.entityManager.getEntitiesWithComponent(componentTypeId);
  }

  /**
   * Adds a component to an entity.
   *
   * @param {string} instanceId - The entity ID.
   * @param {string} componentTypeId - The component type ID.
   * @param {object} componentData - The component data.
   * @returns {boolean} True if successful.
   */
  addComponent(instanceId, componentTypeId, componentData) {
    return this.entityManager.addComponent(
      instanceId,
      componentTypeId,
      componentData
    );
  }

  /**
   * Removes a component from an entity.
   *
   * @param {string} instanceId - The entity ID.
   * @param {string} componentTypeId - The component type ID.
   * @returns {boolean} True if the component was removed.
   */
  removeComponent(instanceId, componentTypeId) {
    return this.entityManager.removeComponent(instanceId, componentTypeId);
  }

  /**
   * Finds all active entities that match a query.
   *
   * @param {object} query - The query definition.
   * @returns {Entity[]} Array of matching entities.
   */
  findEntities(query) {
    return this.entityManager.findEntities(query);
  }

  /**
   * Iterator over all active entities.
   *
   * @returns {IterableIterator<Entity>} Iterator of entities.
   */
  get entities() {
    return this.entityManager.entities;
  }

  /**
   * Lists all component type IDs attached to an entity.
   *
   * @param {string} entityId - The entity ID.
   * @returns {string[]} Array of component type IDs.
   */
  getAllComponentTypesForEntity(entityId) {
    return this.entityManager.getAllComponentTypesForEntity(entityId);
  }
}

export default EntityManagerAdapter;
