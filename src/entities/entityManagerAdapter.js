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
  getEntity(id) {
    return this.#entityManager.getEntity(id);
  }

  /** @inheritdoc */
  hasEntity(id) {
    return this.#entityManager.hasEntity(id);
  }

  /** @inheritdoc */
  async createEntityInstance(definitionId, options = {}) {
    return await this.#entityManager.createEntityInstance(
      definitionId,
      options
    );
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
  getComponent(instanceId, componentTypeId) {
    return this.#entityManager.getComponent(instanceId, componentTypeId);
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
  async addComponent(instanceId, componentTypeId, componentData) {
    return await this.#entityManager.addComponent(
      instanceId,
      componentTypeId,
      componentData
    );
  }

  /** @inheritdoc */
  async removeComponent(instanceId, componentTypeId) {
    return await this.#entityManager.removeComponent(
      instanceId,
      componentTypeId
    );
  }

  /** @inheritdoc */
  async removeEntityInstance(instanceId) {
    return await this.#entityManager.removeEntityInstance(instanceId);
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
   * This method is required by subsystems like GameStateRestorer.
   */
  clearAll() {
    return this.#entityManager.clearAll();
  }

  /** @inheritdoc */
  hasBatchSupport() {
    return this.#entityManager.hasBatchSupport();
  }


  /**
   * Returns the monitoring coordinator from the underlying EntityManager.
   * Used for resetting circuit breakers in test scenarios.
   *
   * @returns {import('./monitoring/MonitoringCoordinator.js').MonitoringCoordinator | null} The monitoring coordinator or null
   */
  getMonitoringCoordinator() {
    return this.#entityManager.getMonitoringCoordinator();
  }

  /** @inheritdoc */
  async batchCreateEntities(entitySpecs, options = {}) {
    return await this.#entityManager.batchCreateEntities(entitySpecs, options);
  }

  /** @inheritdoc */
  async batchAddComponentsOptimized(componentSpecs, emitBatchEvent = true) {
    return await this.#entityManager.batchAddComponentsOptimized(
      componentSpecs,
      emitBatchEvent
    );
  }
}

export default EntityManagerAdapter;
