import { MapManager } from '../utils/mapManagerUtils.js';
import { IEntityRepository } from '../ports/IEntityRepository.js';

/**
 * @class InMemoryEntityRepository
 * @description Stores entities in memory using a {@link MapManager}.
 * Implements the {@link IEntityRepository} interface.
 */
class InMemoryEntityRepository extends IEntityRepository {
  /** @type {MapManager} */
  #map;

  constructor() {
    super();
    this.#map = new MapManager({ throwOnInvalidId: false });
  }

  /** @inheritdoc */
  add(entity) {
    if (entity && typeof entity === 'object') {
      this.#map.add(entity.id, entity);
    } else {
      this.#map.add(undefined, entity);
    }
  }

  /** @inheritdoc */
  get(id) {
    return this.#map.get(id);
  }

  /** @inheritdoc */
  has(id) {
    return this.#map.has(id);
  }

  /** @inheritdoc */
  remove(id) {
    return this.#map.remove(id);
  }

  /** @inheritdoc */
  clear() {
    this.#map.clear();
  }

  /**
   * Returns an iterator over all stored entities.
   *
   * @returns {IterableIterator<object>}
   */
  entities() {
    return this.#map.values();
  }
}

export default InMemoryEntityRepository;
