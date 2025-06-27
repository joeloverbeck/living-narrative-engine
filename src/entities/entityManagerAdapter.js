import { IEntityManager } from '../interfaces/IEntityManager.js';

/**
 * @description Adapter that delegates to the underlying EntityManager while providing location query methods.
 * @class EntityManagerAdapter
 * @implements {IEntityManager}
 */
export class EntityManagerAdapter extends IEntityManager {
  /**
   * @param {object} dependencies - Constructor dependencies.
   * @param {import('./entityManager.js').default} dependencies.entityManager - Concrete EntityManager instance.
   * @param {import('./locationQueryService.js').LocationQueryService} dependencies.locationQueryService - Service used for location queries.
   */
  constructor({ entityManager, locationQueryService }) {
    super();
    this.entityManager = entityManager;
    this.locationQueryService = locationQueryService;

    return new Proxy(this, {
      get(target, prop, receiver) {
        if (
          Object.hasOwn(target, prop) ||
          Object.hasOwn(EntityManagerAdapter.prototype, prop)
        ) {
          return Reflect.get(target, prop, receiver);
        }
        const value = entityManager[prop];
        if (typeof value === 'function') {
          return value.bind(entityManager);
        }
        return value;
      },
    });
  }

  /**
   * Retrieves all entity instance IDs present in a specific location.
   *
   * @param {string} id - The unique location ID.
   * @returns {Set<string>} Set of entity instance IDs in the location.
   */
  getEntitiesInLocation(id) {
    return this.locationQueryService.getEntitiesInLocation(id);
  }
}

export default EntityManagerAdapter;
