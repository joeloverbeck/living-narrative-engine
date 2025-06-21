// src/ports/IEntityRepository.js
/* eslint-disable no-unused-vars */

/**
 * @interface IEntityRepository
 * @description Defines the contract for storing and retrieving entities.
 */
export class IEntityRepository {
  /**
   * Adds an entity to the repository.
   *
   * @param {object} entity - The entity to store.
   * @returns {void}
   */
  add(entity) {
    throw new Error('Interface method');
  }

  /**
   * Retrieves an entity by its identifier.
   *
   * @param {string} id - The entity identifier.
   * @returns {object|undefined} The entity if found.
   */
  get(id) {
    throw new Error('Interface method');
  }

  /**
   * Checks if an entity exists in the repository.
   *
   * @param {string} id - The entity identifier.
   * @returns {boolean} True if the entity exists.
   */
  has(id) {
    throw new Error('Interface method');
  }

  /**
   * Removes an entity from the repository.
   *
   * @param {string} id - The entity identifier.
   * @returns {void}
   */
  remove(id) {
    throw new Error('Interface method');
  }

  /**
   * Removes all entities from the repository.
   *
   * @returns {void}
   */
  clear() {
    throw new Error('Interface method');
  }

  /**
   * Returns an iterator over all stored entities.
   *
   * @returns {Iterator<object>} Iterator of entities.
   */
  entities() {
    throw new Error('Interface method');
  }
}
