import { IEntityManager } from '../interfaces/IEntityManager.js';

/**
 * Explicit adapter around {@link import('./entityManager.js').default | EntityManager}.
 * Only exposes a curated subset of the manager API plus location queries.
 * This avoids leaking unintended methods to consumers via a Proxy.
 *
 * @class EntityManagerAdapter
 * @implements {IEntityManager}
 */
export class EntityManagerAdapter extends IEntityManager {
  /** @type {import('./entityManager.js').default} */
  #entityManager;
  /** @type {import('./locationQueryService.js').LocationQueryService} */
  #locationQueryService;

  /**
   * Create a new adapter instance.
   *
   * @param {object} dependencies - Constructor dependencies.
   * @param {import('./entityManager.js').default} dependencies.entityManager - Wrapped entity manager.
   * @param {import('./locationQueryService.js').LocationQueryService} dependencies.locationQueryService - Service used for spatial queries.
   */
  constructor({ entityManager, locationQueryService }) {
    super();
    this.#entityManager = entityManager;
    this.#locationQueryService = locationQueryService;
  }

  // ----------------------- IEntityManager delegation -----------------------
  /** @inheritdoc */
  getEntityInstance(id) {
    return this.#entityManager.getEntityInstance(id);
  }

  /** @inheritdoc */
  createEntityInstance(definitionId, options = {}) {
    return this.#entityManager.createEntityInstance(definitionId, options);
  }

  /** @inheritdoc */
  reconstructEntity(serializedEntity) {
    return this.#entityManager.reconstructEntity(serializedEntity);
  }

  /** @inheritdoc */
  getComponentData(instanceId, componentTypeId) {
    return this.#entityManager.getComponentData(instanceId, componentTypeId);
  }

  /** @inheritdoc */
  hasComponent(instanceId, componentTypeId) {
    return this.#entityManager.hasComponent(instanceId, componentTypeId);
  }

  /** @inheritdoc */
  hasComponentOverride(instanceId, componentTypeId) {
    return this.#entityManager.hasComponentOverride(
      instanceId,
      componentTypeId
    );
  }

  /** @inheritdoc */
  getEntitiesWithComponent(componentTypeId) {
    return this.#entityManager.getEntitiesWithComponent(componentTypeId);
  }

  /** @inheritdoc */
  addComponent(instanceId, componentTypeId, componentData) {
    return this.#entityManager.addComponent(
      instanceId,
      componentTypeId,
      componentData
    );
  }

  /** @inheritdoc */
  removeComponent(instanceId, componentTypeId) {
    return this.#entityManager.removeComponent(instanceId, componentTypeId);
  }

  /** @inheritdoc */
  getEntitiesInLocation(id) {
    return this.#locationQueryService.getEntitiesInLocation(id);
  }

  /** @inheritdoc */
  getEntityIds() {
    return this.#entityManager.getEntityIds();
  }

  /** @inheritdoc */
  findEntities(query) {
    return this.#entityManager.findEntities(query);
  }

  /** @inheritdoc */
  get entities() {
    return this.#entityManager.entities;
  }

  /** @inheritdoc */
  getAllComponentTypesForEntity(entityId) {
    return this.#entityManager.getAllComponentTypesForEntity(entityId);
  }

  /**
   * Clears all active entities via the wrapped EntityManager.
   * This method is not part of {@link IEntityManager} but required by
   * subsystems like GameStateRestorer.
   */
  clearAll() {
    if (typeof this.#entityManager.clearAll === 'function') {
      return this.#entityManager.clearAll();
    }
    return undefined;
  }
}

export default EntityManagerAdapter;
