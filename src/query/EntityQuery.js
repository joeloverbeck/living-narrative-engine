/**
 * @file EntityQuery.js
 * @description Object-oriented query class for filtering entities based on component requirements.
 * @module query/EntityQuery
 */

/** @typedef {import('../entities/entity.js').default} Entity */

/**
 * EntityQuery class for filtering entities based on component requirements.
 *
 * @class EntityQuery
 */
export default class EntityQuery {
  /**
   * Creates a new EntityQuery instance.
   *
   * @param {object} options - Query configuration options
   * @param {string[]} [options.withAll] - Components that the entity MUST have ALL of
   * @param {string[]} [options.withAny] - Components that the entity MUST have AT LEAST ONE of
   * @param {string[]} [options.without] - Components that the entity MUST NOT have ANY of
   */
  constructor({ withAll = [], withAny = [], without = [] } = {}) {
    this.withAll = Array.isArray(withAll) ? withAll : [];
    this.withAny = Array.isArray(withAny) ? withAny : [];
    this.without = Array.isArray(without) ? without : [];
  }

  /**
   * Determines if an entity matches this query's criteria.
   *
   * @param {Entity} entity - The entity to test against this query
   * @returns {boolean} True if the entity matches all criteria, false otherwise
   */
  matches(entity) {
    // 1. 'without' check (fastest rejection): If the entity has any component from the 'without' list, skip it.
    if (
      this.without.length > 0 &&
      this.without.some((componentTypeId) =>
        entity.hasComponent(componentTypeId)
      )
    ) {
      return false;
    }

    // 2. 'withAll' check: If the entity fails to have even one component from the 'withAll' list, skip it.
    if (
      this.withAll.length > 0 &&
      !this.withAll.every((componentTypeId) =>
        entity.hasComponent(componentTypeId)
      )
    ) {
      return false;
    }

    // 3. 'withAny' check: If a 'withAny' list is provided, the entity must have at least one component from it.
    if (
      this.withAny.length > 0 &&
      !this.withAny.some((componentTypeId) =>
        entity.hasComponent(componentTypeId)
      )
    ) {
      return false;
    }

    // If all checks pass, the entity matches
    return true;
  }

  /**
   * Checks if this query has any positive conditions (withAll or withAny).
   *
   * @returns {boolean} True if the query has at least one positive condition
   */
  hasPositiveConditions() {
    return this.withAll.length > 0 || this.withAny.length > 0;
  }
}
