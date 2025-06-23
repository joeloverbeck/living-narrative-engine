/**
 * @file Adapter that wraps EntityManager and provides location query functionality.
 * @see src/entities/entityManagerAdapter.js
 */

/**
 * @typedef {import('./entityManager.js').default} EntityManager
 * @typedef {import('./locationQueryService.js').LocationQueryService} LocationQueryService
 * @typedef {import('../interfaces/IEntityManager.js').IEntityManager} IEntityManager
 */

/**
 * @description Adapter that wraps EntityManager and provides location query functionality.
 * This adapter implements IEntityManager and delegates most methods to the wrapped EntityManager,
 * but provides getEntitiesInLocation by delegating to LocationQueryService.
 * @class EntityManagerAdapter
 * @implements {IEntityManager}
 */
export class EntityManagerAdapter {
  /**
   * @param {object} dependencies
   * @param {EntityManager} dependencies.entityManager - The wrapped entity manager.
   * @param {LocationQueryService} dependencies.locationQueryService - The location query service.
   */
  constructor({ entityManager, locationQueryService }) {
    /** @private */
    this.entityManager = entityManager;
    /** @private */
    this.locationQueryService = locationQueryService;
  }

  /**
   * Retrieves all entity instance IDs (UUIDs) present in a specific location.
   * This delegates to the LocationQueryService.
   *
   * @param {string} locationId - The unique ID of the location entity.
   * @returns {Set<string>} A Set of entity instance IDs (UUIDs) in the specified location.
   */
  getEntitiesInLocation(locationId) {
    return this.locationQueryService.getEntitiesInLocation(locationId);
  }

  // Delegate all other IEntityManager methods to the wrapped entityManager

  getEntityInstance(instanceId) {
    return this.entityManager.getEntityInstance(instanceId);
  }

  createEntityInstance(definitionId, options = {}) {
    return this.entityManager.createEntityInstance(definitionId, options);
  }

  reconstructEntity(serializedEntity) {
    return this.entityManager.reconstructEntity(serializedEntity);
  }

  getComponentData(instanceId, componentTypeId) {
    return this.entityManager.getComponentData(instanceId, componentTypeId);
  }

  hasComponent(instanceId, componentTypeId) {
    return this.entityManager.hasComponent(instanceId, componentTypeId);
  }

  hasComponentOverride(instanceId, componentTypeId) {
    return this.entityManager.hasComponentOverride(instanceId, componentTypeId);
  }

  getEntitiesWithComponent(componentTypeId) {
    return this.entityManager.getEntitiesWithComponent(componentTypeId);
  }

  addComponent(instanceId, componentTypeId, componentData) {
    return this.entityManager.addComponent(
      instanceId,
      componentTypeId,
      componentData
    );
  }

  removeComponent(instanceId, componentTypeId) {
    return this.entityManager.removeComponent(instanceId, componentTypeId);
  }

  findEntities(query) {
    return this.entityManager.findEntities(query);
  }

  get entities() {
    return this.entityManager.entities;
  }
}
