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

    return new Proxy(this, {
      get(target, prop, receiver) {
        if (Reflect.has(target, prop)) {
          return Reflect.get(target, prop, receiver);
        }

        const value = target.entityManager[prop];
        if (typeof value === 'function') {
          return value.bind(target.entityManager);
        }
        return value;
      },
    });
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

  /**
   * Delegates to the wrapped EntityManager to retrieve all active entity IDs.
   *
   * @returns {Iterable<string>} Iterable of entity instance IDs.
   */
  getEntityIds() {
    return this.entityManager.getEntityIds();
  }

  // All other property accesses are delegated via Proxy
}
